import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  Megaphone,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAsyncHandler } from "../../hooks/useAsyncHandler";
import { assertNoError } from "../../utils/supabase";
import CRMPageFrame from "../../components/crm/CRMPageFrame";
import { useCRMStore } from "../../components/crm/useCRMStore";

type AdsGroup = {
  group_key: string;
  auto_name: string | null;
  status: string;
  source_app: string;
  sample_title: string | null;
  sample_body: string | null;
  sample_media_url: string | null;
  sample_thumbnail_url: string | null;
  sample_source_url: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_attribution_at: string | null;
  attributions: number;
  leads: number;
  customers: number;
  revenue: number;
  conversion_rate: number;
  score: number;
  grade: string;
  is_active: boolean;
};

type AdsSummary = {
  active_campaigns: number;
  total_campaigns: number;
  total_leads: number;
  total_customers: number;
  total_revenue: number;
  conversion_rate: number;
};

const DEFAULT_SUMMARY: AdsSummary = {
  active_campaigns: 0,
  total_campaigns: 0,
  total_leads: 0,
  total_customers: 0,
  total_revenue: 0,
  conversion_rate: 0,
};

const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: "A revisar",
  approved: "Aprovada",
  ignored: "Ignorada",
  merged: "Agrupada",
};

// Grade → visual identity. 'novo' = ainda sem dados suficientes (< 3 leads).
const GRADE_STYLES: Record<string, { label: string; chip: string; ring: string }> = {
  A: { label: "A", chip: "bg-emerald-500 text-white", ring: "ring-emerald-500/30" },
  B: { label: "B", chip: "bg-lime-500 text-white", ring: "ring-lime-500/30" },
  C: { label: "C", chip: "bg-amber-500 text-white", ring: "ring-amber-500/30" },
  D: { label: "D", chip: "bg-orange-500 text-white", ring: "ring-orange-500/30" },
  E: { label: "E", chip: "bg-rose-500 text-white", ring: "ring-rose-500/30" },
  novo: { label: "Novo", chip: "bg-slate-400 text-white", ring: "ring-slate-400/20" },
};

const SCORE_BAR: Record<string, string> = {
  A: "bg-emerald-500",
  B: "bg-lime-500",
  C: "bg-amber-500",
  D: "bg-orange-500",
  E: "bg-rose-500",
  novo: "bg-slate-300 dark:bg-slate-600",
};

type SortKey = "score" | "leads" | "customers" | "revenue" | "conversion_rate";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Nota" },
  { key: "leads", label: "Leads" },
  { key: "customers", label: "Clientes" },
  { key: "conversion_rate", label: "Conversão" },
  { key: "revenue", label: "Receita" },
];

const formatCurrency = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const formatPercent = (rate: number) => `${(Number(rate || 0) * 100).toFixed(1)}%`;

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

type SummaryCard = {
  key: keyof AdsSummary;
  label: string;
  Icon: LucideIcon;
  iconClass: string;
  valueClass?: string;
  format?: (value: number, summary: AdsSummary) => string;
  sub?: (summary: AdsSummary) => string;
};

const SUMMARY_CARDS: SummaryCard[] = [
  {
    key: "active_campaigns",
    label: "Campanhas ativas",
    Icon: Megaphone,
    iconClass: "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-300",
    sub: (s) => `${s.total_campaigns} no total`,
  },
  {
    key: "total_leads",
    label: "Leads de campanhas",
    Icon: Users,
    iconClass: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300",
  },
  {
    key: "total_customers",
    label: "Clientes (compraram)",
    Icon: ShoppingBag,
    iconClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300",
    valueClass: "text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "conversion_rate",
    label: "Taxa de conversão",
    Icon: TrendingUp,
    iconClass: "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-300",
    valueClass: "text-violet-700 dark:text-violet-300",
    format: (v) => formatPercent(v),
  },
  {
    key: "total_revenue",
    label: "Receita atribuída",
    Icon: Banknote,
    iconClass: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
    valueClass: "text-brand-700 dark:text-brand-300",
    format: (v) => formatCurrency(v),
  },
];

