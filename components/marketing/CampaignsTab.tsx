import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Receipt,
  Moon,
  Repeat,
  Megaphone,
  CalendarClock,
  Send,
  Sparkles,
  Target,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { useData } from '../../services/dataContext';
import { useChartTheme } from '../../hooks/useChartTheme';
import { supabase } from '../../services/supabase';
import { assertNoError } from '../../utils/supabase';
import StableResponsiveContainer from '../charts/StableResponsiveContainer';
import { computeCampaignPlan } from '../../lib/marketing/campaigns';
import {
  buildCampaignIdeas,
  buildCustomerArgument,
  campaignHeadlines,
  timingHeadline,
  formatBRL,
  formatDays,
  SEGMENT_META,
  SEGMENT_COLOR,
} from '../../lib/marketing/campaignInsights';
import {
  computeBroadcastStats,
  type BroadcastRow,
  type RecipientRow,
  type LeadRow,
} from '../../lib/marketing/broadcastStats';

const TONE_BADGE: Record<string, string> = {
  positive: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  neutral: 'bg-gray-100 text-gray-600 dark:bg-surface-dark-200 dark:text-surface-dark-600',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  negative: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

const BROADCAST_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  processing: 'Processando',
  completed: 'Concluído',
  failed: 'Falhou',
  canceled: 'Cancelado',
};

const TARGET_LIMIT = 10;

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string; headline: string }> = ({
  icon,
  label,
  value,
  headline,
}) => (
  <div className="ios-card p-4 flex flex-col gap-1">
    <div className="flex items-center gap-2 text-gray-500 dark:text-surface-dark-500">
      {icon}
      <span className="text-ios-caption-1 uppercase tracking-wide">{label}</span>
    </div>
    <span className="text-ios-title-2 font-bold text-gray-900 dark:text-white">{value}</span>
    <span className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500 leading-snug">{headline}</span>
  </div>
);

const DisabledCTA: React.FC = () => (
  <button className="ios-button-primary opacity-50 cursor-not-allowed text-ios-footnote" title="Em breve">
    Criar broadcast
  </button>
);

interface CrmData {
  broadcasts: BroadcastRow[];
  recipients: RecipientRow[];
  leads: LeadRow[];
}

