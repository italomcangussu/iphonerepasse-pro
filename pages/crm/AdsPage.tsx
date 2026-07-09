import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  ChevronRight,
  ExternalLink,
  ImageOff,
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
  creative_image_url?: string | null;
  creative_source_url?: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_attribution_at: string | null;
  attributions: number;
  leads: number;
  customers: number;
  real_customers?: number;
  revenue: number;
  direct_revenue?: number;
  fallback_revenue?: number;
  conversion_rate: number;
  assisted_conversion_rate?: number;
  real_conversion_rate?: number;
  score: number;
  grade: string;
  is_active: boolean;
  conversions?: AdsConversion[];
};

type AdsConversion = {
  lead_id: string;
  lead_name: string | null;
  lead_phone: string | null;
  lead_stage: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  sale_id: string;
  sale_store_id?: string | null;
  sale_number: number | null;
  sale_total: number;
  sale_date: string | null;
  items_count: number;
  product_models: string[] | null;
  conversion_source: string;
};

type AdsSummary = {
  active_campaigns: number;
  total_campaigns: number;
  total_leads: number;
  total_customers: number;
  real_customers?: number;
  total_revenue: number;
  direct_revenue?: number;
  fallback_revenue?: number;
  conversion_rate: number;
  assisted_conversion_rate?: number;
  real_conversion_rate?: number;
};