const AdsPage: React.FC = () => {
  const run = useAsyncHandler();
  const { selectedStoreId } = useCRMStore();
  const [groups, setGroups] = useState<AdsGroup[]>([]);
  const [summary, setSummary] = useState<AdsSummary>(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [activeOnly, setActiveOnly] = useState(false);

  const loadDashboard = async () => {
    if (!selectedStoreId) return;
    await run(async () => {
      const data = assertNoError(await supabase.rpc("get_crm_ads_dashboard", {
        p_store_id: selectedStoreId,
      }));
      setGroups(Array.isArray(data?.groups) ? (data.groups as AdsGroup[]) : []);
      setSummary({ ...DEFAULT_SUMMARY, ...(data?.summary || {}) });
    }, { errorMsg: "Falha ao carregar dashboard de Ads.", setLoading });
  };

  useEffect(() => {
    void loadDashboard();
  }, [selectedStoreId]);

  const visibleGroups = useMemo(() => {
    const filtered = activeOnly ? groups.filter((g) => g.is_active) : groups;
    return [...filtered].sort((a, b) => Number(b[sortKey] || 0) - Number(a[sortKey] || 0));
  }, [groups, sortKey, activeOnly]);

  const campaignName = (group: AdsGroup) =>
    group.auto_name || group.sample_title || `Campanha ${group.group_key.slice(0, 8)}`;

  return (
    <CRMPageFrame
      title="Ads"
      description="Inteligência de campanhas Meta: leads, clientes, conversão e nota por campanha."
      actions={(
        <button type="button" className="crm-btn crm-btn-secondary" onClick={() => void loadDashboard()}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {loading ? "Carregando..." : "Atualizar"}
        </button>
      )}
    >
      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {SUMMARY_CARDS.map((card) => {
          const value = Number(summary[card.key] || 0);
          return (
            <article key={card.key} className="crm-card flex items-start gap-3 p-4">
              <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-xl ${card.iconClass}`} aria-hidden="true">
                <card.Icon size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</p>
                <p className={`mt-1 text-xl font-black leading-none ${card.valueClass ?? "text-slate-900 dark:text-slate-50"}`}>
                  {loading ? (
                    <span className="inline-block h-6 w-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" aria-label="Carregando" />
                  ) : (
                    card.format ? card.format(value, summary) : value.toLocaleString("pt-BR")
                  )}
                </p>
                {!loading && card.sub && (
                  <p className="mt-0.5 text-[11px] font-medium text-slate-400">{card.sub(summary)}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Controls */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ordenar</span>
          <div className="flex flex-wrap gap-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSortKey(opt.key)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  sortKey === opt.key
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="inline-flex items-center gap-1">
            <Activity size={13} /> Somente ativas
          </span>
        </label>
      </div>

      {/* Campaign cards */}
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="crm-card h-44 animate-pulse bg-slate-50 dark:bg-slate-800/40" />
          ))
        ) : visibleGroups.length === 0 ? (
          <div className="crm-card col-span-full flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Megaphone size={28} className="text-slate-300" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {activeOnly ? "Nenhuma campanha ativa no momento." : "Nenhuma campanha detectada ainda."}
            </p>
            <p className="max-w-sm text-xs text-slate-400">
              Campanhas aparecem aqui automaticamente quando um lead chega por um anúncio do Meta/Instagram.
            </p>
          </div>
        ) : (
          visibleGroups.map((group) => {
            const grade = GRADE_STYLES[group.grade] ?? GRADE_STYLES.novo;
            const thumb = group.sample_thumbnail_url || group.sample_media_url;
            return (
              <article
                key={group.group_key}
                className={`crm-card flex flex-col gap-3 p-4 ring-1 ring-inset ${grade.ring}`}
              >
                {/* Header: thumb + name + grade */}
                <div className="flex items-start gap-3">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                      <Megaphone size={18} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">{campaignName(group)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {SOURCE_LABELS[group.source_app] ?? group.source_app}
                      </span>
                      {group.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ativa
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:bg-slate-800">
                          {STATUS_LABELS[group.status] ?? "Inativa"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl px-2 text-sm font-black ${grade.chip}`}
                    title="Nota da campanha"
                  >
                    {grade.label}
                  </div>
                </div>

                {/* Funnel: leads → clientes */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-slate-50 p-2 text-center dark:bg-slate-800/50">
                    <p className="text-lg font-black leading-none text-slate-900 dark:text-slate-50">{group.leads}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Leads</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-2 text-center dark:bg-emerald-900/15">
                    <p className="text-lg font-black leading-none text-emerald-700 dark:text-emerald-300">{group.customers}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500/80">Clientes</p>
                  </div>
                  <div className="rounded-xl bg-violet-50 p-2 text-center dark:bg-violet-900/15">
                    <p className="text-lg font-black leading-none text-violet-700 dark:text-violet-300">{formatPercent(group.conversion_rate)}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-violet-500/80">Conversão</p>
                  </div>
                </div>

                {/* Score bar */}
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                    <span>Desempenho</span>
                    <span>{group.score}/100</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${SCORE_BAR[group.grade] ?? SCORE_BAR.novo}`}
                      style={{ width: `${Math.max(group.score, group.leads > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>

                {/* Footer: revenue + last seen */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs dark:border-slate-800">
                  <span className="inline-flex items-center gap-1 font-bold text-brand-700 dark:text-brand-300">
                    <Banknote size={13} /> {formatCurrency(group.revenue)}
                  </span>
                  <span className="text-slate-400">Visto {formatDateTime(group.last_attribution_at || group.last_seen_at)}</span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </CRMPageFrame>
  );
};

export default AdsPage;