const CampaignsTab: React.FC<{ periodDays: number | null }> = ({ periodDays }) => {
  const { sales, customers, stock, stores } = useData();
  const chart = useChartTheme();

  // Loja ativa: mesma resolução do useCRMStore (1ª loja ordenada por nome) — o
  // Marketing roda sob o DataProvider do ERP, fora do CRMStoreProvider.
  const storeId = useMemo(() => {
    const sorted = [...stores].sort(
      (a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id, 'pt-BR')
    );
    return sorted[0]?.id || '';
  }, [stores]);

  const plan = useMemo(
    () => computeCampaignPlan(sales, customers, stock, { periodDays }),
    [sales, customers, stock, periodDays]
  );
  const headlines = useMemo(() => campaignHeadlines(plan), [plan]);
  const ideas = useMemo(() => buildCampaignIdeas(plan), [plan]);

  // --- Dados de CRM (fetch direto; degrada graciosamente) ---
  const [crm, setCrm] = useState<CrmData | null>(null);
  const [crmLoading, setCrmLoading] = useState(true);
  const [crmError, setCrmError] = useState(false);

  useEffect(() => {
    if (!storeId) {
      setCrmLoading(false);
      return;
    }
    let cancelled = false;
    setCrmLoading(true);
    setCrmError(false);
    (async () => {
      try {
        const [broadcasts, recipients, leads] = await Promise.all([
          assertNoError(
            await supabase
              .from('crm_broadcasts')
              .select('id,name,status,scheduled_for,sent_at,created_at')
              .eq('store_id', storeId)
              .order('created_at', { ascending: false })
              .limit(200)
          ),
          assertNoError(
            await supabase
              .from('crm_broadcast_recipients')
              .select('broadcast_id,status')
              .eq('store_id', storeId)
              .limit(5000)
          ),
          assertNoError(
            await supabase
              .from('crm_leads')
              .select('id,source,source_campaign_title,utm_source,utm_campaign,created_at')
              .eq('store_id', storeId)
              .order('created_at', { ascending: false })
              .limit(2000)
          ),
        ]);
        if (cancelled) return;
        setCrm({
          broadcasts: (broadcasts as BroadcastRow[]) ?? [],
          recipients: (recipients as RecipientRow[]) ?? [],
          leads: (leads as LeadRow[]) ?? [],
        });
      } catch {
        if (!cancelled) setCrmError(true);
      } finally {
        if (!cancelled) setCrmLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const broadcastStats = useMemo(
    () => (crm ? computeBroadcastStats(crm.broadcasts, crm.recipients, crm.leads, { periodDays }) : null),
    [crm, periodDays]
  );

  const segmentChartData = useMemo(
    () =>
      plan.segments.map((s) => ({
        name: SEGMENT_META[s.segment].label,
        count: s.count,
        segment: s.segment,
      })),
    [plan]
  );

  const hasErpData = plan.totalCustomers > 0;

  if (!hasErpData) {
    return (
      <div className="ios-card p-8 text-center">
        <Target size={28} className="mx-auto text-gray-400 mb-2" />
        <p className="text-ios-body text-gray-600 dark:text-surface-dark-600">
          Ainda não há clientes com compras registradas para planejar campanhas.
        </p>
        <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mt-1">
          Registre vendas vinculadas a clientes no PDV para liberar a segmentação RFM.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard icon={<Users size={16} />} label="Clientes ativos" value={String(plan.activeCustomers)} headline={headlines.active} />
        <KpiCard icon={<Receipt size={16} />} label="Ticket médio" value={formatBRL(plan.avgTicket)} headline={headlines.ticket} />
        <KpiCard icon={<Moon size={16} />} label="Sumidos" value={String(plan.dormantCustomers)} headline={headlines.dormant} />
        <KpiCard
          icon={<Repeat size={16} />}
          label="Recompra"
          value={plan.avgRepurchaseDays != null ? formatDays(plan.avgRepurchaseDays) : '—'}
          headline={headlines.repurchase}
        />
      </div>

      {/* Ideias de campanha */}
      {ideas.length > 0 && (
        <section className="ios-card p-4 md:p-6 space-y-3">
          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
            <Sparkles size={18} />
            <h2 className="text-ios-headline font-bold">Ideias de campanha</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ideas.map((idea) => (
              <div key={idea.id} className="rounded-2xl border border-gray-200/70 dark:border-surface-dark-200/60 p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <span aria-hidden>{idea.emoji}</span>
                    {idea.title}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-ios-caption-1 font-semibold ${TONE_BADGE[idea.tone]}`}>
                    {idea.audienceSize} alvo(s)
                  </span>
                </div>
                <p className="text-ios-footnote text-gray-600 dark:text-surface-dark-600 leading-snug">{idea.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Segmentos RFM */}
      <section className="ios-card p-4 md:p-6 space-y-3">
        <h2 className="text-ios-headline font-bold text-gray-900 dark:text-white">Segmentos da base (RFM)</h2>
        <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500">
          Recência, frequência e valor classificam cada cliente. Os cortes se adaptam à sua própria base.
        </p>
        <div className="h-56 w-full">
          <StableResponsiveContainer>
            <BarChart data={segmentChartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={chart.gridColor} vertical={false} />
              <XAxis dataKey="name" stroke={chart.axisColor} tick={{ fill: chart.axisColor, fontSize: 11 }} interval={0} />
              <YAxis stroke={chart.axisColor} tick={{ fill: chart.axisColor, fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={chart.tooltipContentStyle} formatter={(v: number | string) => [`${v} cliente(s)`, 'Quantidade']} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {segmentChartData.map((d) => (
                  <Cell key={d.segment} fill={SEGMENT_COLOR[d.segment]} />
                ))}
              </Bar>
            </BarChart>
          </StableResponsiveContainer>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {plan.segments.map((s) => {
            const meta = SEGMENT_META[s.segment];
            return (
              <div key={s.segment} className="rounded-xl border border-gray-200/70 dark:border-surface-dark-200/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white text-ios-footnote flex items-center gap-1">
                    <span aria-hidden>{meta.emoji}</span>
                    {meta.label}
                  </span>
                  <span className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500">
                    {s.count} · {formatBRL(s.totalValue)}
                  </span>
                </div>
                <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500 mt-1 leading-snug">{meta.action}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sazonalidade */}
      <section className="ios-card p-4 md:p-6 space-y-2">
        <div className="flex items-center gap-2 text-gray-700 dark:text-surface-dark-700">
          <CalendarClock size={18} />
          <h2 className="text-ios-headline font-bold">Melhor janela para vender</h2>
        </div>
        <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500">{timingHeadline(plan)}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500 mb-1">Por mês</p>
            <div className="h-52 w-full">
              <StableResponsiveContainer>
                <BarChart data={plan.byMonth} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke={chart.gridColor} vertical={false} />
                  <XAxis dataKey="label" stroke={chart.axisColor} tick={{ fill: chart.axisColor, fontSize: 10 }} interval={0} />
                  <YAxis stroke={chart.axisColor} tick={{ fill: chart.axisColor, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={chart.tooltipContentStyle} formatter={(v: number | string) => [`${v} venda(s)`, 'Unidades']} />
                  <Bar dataKey="units" fill={chart.seriesPrimary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </StableResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500 mb-1">Por dia da semana</p>
            <div className="h-52 w-full">
              <StableResponsiveContainer>
                <BarChart data={plan.byWeekday} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke={chart.gridColor} vertical={false} />
                  <XAxis dataKey="label" stroke={chart.axisColor} tick={{ fill: chart.axisColor, fontSize: 10 }} interval={0} />
                  <YAxis stroke={chart.axisColor} tick={{ fill: chart.axisColor, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={chart.tooltipContentStyle} formatter={(v: number | string) => [`${v} venda(s)`, 'Unidades']} />
                  <Bar dataKey="units" fill={chart.seriesPrimary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </StableResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Listas de alvo prontas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="ios-card overflow-hidden">
          <div className="p-4 md:p-5 border-b border-gray-200 dark:border-surface-dark-200 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-ios-headline font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Moon size={18} className="text-red-500" />
                Win-back ({plan.winBack.length})
              </h2>
              <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500 mt-0.5">Sumidos há +{plan.recencyCutoff} dias, por valor.</p>
            </div>
            <DisabledCTA />
          </div>
          <TargetTable
            rows={plan.winBack.slice(0, TARGET_LIMIT).map((c) => ({
              id: c.customerId,
              name: c.name,
              phone: c.phone,
              detail: buildCustomerArgument(c),
              value: c.monetary,
            }))}
            emptyText="Nenhum cliente sumido no momento. 👏"
          />
        </section>

        <section className="ios-card overflow-hidden">
          <div className="p-4 md:p-5 border-b border-gray-200 dark:border-surface-dark-200 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-ios-headline font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles size={18} className="text-green-500" />
                Upgrade ({plan.upgrades.length})
              </h2>
              <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500 mt-0.5">
                Compradores antigos × modelos em alta no estoque.
              </p>
            </div>
            <DisabledCTA />
          </div>
          <TargetTable
            rows={plan.upgrades.slice(0, TARGET_LIMIT).map((u) => ({
              id: u.customerId,
              name: u.name,
              phone: u.phone,
              detail: `Comprou ${u.lastModelKey || '—'} há ${formatDays(u.recencyDays)} → ofereça ${u.suggestedModel}.`,
              value: u.monetary,
            }))}
            emptyText="Sem alvos de upgrade: cadastre estoque dos modelos que estão girando."
          />
        </section>
      </div>

      {/* Desempenho de campanhas (CRM) */}
      <section className="ios-card p-4 md:p-6 space-y-3">
        <div className="flex items-center gap-2 text-gray-700 dark:text-surface-dark-700">
          <Megaphone size={18} />
          <h2 className="text-ios-headline font-bold">Desempenho dos disparos (CRM)</h2>
        </div>

        {crmLoading ? (
          <p role="status" className="text-ios-footnote text-gray-500 dark:text-surface-dark-500">Carregando dados do CRM...</p>
        ) : crmError ? (
          <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500">
            Não foi possível carregar os dados de campanhas do CRM agora. O planejamento acima segue válido.
          </p>
        ) : !broadcastStats || broadcastStats.totalBroadcasts === 0 ? (
          <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500">
            Nenhum broadcast no período. Crie campanhas em CRM Plus → Broadcasts para acompanhar envios aqui.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={<Megaphone size={16} />} label="Campanhas" value={String(broadcastStats.totalBroadcasts)} headline={`${broadcastStats.totalRecipients} destinatário(s) no total.`} />
              <KpiCard icon={<Send size={16} />} label="Enviados" value={String(broadcastStats.sent)} headline={`${broadcastStats.failed} falha(s) registrada(s).`} />
              <KpiCard
                icon={<Target size={16} />}
                label="Taxa de envio"
                value={broadcastStats.sendSuccessRate != null ? `${Math.round(broadcastStats.sendSuccessRate * 100)}%` : '—'}
                headline="Mensagens entregues ao provedor (sem abertura/clique)."
              />
              <KpiCard icon={<Users size={16} />} label="Leads no período" value={String(broadcastStats.leadsTracked)} headline={`${broadcastStats.leadsWithSource} com origem identificada.`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Últimos broadcasts */}
              <div className="overflow-x-auto">
                <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500 mb-1">Últimos disparos</p>
                <table className="w-full text-left text-ios-footnote">
                  <thead>
                    <tr className="text-ios-caption-1 text-gray-500 border-b border-gray-200 dark:border-surface-dark-200">
                      <th className="py-2 pr-2 font-medium">Campanha</th>
                      <th className="py-2 px-2 font-medium">Status</th>
                      <th className="py-2 pl-2 font-medium text-right">Enviados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-surface-dark-200/60">
                    {broadcastStats.recent.map((b) => (
                      <tr key={b.id}>
                        <td className="py-2 pr-2 text-gray-900 dark:text-white">{b.name}</td>
                        <td className="py-2 px-2 text-gray-600 dark:text-surface-dark-600">{BROADCAST_STATUS_LABEL[b.status] || b.status}</td>
                        <td className="py-2 pl-2 text-right text-gray-700 dark:text-surface-dark-700">
                          {b.sent}
                          {b.failed > 0 && <span className="text-red-500"> / {b.failed} falha</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Atribuição de origem */}
              <div className="overflow-x-auto">
                <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500 mb-1">De onde vêm os leads</p>
                {broadcastStats.sources.length === 0 ? (
                  <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500">Sem origem identificada nos leads do período.</p>
                ) : (
                  <table className="w-full text-left text-ios-footnote">
                    <thead>
                      <tr className="text-ios-caption-1 text-gray-500 border-b border-gray-200 dark:border-surface-dark-200">
                        <th className="py-2 pr-2 font-medium">Origem</th>
                        <th className="py-2 pl-2 font-medium text-right">Leads</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-surface-dark-200/60">
                      {broadcastStats.sources.map((s) => (
                        <tr key={s.label}>
                          <td className="py-2 pr-2 text-gray-900 dark:text-white">{s.label}</td>
                          <td className="py-2 pl-2 text-right text-gray-700 dark:text-surface-dark-700">{s.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

interface TargetRow {
  id: string;
  name: string;
  phone: string;
  detail: string;
  value: number;
}

const TargetTable: React.FC<{ rows: TargetRow[]; emptyText: string }> = ({ rows, emptyText }) => {
  if (rows.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500">{emptyText}</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-gray-100 dark:divide-surface-dark-200/60">
      {rows.map((r) => (
        <li key={r.id} className="p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{r.name}</p>
            <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500">{r.phone || 'Sem telefone'}</p>
            <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500 mt-1 leading-snug">{r.detail}</p>
          </div>
          <span className="shrink-0 font-semibold text-gray-700 dark:text-surface-dark-700">{formatBRL(r.value)}</span>
        </li>
      ))}
    </ul>
  );
};

export default CampaignsTab;