const DEFAULT_SUMMARY: AdsSummary = {
  active_campaigns: 0,
  total_campaigns: 0,
  total_leads: 0,
  total_customers: 0,
  real_customers: 0,
  total_revenue: 0,
  direct_revenue: 0,
  fallback_revenue: 0,
  conversion_rate: 0,
  assisted_conversion_rate: 0,
  real_conversion_rate: 0,
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

const conversionSourceLabel = (source: string | null | undefined) => {
  if (source === "direct_sale") return "Venda atribuida diretamente";
  if (source === "customer_id_sale") return "Venda pelo cliente vinculado";
  if (source === "phone_customer_sale") return "Venda pelo telefone do lead";
  return "Venda real confirmada";
};

const isLikelyImageUrl = (value: string | null | undefined) => {
  const url = String(value || "").trim().toLowerCase();
  if (!url) return false;
  if (!/^https?:\/\//.test(url)) return false;
  return !/(instagram\.com\/(p|reel|stories)\/|facebook\.com\/|fb\.watch|wa\.me\/)/.test(url);
};

const isHttpUrl = (value: string | null | undefined) => /^https?:\/\//i.test(String(value || "").trim());

const campaignNameFromUrl = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!isHttpUrl(raw)) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    const token = url.pathname.split("/").filter(Boolean).pop();
    if (host.includes("instagram.com")) return token ? `Post Instagram · ${token}` : "Post Instagram";
    if (host.includes("facebook.com")) return token ? `Post Facebook · ${token}` : "Post Facebook";
    return token ? `Anuncio · ${token}` : "Anuncio";
  } catch {
    return "Anuncio";
  }
};

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
    label: "Clientes com compra",
    Icon: ShoppingBag,
    iconClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300",
    valueClass: "text-emerald-700 dark:text-emerald-300",
    format: (_v, s) => Number(s.real_customers ?? s.total_customers ?? 0).toLocaleString("pt-BR"),
    sub: (s) => `${Number(s.total_customers || 0).toLocaleString("pt-BR")} com sinal total`,
  },
  {
    key: "conversion_rate",
    label: "Conversao real",
    Icon: TrendingUp,
    iconClass: "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-300",
    valueClass: "text-violet-700 dark:text-violet-300",
    format: (_v, s) => formatPercent(Number(s.real_conversion_rate ?? s.conversion_rate ?? 0)),
    sub: (s) => `${formatPercent(Number(s.assisted_conversion_rate ?? s.conversion_rate ?? 0))} com sinais`,
  },
  {
    key: "total_revenue",
    label: "Receita real",
    Icon: Banknote,
    iconClass: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
    valueClass: "text-brand-700 dark:text-brand-300",
    format: (_v, s) => formatCurrency(Number(s.direct_revenue ?? s.total_revenue ?? 0)),
    sub: (s) => Number(s.fallback_revenue || 0) > 0 ? `${formatCurrency(Number(s.fallback_revenue || 0))} em sinal legado` : "Somente vendas ligadas",
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
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());

  const loadDashboard = async () => {
    if (!selectedStoreId) return;
    await run(async () => {
      const data = assertNoError(await supabase.rpc("get_crm_ads_dashboard", {
        p_store_id: selectedStoreId,
      }));
      const nextGroups = Array.isArray(data?.groups) ? (data.groups as AdsGroup[]) : [];
      setGroups(nextGroups);
      setSummary({ ...DEFAULT_SUMMARY, ...(data?.summary || {}) });
      setSelectedGroupKey((current) => current && nextGroups.some((group) => group.group_key === current) ? current : nextGroups[0]?.group_key ?? null);
    }, { errorMsg: "Falha ao carregar dashboard de Ads.", setLoading });
  };

  useEffect(() => {
    void loadDashboard();
  }, [selectedStoreId]);

  const visibleGroups = useMemo(() => {
    const filtered = activeOnly ? groups.filter((g) => g.is_active) : groups;
    return [...filtered].sort((a, b) => Number(b[sortKey] || 0) - Number(a[sortKey] || 0));
  }, [groups, sortKey, activeOnly]);

  const selectedGroup = useMemo(() => (
    groups.find((group) => group.group_key === selectedGroupKey) || visibleGroups[0] || null
  ), [groups, selectedGroupKey, visibleGroups]);

  const campaignName = (group: AdsGroup) => {
    const rawName = group.auto_name || group.sample_title || group.creative_source_url || group.sample_source_url;
    return campaignNameFromUrl(rawName) || rawName || `Campanha ${group.group_key.slice(0, 8)}`;
  };

  const conversionCount = (group: AdsGroup) => Number(group.real_customers ?? group.conversions?.length ?? 0);

  const campaignImageUrl = (group: AdsGroup) => {
    const url = group.creative_image_url || group.sample_thumbnail_url || group.sample_media_url;
    if (!isLikelyImageUrl(url)) return null;
    return failedImages.has(url) ? null : url;
  };

  const campaignSourceUrl = (group: AdsGroup) => group.creative_source_url || group.sample_source_url;

  const markImageFailed = (url: string) => {
    setFailedImages((current) => {
      const next = new Set(current);
      next.add(url);
      return next;
    });
  };

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
            const thumb = campaignImageUrl(group);
            const sourceUrl = campaignSourceUrl(group);
            const selected = selectedGroup?.group_key === group.group_key;
            return (
              <button
                key={group.group_key}
                type="button"
                onClick={() => setSelectedGroupKey(group.group_key)}
                aria-expanded={selected}
                aria-controls={`ads-campaign-detail-${group.group_key}`}
                className={`crm-card flex min-h-[44px] cursor-pointer flex-col gap-3 p-4 text-left ring-1 ring-inset transition hover:-translate-y-0.5 hover:shadow-ios26-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:translate-y-0 ${
                  selected ? "ring-brand-500 shadow-ios26-glow" : grade.ring
                }`}
              >
                {/* Header: thumb + name + grade */}
                <div className="flex items-start gap-3">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      onError={() => markImageFailed(thumb)}
                      className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                    />
                  ) : (
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                      <span className="text-sm font-black">{campaignName(group).slice(0, 1).toUpperCase()}</span>
                      {sourceUrl ? (
                        <ExternalLink size={11} className="absolute bottom-1 right-1 text-brand-600 dark:text-brand-300" />
                      ) : (
                        <ImageOff size={11} className="absolute bottom-1 right-1 text-slate-400" />
                      )}
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
                    <p className="text-lg font-black leading-none text-emerald-700 dark:text-emerald-300">{conversionCount(group)}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500/80">Vendas reais</p>
                  </div>
                  <div className="rounded-xl bg-violet-50 p-2 text-center dark:bg-violet-900/15">
                    <p className="text-lg font-black leading-none text-violet-700 dark:text-violet-300">{formatPercent(Number(group.real_conversion_rate ?? group.conversion_rate ?? 0))}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-violet-500/80">Conversao real</p>
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
                    <Banknote size={13} /> {formatCurrency(Number(group.direct_revenue ?? group.revenue ?? 0))}
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    Ver detalhes <ChevronRight size={13} />
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {!loading && selectedGroup && (
        <section
          id={`ads-campaign-detail-${selectedGroup.group_key}`}
          role="region"
          aria-label={`Detalhes da campanha ${campaignName(selectedGroup)}`}
          className="crm-card mt-4 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 gap-3">
              {campaignImageUrl(selectedGroup) ? (
                <img
                  src={campaignImageUrl(selectedGroup) || ""}
                  alt=""
                  loading="lazy"
                  onError={() => {
                    const url = campaignImageUrl(selectedGroup);
                    if (url) markImageFailed(url);
                  }}
                  className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                  <ImageOff size={18} />
                  <span className="mt-1 text-[9px] font-black uppercase tracking-wide">Sem mídia</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rastreabilidade da campanha</p>
                <h2 className="mt-1 truncate text-base font-black text-slate-900 dark:text-slate-50">{campaignName(selectedGroup)}</h2>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {conversionCount(selectedGroup)} venda(s) reais em {selectedGroup.leads} lead(s), com receita ligada de {formatCurrency(Number(selectedGroup.direct_revenue ?? 0))}.
                </p>
                {!campaignImageUrl(selectedGroup) && campaignSourceUrl(selectedGroup) && (
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Criativo visual nao recuperado; link do anuncio disponivel.
                  </p>
                )}
              </div>
            </div>
            {campaignSourceUrl(selectedGroup) && (
              <a
                href={campaignSourceUrl(selectedGroup) || undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Anuncio <ExternalLink size={14} />
              </a>
            )}
          </div>

          {selectedGroup.conversions?.length ? (
            <div className="mt-4 grid gap-3">
              {selectedGroup.conversions.map((conversion) => {
                const models = conversion.product_models?.filter(Boolean) ?? [];
                return (
                  <article key={conversion.sale_id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lead / cliente</p>
                        <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-50">{conversion.lead_name || "Lead sem nome"}</p>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Cliente: {conversion.customer_name || "Nao vinculado"} · {conversion.customer_phone || conversion.lead_phone || "Sem telefone"}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Compra real</p>
                        <p className="mt-1 text-sm font-black text-brand-700 dark:text-brand-300">
                          #{conversion.sale_number || conversion.sale_id} · {formatCurrency(Number(conversion.sale_total || 0))}
                        </p>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{formatDateTime(conversion.sale_date)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(models.length ? models : [`${conversion.items_count || 0} item(ns)`]).map((model) => (
                        <span key={model} className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                          {model}
                        </span>
                      ))}
                      <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                        {conversionSourceLabel(conversion.conversion_source)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              Ainda nao existe venda real ligada por `sales.crm_lead_id` para esta campanha.
            </div>
          )}
        </section>
      )}
    </CRMPageFrame>
  );
};

export default AdsPage;
