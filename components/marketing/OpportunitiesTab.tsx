import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  Snowflake,
  Target,
  Wallet,
  Banknote,
  Percent,
  Gauge,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import {
  ScatterChart,
  Scatter,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { useData } from '../../services/dataContext';
import { useChartTheme } from '../../hooks/useChartTheme';
import StableResponsiveContainer from '../charts/StableResponsiveContainer';
import InfoTooltip from '../ui/InfoTooltip';
import {
  computeOpportunities,
  GMROI_EXCELLENT,
  GMROI_PROFITABLE,
  AGING_WARNING_DAYS,
  DEAD_STOCK_DAYS,
  type ModelOpportunity,
  type OpportunityClass,
} from '../../lib/marketing/opportunities';
import {
  buildModelArgument,
  selectInsights,
  summaryHeadlines,
  formatBRL,
  formatPct,
  formatDays,
  CLASS_META,
} from '../../lib/marketing/opportunityInsights';
import { METRIC_GLOSSARY, type MetricInfo } from '../../lib/marketing/metricGlossary';

/** Cores por classificação para os gráficos (fora do fluxo de tema do recharts). */
const CLASS_COLOR: Record<OpportunityClass, string> = {
  invest: '#22c55e',
  keep: '#64748b',
  renegotiate: '#f59e0b',
  liquidate: '#ef4444',
};

const TONE_BADGE: Record<string, string> = {
  positive: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  neutral: 'bg-gray-100 text-gray-600 dark:bg-surface-dark-200 dark:text-surface-dark-600',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  negative: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

/** Curva ABC → tom do badge (A = melhor, C = cauda). */
const ABC_TONE: Record<string, keyof typeof TONE_BADGE> = { A: 'positive', B: 'neutral', C: 'warning' };

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Conteúdo de um verbete do glossário (frase + benchmark). */
const GlossaryBody: React.FC<{ info: MetricInfo }> = ({ info }) => (
  <>
    <span className="block text-gray-700 dark:text-surface-dark-700">{info.short}</span>
    {info.benchmark && (
      <span className="mt-1 block text-gray-500 dark:text-surface-dark-500">{info.benchmark}</span>
    )}
  </>
);

/** Rótulo + "?" que explica a métrica, alimentado pelo glossário central. */
const MetricLabel: React.FC<{
  metricKey: keyof typeof METRIC_GLOSSARY;
  children: React.ReactNode;
  align?: 'start' | 'end';
}> = ({ metricKey, children, align }) => {
  const info = METRIC_GLOSSARY[metricKey];
  return (
    <span className="inline-flex items-center gap-0.5">
      {children}
      {info && (
        <InfoTooltip label={`O que é: ${String(metricKey)}`} align={align}>
          <GlossaryBody info={info} />
        </InfoTooltip>
      )}
    </span>
  );
};

const ClassBadge: React.FC<{ classification: OpportunityClass }> = ({ classification }) => {
  const meta = CLASS_META[classification];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-ios-caption-1 font-semibold ${TONE_BADGE[meta.tone]}`}>
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  );
};

const AbcBadge: React.FC<{ abc: string }> = ({ abc }) => (
  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-ios-caption-1 font-bold ${TONE_BADGE[ABC_TONE[abc] ?? 'neutral']}`}>
    {abc}
  </span>
);

/** Variação % vs. período anterior, com seta + cor + ícone (cor nunca sozinha). */
const DeltaBadge: React.FC<{ pct: number | null }> = ({ pct }) => {
  if (pct == null) return null;
  const rounded = Math.round(pct);
  const flat = rounded === 0;
  const up = rounded > 0;
  const tone = flat
    ? 'text-gray-500 dark:text-surface-dark-500'
    : up
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-ios-caption-1 font-semibold ${tone}`}>
      <Icon size={12} aria-hidden />
      {flat ? '0%' : `${up ? '+' : ''}${rounded}%`}
      <span className="sr-only">{up ? 'aumento' : flat ? 'estável' : 'queda'} vs. período anterior</span>
    </span>
  );
};

const KpiCard: React.FC<{
  icon: React.ReactNode;
  metricKey: keyof typeof METRIC_GLOSSARY;
  label: string;
  value: string;
  headline: string;
  delta?: number | null;
  alignTip?: 'start' | 'end';
}> = ({ icon, metricKey, label, value, headline, delta, alignTip }) => (
  <div className="ios-card p-4 flex flex-col gap-1">
    <div className="flex items-center gap-2 text-gray-500 dark:text-surface-dark-500">
      {icon}
      <MetricLabel metricKey={metricKey} align={alignTip}>
        <span className="text-ios-caption-1 uppercase tracking-wide">{label}</span>
      </MetricLabel>
    </div>
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="text-ios-title-2 font-bold text-gray-900 dark:text-white tabular-nums">{value}</span>
      {delta !== undefined && <DeltaBadge pct={delta} />}
    </div>
    <span className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500 leading-snug">{headline}</span>
  </div>
);

const ModelInsightCard: React.FC<{ m: ModelOpportunity }> = ({ m }) => (
  <div className="rounded-2xl border border-gray-200/70 dark:border-surface-dark-200/60 p-4 flex flex-col gap-2">
    <div className="flex items-center justify-between gap-2">
      <span className="font-semibold text-gray-900 dark:text-white">{m.key}</span>
      <ClassBadge classification={m.classification} />
    </div>
    <p className="text-ios-footnote text-gray-600 dark:text-surface-dark-600 leading-snug">
      {buildModelArgument(m)}
    </p>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-ios-caption-1 text-gray-500 dark:text-surface-dark-500">
      <span>Vendidos: <strong className="text-gray-700 dark:text-surface-dark-700 tabular-nums">{m.unitsSold}</strong></span>
      <span>Sell-through: <strong className="text-gray-700 dark:text-surface-dark-700 tabular-nums">{formatPct(m.sellThrough)}</strong></span>
      <span>Giro: <strong className="text-gray-700 dark:text-surface-dark-700 tabular-nums">{formatDays(m.avgDaysToSell)}</strong></span>
      <span>GMROI: <strong className="text-gray-700 dark:text-surface-dark-700 tabular-nums">{m.gmroi != null ? m.gmroi.toFixed(1) : '∞'}</strong></span>
      {m.onHandUnits > 0 && (
        <span>Em estoque: <strong className="text-gray-700 dark:text-surface-dark-700 tabular-nums">{m.onHandUnits}</strong></span>
      )}
    </div>
  </div>
);

/* ---------- Encoding de saúde (cor + ícone/peso, nunca só cor) ---------- */
function gmroiTone(gmroi: number | null): string {
  if (gmroi == null) return 'text-gray-400 dark:text-surface-dark-500';
  if (gmroi >= GMROI_EXCELLENT) return 'text-green-600 dark:text-green-400 font-semibold';
  if (gmroi >= GMROI_PROFITABLE) return 'text-gray-700 dark:text-surface-dark-700';
  return 'text-red-600 dark:text-red-400 font-semibold';
}
function giroTone(days: number | null): string {
  if (days == null) return 'text-gray-400 dark:text-surface-dark-500';
  if (days <= AGING_WARNING_DAYS) return 'text-green-600 dark:text-green-400';
  if (days <= DEAD_STOCK_DAYS) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400 font-semibold';
}
function ageTone(days: number | null): string {
  if (days == null) return 'text-gray-400 dark:text-surface-dark-500';
  if (days <= AGING_WARNING_DAYS) return 'text-gray-700 dark:text-surface-dark-700';
  if (days <= DEAD_STOCK_DAYS) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400 font-semibold';
}

/* ---------- Ordenação da tabela ---------- */
type SortKey = 'key' | 'abc' | 'unitsSold' | 'sellThrough' | 'avgDaysToSell' | 'gmroi' | 'onHandUnits' | 'avgAgeDays';
type SortDir = 'asc' | 'desc';

function sortValue(m: ModelOpportunity, key: SortKey): number | string {
  switch (key) {
    case 'key':
      return m.key.toLowerCase();
    case 'abc':
      return m.abc;
    case 'gmroi':
      return m.gmroi ?? Number.POSITIVE_INFINITY; // "vendeu tudo" no topo
    case 'avgDaysToSell':
      return m.avgDaysToSell ?? Number.POSITIVE_INFINITY;
    case 'avgAgeDays':
      return m.avgAgeDays ?? -1;
    default:
      return m[key];
  }
}

const OpportunitiesTab: React.FC<{ periodDays: number | null }> = ({ periodDays }) => {
  const { stock, sales } = useData();
  const chart = useChartTheme();

  const summary = useMemo(
    () => computeOpportunities(stock, sales, { periodDays }),
    [stock, sales, periodDays]
  );
  const insights = useMemo(() => selectInsights(summary), [summary]);
  const headlines = useMemo(() => summaryHeadlines(summary), [summary]);

  // Fase 4 — variação vs. período anterior (mesma janela, deslocada para trás).
  // Reúsa o motor puro: janela dupla menos a atual = a janela anterior. Só para
  // o lado VENDIDO (faturamento/margem/unidades); GMROI/capital são snapshot.
  const deltas = useMemo(() => {
    if (periodDays == null) return null; // "Tudo" não tem período anterior
    const doubled = computeOpportunities(stock, sales, { periodDays: periodDays * 2 });
    const prevRevenue = doubled.totalRevenue - summary.totalRevenue;
    const prevMargin = doubled.totalGrossMargin - summary.totalGrossMargin;
    const pct = (cur: number, prev: number): number | null =>
      prev > 0 ? ((cur - prev) / prev) * 100 : null;
    return {
      revenue: pct(summary.totalRevenue, prevRevenue),
      margin: pct(summary.totalGrossMargin, prevMargin),
    };
  }, [stock, sales, periodDays, summary]);

  const scatterData = useMemo(
    () =>
      summary.models
        .filter((m) => m.unitsSold > 0 || m.onHandUnits > 0)
        .map((m) => ({
          x: Number(m.velocityPerMonth.toFixed(2)),
          y: Math.round(m.marginPct * 100),
          z: Math.max(1, m.onHandCost),
          name: m.key,
          classification: m.classification,
        })),
    [summary]
  );
  const medVel = useMemo(() => median(scatterData.map((d) => d.x)), [scatterData]);
  const medMargin = useMemo(() => median(scatterData.map((d) => d.y)), [scatterData]);
  // Domínios explícitos para ancorar os quadrantes (ReferenceArea precisa de limites).
  const xMax = useMemo(() => Math.max(medVel, ...scatterData.map((d) => d.x), 1) * 1.05, [scatterData, medVel]);
  const yMax = useMemo(() => Math.max(medMargin, ...scatterData.map((d) => d.y), 1), [scatterData, medMargin]);
  const yMin = useMemo(() => Math.min(medMargin, ...scatterData.map((d) => d.y), 0), [scatterData, medMargin]);

  const paretoData = useMemo(() => {
    const ranked = summary.models.filter((m) => m.revenue > 0).slice(0, 10);
    const total = summary.totalRevenue || 1;
    let cum = 0;
    return ranked.map((m) => {
      cum += m.revenue;
      return { name: m.key, faturamento: Math.round(m.revenue), acumulado: Math.round((cum / total) * 100) };
    });
  }, [summary]);

  // Ordenação da tabela (default: faturamento, que já vem de computeOpportunities).
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const sortedModels = useMemo(() => {
    if (!sortKey) return summary.models;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...summary.models].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [summary.models, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'key' || key === 'abc' ? 'asc' : 'desc');
    }
  };

  const hasData = summary.models.length > 0;

  if (!hasData) {
    return (
      <div className="ios-card p-8 text-center">
        <Target size={28} className="mx-auto text-gray-400 mb-2" />
        <p className="text-ios-body text-gray-600 dark:text-surface-dark-600">
          Ainda não há vendas nem estoque suficientes para gerar oportunidades.
        </p>
        <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mt-1">
          Registre vendas no PDV e cadastre o estoque para liberar as estatísticas.
        </p>
      </div>
    );
  }

  // Cabeçalho ordenável da tabela.
  const SortHeader: React.FC<{
    label: string;
    sortKey: SortKey;
    metricKey?: keyof typeof METRIC_GLOSSARY;
    align?: 'left' | 'right' | 'center';
  }> = ({ label, sortKey: key, metricKey, align = 'right' }) => {
    const active = sortKey === key;
    const SortIcon = !active ? ChevronsUpDown : sortDir === 'asc' ? ChevronUp : ChevronDown;
    const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
    return (
      <th
        className="p-3 font-medium"
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span className={`inline-flex items-center gap-1 ${justify} w-full`}>
          <button
            type="button"
            onClick={() => toggleSort(key)}
            className={`inline-flex items-center gap-1 rounded transition-colors hover:text-gray-700 dark:hover:text-surface-dark-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? 'text-gray-900 dark:text-white' : ''}`}
          >
            {label}
            <SortIcon size={12} aria-hidden className={active ? '' : 'opacity-40'} />
          </button>
          {metricKey && (
            <InfoTooltip label={`O que é: ${label}`} align="end">
              <GlossaryBody info={METRIC_GLOSSARY[metricKey]} />
            </InfoTooltip>
          )}
        </span>
      </th>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          icon={<Banknote size={16} />}
          metricKey="revenue"
          label="Faturamento"
          value={formatBRL(summary.totalRevenue)}
          headline={headlines.revenue}
          delta={deltas?.revenue}
        />
        <KpiCard
          icon={<Percent size={16} />}
          metricKey="margin"
          label="Margem bruta"
          value={formatBRL(summary.totalGrossMargin)}
          headline={headlines.margin}
          delta={deltas?.margin}
          alignTip="end"
        />
        <KpiCard
          icon={<Gauge size={16} />}
          metricKey="gmroi"
          label="GMROI"
          value={summary.weightedGmroi != null ? summary.weightedGmroi.toFixed(2) : '—'}
          headline={headlines.gmroi}
        />
        <KpiCard
          icon={<Wallet size={16} />}
          metricKey="idle"
          label={summary.deadStockCapital > 0 ? `Parado +${DEAD_STOCK_DAYS}d` : `Parado +${AGING_WARNING_DAYS}d`}
          value={formatBRL(summary.deadStockCapital || summary.idleCapital)}
          headline={headlines.idle}
          alignTip="end"
        />
      </div>

      {/* Onde investir + Dinheiro parado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="ios-card p-4 md:p-6 space-y-3">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <TrendingUp size={18} />
            <h2 className="text-ios-headline font-bold">Onde investir</h2>
          </div>
          {insights.invest.length === 0 ? (
            <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500">
              Nenhum modelo com sinal claro de investir no período. Aumente a janela ou registre mais vendas.
            </p>
          ) : (
            insights.invest.map((m) => <ModelInsightCard key={m.key} m={m} />)
          )}
        </section>

        <section className="ios-card p-4 md:p-6 space-y-3">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Snowflake size={18} />
            <h2 className="text-ios-headline font-bold">Dinheiro parado</h2>
          </div>
          {insights.idle.length === 0 ? (
            <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500">
              Nenhum capital relevante encalhado. Estoque girando bem. 👏
            </p>
          ) : (
            insights.idle.map((m) => <ModelInsightCard key={m.key} m={m} />)
          )}
        </section>
      </div>

      {/* Matriz Velocidade × Margem */}
      <section className="ios-card p-4 md:p-6 space-y-2">
        <h2 className="text-ios-headline font-bold text-gray-900 dark:text-white inline-flex items-center gap-1">
          Matriz Velocidade × Margem
          <InfoTooltip label="Como ler a matriz Velocidade × Margem">
            Cada bolha é um modelo. Quanto mais à direita, mais rápido vende; mais alto, maior a margem.
            O tamanho da bolha é o capital parado nele. As linhas tracejadas são as medianas (o "meio" da loja).
          </InfoTooltip>
        </h2>
        <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500">
          Quadrante superior-direito = investir. Inferior-esquerdo = liquidar. Tamanho da bolha = capital em estoque.
        </p>
        <div className="h-80 w-full">
          <StableResponsiveContainer>
            <ScatterChart margin={{ top: 10, right: 16, bottom: 16, left: 0 }}>
              <CartesianGrid stroke={chart.gridColor} />
              <XAxis
                type="number"
                dataKey="x"
                name="Velocidade"
                domain={[0, Number(xMax.toFixed(2))]}
                stroke={chart.axisColor}
                tick={{ fill: chart.axisColor, fontSize: 11 }}
                label={{ value: 'Velocidade (un/mês)', position: 'insideBottom', offset: -8, fill: chart.axisColor, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Margem"
                unit="%"
                domain={[Math.floor(yMin), Math.ceil(yMax)]}
                stroke={chart.axisColor}
                tick={{ fill: chart.axisColor, fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="z" range={[60, 400]} name="Capital" />
              {/* Quadrantes anotados: investir (verde, sup-dir) e liquidar (vermelho, inf-esq).
                  `fill`/`fillOpacity` são props reais em runtime (referenceAreaDefaultProps),
                  mas o tipo exportado do recharts 3 as omite — spread+cast contorna sem perder a UI. */}
              <ReferenceArea
                {...({
                  x1: medVel,
                  x2: Number(xMax.toFixed(2)),
                  y1: medMargin,
                  y2: Math.ceil(yMax),
                  fill: '#22c55e',
                  fillOpacity: 0.06,
                  label: { value: 'Investir ↗', position: 'insideTopRight', fill: '#16a34a', fontSize: 11 },
                } as React.ComponentProps<typeof ReferenceArea>)}
              />
              <ReferenceArea
                {...({
                  x1: 0,
                  x2: medVel,
                  y1: Math.floor(yMin),
                  y2: medMargin,
                  fill: '#ef4444',
                  fillOpacity: 0.06,
                  label: { value: 'Liquidar ↙', position: 'insideBottomLeft', fill: '#dc2626', fontSize: 11 },
                } as React.ComponentProps<typeof ReferenceArea>)}
              />
              <ReferenceLine x={medVel} stroke={chart.axisColor} strokeDasharray="4 4" />
              <ReferenceLine y={medMargin} stroke={chart.axisColor} strokeDasharray="4 4" />
              <Tooltip
                contentStyle={chart.tooltipContentStyle}
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value: number | string, name: string) => {
                  if (name === 'Margem') return [`${value}%`, 'Margem'];
                  if (name === 'Capital') return [formatBRL(Number(value)), 'Capital em estoque'];
                  if (name === 'Velocidade') return [`${value} un/mês`, 'Velocidade'];
                  return [value, name];
                }}
                labelFormatter={(_, payload) =>
                  (payload && payload[0]?.payload?.name) || ''
                }
              />
              <Legend
                verticalAlign="bottom"
                height={28}
                iconType="circle"
                payload={(Object.keys(CLASS_META) as OpportunityClass[]).map((c) => ({
                  id: c,
                  value: CLASS_META[c].label,
                  type: 'circle',
                  color: CLASS_COLOR[c],
                }))}
                wrapperStyle={{ fontSize: 11, color: chart.axisColor }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((d) => (
                  <Cell key={d.name} fill={CLASS_COLOR[d.classification]} fillOpacity={0.75} />
                ))}
              </Scatter>
            </ScatterChart>
          </StableResponsiveContainer>
        </div>
      </section>

      {/* Curva ABC / Pareto */}
      {paretoData.length > 0 && (
        <section className="ios-card p-4 md:p-6 space-y-2">
          <h2 className="text-ios-headline font-bold text-gray-900 dark:text-white inline-flex items-center gap-1">
            Curva ABC (Pareto de faturamento)
            <InfoTooltip label="Como ler a Curva ABC">
              <GlossaryBody info={METRIC_GLOSSARY.abc} />
            </InfoTooltip>
          </h2>
          <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500">
            Poucos modelos concentram a maior parte do faturamento. Priorize quem está à esquerda da curva.
          </p>
          <div className="h-80 w-full">
            <StableResponsiveContainer>
              <ComposedChart data={paretoData} margin={{ top: 10, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid stroke={chart.gridColor} vertical={false} />
                <XAxis dataKey="name" stroke={chart.axisColor} tick={{ fill: chart.axisColor, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={56} />
                <YAxis yAxisId="left" stroke={chart.axisColor} tick={{ fill: chart.axisColor, fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" stroke={chart.axisColor} tick={{ fill: chart.axisColor, fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={chart.tooltipContentStyle}
                  formatter={(value: number | string, name: string) =>
                    name === '% acumulado'
                      ? [`${value}%`, '% acumulado']
                      : [formatBRL(Number(value)), 'Faturamento']
                  }
                />
                <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11, color: chart.axisColor }} />
                <Bar yAxisId="left" name="Faturamento" dataKey="faturamento" fill={chart.seriesPrimary} radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" name="% acumulado" type="monotone" dataKey="acumulado" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </StableResponsiveContainer>
          </div>
        </section>
      )}

      {/* Ranking detalhado */}
      <section className="ios-card overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-200 dark:border-surface-dark-200">
          <h2 className="text-ios-headline font-bold text-gray-900 dark:text-white">Ranking por modelo</h2>
          <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500 mt-0.5">
            Toque num cabeçalho para ordenar. ABC, giro e GMROI lado a lado; toque no “?” para entender cada coluna.
          </p>
        </div>

        {/* Mobile: cards (a tabela de 9 colunas vira rolagem horizontal às cegas) */}
        <ul className="sm:hidden divide-y divide-gray-200 dark:divide-surface-dark-200">
          {sortedModels.map((m) => (
            <li key={m.key} className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-gray-900 dark:text-white">{m.key}</span>
                <div className="flex items-center gap-2">
                  <AbcBadge abc={m.abc} />
                  <ClassBadge classification={m.classification} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-ios-caption-1 text-gray-500 dark:text-surface-dark-500">
                <span>Vendidos: <strong className="text-gray-700 dark:text-surface-dark-700 tabular-nums">{m.unitsSold}</strong></span>
                <span>Sell-through: <strong className="text-gray-700 dark:text-surface-dark-700 tabular-nums">{formatPct(m.sellThrough)}</strong></span>
                <span>Giro: <strong className={`tabular-nums ${giroTone(m.avgDaysToSell)}`}>{formatDays(m.avgDaysToSell)}</strong></span>
                <span>GMROI: <strong className={`tabular-nums ${gmroiTone(m.gmroi)}`}>{m.gmroi != null ? m.gmroi.toFixed(1) : '∞'}</strong></span>
                <span>Estoque: <strong className="text-gray-700 dark:text-surface-dark-700 tabular-nums">{m.onHandUnits}</strong></span>
                <span>Idade méd.: <strong className={`tabular-nums ${ageTone(m.avgAgeDays)}`}>{formatDays(m.avgAgeDays)}</strong></span>
              </div>
            </li>
          ))}
        </ul>

        {/* Desktop/tablet: tabela ordenável */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-ios-footnote">
            <thead>
              <tr className="text-ios-caption-1 text-gray-500 border-b border-gray-200 dark:border-surface-dark-200 bg-gray-50 dark:bg-surface-dark-200 sticky top-0 z-10">
                <SortHeader label="Modelo" sortKey="key" align="left" />
                <SortHeader label="ABC" sortKey="abc" metricKey="abc" align="center" />
                <SortHeader label="Vendidos" sortKey="unitsSold" metricKey="vendidos" />
                <SortHeader label="Sell-through" sortKey="sellThrough" metricKey="sellThrough" />
                <SortHeader label="Giro" sortKey="avgDaysToSell" metricKey="giro" />
                <SortHeader label="GMROI" sortKey="gmroi" metricKey="gmroi" />
                <SortHeader label="Estoque" sortKey="onHandUnits" metricKey="estoque" />
                <SortHeader label="Idade méd." sortKey="avgAgeDays" metricKey="age" />
                <th className="p-3 font-medium text-right">
                  <span className="inline-flex items-center gap-1 justify-end w-full">
                    Ação
                    <InfoTooltip label="O que é a coluna Ação" align="end">
                      <GlossaryBody info={METRIC_GLOSSARY.action} />
                    </InfoTooltip>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-200">
              {sortedModels.map((m) => (
                <tr key={m.key} className="hover:bg-gray-50 dark:hover:bg-surface-dark-200/50 transition-colors">
                  <td className="p-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{m.key}</td>
                  <td className="p-3 text-center"><AbcBadge abc={m.abc} /></td>
                  <td className="p-3 text-right text-gray-700 dark:text-surface-dark-700 tabular-nums">{m.unitsSold}</td>
                  <td className="p-3 text-right text-gray-700 dark:text-surface-dark-700 tabular-nums">{formatPct(m.sellThrough)}</td>
                  <td className={`p-3 text-right tabular-nums ${giroTone(m.avgDaysToSell)}`}>{formatDays(m.avgDaysToSell)}</td>
                  <td className={`p-3 text-right tabular-nums ${gmroiTone(m.gmroi)}`}>{m.gmroi != null ? m.gmroi.toFixed(1) : '∞'}</td>
                  <td className="p-3 text-right text-gray-700 dark:text-surface-dark-700 tabular-nums">{m.onHandUnits}</td>
                  <td className={`p-3 text-right tabular-nums ${ageTone(m.avgAgeDays)}`}>{formatDays(m.avgAgeDays)}</td>
                  <td className="p-3 text-right"><ClassBadge classification={m.classification} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default OpportunitiesTab;
