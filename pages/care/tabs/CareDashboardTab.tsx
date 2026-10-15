import React, { useMemo, useState } from 'react';
import { AlertTriangle, FileSignature, Gift, HandCoins, PenLine, ShieldCheck, Wrench } from 'lucide-react';
import { fetchCareDashboard } from '../../../services/careApi';
import { useCareQuery } from '../useCareQuery';
import { CareLoadError, CareLoading } from '../CareStates';
import { conditionLabel } from '../../../lib/care/careLabels';
import type { CareDashboard } from '../../../lib/care/careTypes';
import { formatCurrencyBRL, formatPercentBRL } from '../../../utils/inputMasks';

type Period = '30d' | 'mes' | '90d' | '12m';

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: '30d', label: '30 dias' },
  { key: 'mes', label: 'Este mês' },
  { key: '90d', label: '90 dias' },
  { key: '12m', label: '12 meses' },
];

const isoDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export function periodRange(period: Period, today = new Date()): { from: string; to: string } {
  const from = new Date(today);
  if (period === 'mes') from.setDate(1);
  if (period === '30d') from.setDate(from.getDate() - 29);
  if (period === '90d') from.setDate(from.getDate() - 89);
  if (period === '12m') from.setFullYear(from.getFullYear() - 1);
  return { from: isoDate(from), to: isoDate(today) };
}

const Kpi: React.FC<{ icon: React.ReactNode; label: string; value: string; hint?: string; tone?: 'warning' }> = ({ icon, label, value, hint, tone }) => (
  <div className={`ios-card p-4 ${tone === 'warning' ? 'ring-1 ring-amber-300/70 dark:ring-amber-500/40' : ''}`}>
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide app-text-muted">{icon}{label}</div>
    <p className="mt-2 text-2xl font-bold app-text-primary tabular-nums">{value}</p>
    {hint && <p className="mt-1 text-xs app-text-muted">{hint}</p>}
  </div>
);

const adhesion = (d: CareDashboard) => (d.devicesSold > 0 ? (d.contractsCreated / d.devicesSold) * 100 : 0);

const KpiGrid: React.FC<{ d: CareDashboard }> = ({ d }) => (
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
    <Kpi icon={<ShieldCheck size={14} />} label="Adesão" value={formatPercentBRL(adhesion(d), 1)} hint={`${d.contractsCreated} contrato(s) / ${d.devicesSold} iPhone(s) vendidos`} />
    <Kpi icon={<HandCoins size={14} />} label="1ªs parcelas" value={formatCurrencyBRL(d.firstInstallmentRevenue)} hint="Recebido no período" />
    <Kpi icon={<HandCoins size={14} />} label="Parcelas seguintes" value={formatCurrencyBRL(d.recurringRevenue)} hint="Recebido no período" />
    <Kpi
      icon={<AlertTriangle size={14} />}
      label="Em atraso"
      value={formatCurrencyBRL(d.overdueAmount)}
      hint={`${d.overdueCount} parcela(s) vencida(s)`}
      tone={d.overdueCount > 0 ? 'warning' : undefined}
    />
    <Kpi icon={<PenLine size={14} />} label="Aguardando assinatura" value={String(d.statusCounts.aguardando_assinatura ?? 0)} hint={`${d.contractsSigned} assinado(s) no período`} />
    <Kpi
      icon={<FileSignature size={14} />}
      label="Aguardando 1ª parcela"
      value={String(d.statusCounts.assinado_aguardando_primeiro_pagamento ?? 0)}
      hint="Assinados, ainda não ativos"
      tone={(d.statusCounts.assinado_aguardando_primeiro_pagamento ?? 0) > 0 ? 'warning' : undefined}
    />
    <Kpi icon={<Gift size={14} />} label="Bônus a entregar" value={String(d.benefits.liberados)} hint={`${d.benefits.entregues} entregue(s) · custo ${formatCurrencyBRL(d.benefits.custoEntregue)}`} />
    <Kpi icon={<Wrench size={14} />} label="Acionamentos abertos" value={String(d.serviceRequests.abertos)} hint={`${d.serviceRequests.concluidos} concluído(s)`} />
  </div>
);

const Portfolio: React.FC<{ d: CareDashboard }> = ({ d }) => {
  const received = d.contractedTotalActive > 0 ? (d.receivedTotalActive / d.contractedTotalActive) * 100 : 0;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="ios-card p-4 space-y-3">
        <p className="text-sm font-semibold app-text-primary">Carteira vigente</p>
        <div className="flex items-baseline justify-between"><span className="text-sm app-text-muted">Contratado</span><span className="font-bold tabular-nums">{formatCurrencyBRL(d.contractedTotalActive)}</span></div>
        <div className="flex items-baseline justify-between"><span className="text-sm app-text-muted">Recebido</span><span className="font-bold tabular-nums">{formatCurrencyBRL(d.receivedTotalActive)}</span></div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-surface-dark-200" role="progressbar" aria-valuenow={Math.round(received)} aria-valuemin={0} aria-valuemax={100} aria-label="Recebido sobre contratado">
          <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.min(received, 100)}%` }} />
        </div>
        <p className="text-xs app-text-muted">Receita do Repasse Care+ (separada da venda dos aparelhos).</p>
      </div>
      <div className="ios-card p-4 space-y-3">
        <p className="text-sm font-semibold app-text-primary">Assistência</p>
        <div className="flex items-baseline justify-between"><span className="text-sm app-text-muted">Franquias recebidas</span><span className="font-bold tabular-nums">{formatCurrencyBRL(d.serviceRequests.receitaFranquias)}</span></div>
        <div className="flex items-baseline justify-between"><span className="text-sm app-text-muted">Custo de reparos</span><span className="font-bold tabular-nums">{formatCurrencyBRL(d.serviceRequests.custoReparos)}</span></div>
        <div className="flex items-baseline justify-between"><span className="text-sm app-text-muted">Reprovados</span><span className="font-bold tabular-nums">{d.serviceRequests.reprovados}</span></div>
      </div>
    </div>
  );
};

const ByModel: React.FC<{ d: CareDashboard }> = ({ d }) => (
  <div className="ios-card overflow-hidden">
    <p className="px-4 pt-4 text-sm font-semibold app-text-primary">Por modelo e condição</p>
    {d.byModel.length === 0 ? (
      <p className="p-4 text-sm app-text-muted">Nenhum contrato ainda.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="mt-2 w-full text-sm">
          <thead className="app-table-head">
            <tr className="text-left text-xs uppercase tracking-wide app-text-muted">
              <th className="px-4 py-2">Modelo</th><th className="px-4 py-2 text-right">Contratos</th><th className="px-4 py-2 text-right">Ativos</th>
              <th className="px-4 py-2 text-right">Contratado</th><th className="px-4 py-2 text-right">Recebido</th><th className="px-4 py-2 text-right">Acionamentos</th>
            </tr>
          </thead>
          <tbody className="app-table-divider">
            {d.byModel.map((m) => (
              <tr key={`${m.model}-${m.condition}`}>
                <td className="px-4 py-2 font-medium app-text-primary whitespace-nowrap">{m.model} · {conditionLabel(m.condition)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{m.contracts}</td>
                <td className="px-4 py-2 text-right tabular-nums">{m.active}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatCurrencyBRL(m.contracted)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatCurrencyBRL(m.received)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{m.serviceRequests}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const CareDashboardTab: React.FC = () => {
  const [period, setPeriod] = useState<Period>('30d');
  const range = useMemo(() => periodRange(period), [period]);
  const query = useCareQuery(() => fetchCareDashboard(range.from, range.to), [range.from, range.to]);

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Período" className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={period === p.key}
            onClick={() => setPeriod(p.key)}
            className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${period === p.key ? 'bg-brand-500 text-white' : 'app-surface-soft app-text-secondary'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {query.loading && !query.data && <CareLoading rows={4} />}
      {query.error && <CareLoadError message={query.error} onRetry={query.reload} />}
      {query.data && (
        <>
          <KpiGrid d={query.data} />
          <Portfolio d={query.data} />
          <ByModel d={query.data} />
        </>
      )}
    </div>
  );
};

export default CareDashboardTab;
