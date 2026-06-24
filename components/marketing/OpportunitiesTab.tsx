import React, { useMemo } from 'react';
import { TrendingUp, Snowflake, Target, Wallet, Banknote, Percent, Gauge } from 'lucide-react';
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
  Cell,
  ReferenceLine,
} from 'recharts';
import { useData } from '../../services/dataContext';
import { useChartTheme } from '../../hooks/useChartTheme';
import StableResponsiveContainer from '../charts/StableResponsiveContainer';
import {
  computeOpportunities,
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

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const ClassBadge: React.FC<{ classification: OpportunityClass }> = ({ classification }) => {
  const meta = CLASS_META[classification];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-ios-caption-1 font-semibold ${TONE_BADGE[meta.tone]}`}>
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  );
};

const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  headline: string;
}> = ({ icon, label, value, headline }) => (
  <div className="ios-card p-4 flex flex-col gap-1">
    <div className="flex items-center gap-2 text-gray-500 dark:text-surface-dark-500">
      {icon}
      <span className="text-ios-caption-1 uppercase tracking-wide">{label}</span>
    </div>
    <span className="text-ios-title-2 font-bold text-gray-900 dark:text-white">{value}</span>
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
      <span>Vendidos: <strong className="text-gray-700 dark:text-surface-dark-700">{m.unitsSold}</strong></span>
      <span>Sell-through: <strong className="text-gray-700 dark:text-surface-dark-700">{formatPct(m.sellThrough)}</strong></span>
      <span>Giro: <strong className="text-gray-700 dark:text-surface-dark-700">{formatDays(m.avgDaysToSell)}</strong></span>
      <span>GMROI: <strong className="text-gray-700 dark:text-surface-dark-700">{m.gmroi != null ? m.gmroi.toFixed(1) : '∞'}</strong></span>
      {m.onHandUnits > 0 && (
        <span>Em estoque: <strong className="text-gray-700 dark:text-surface-dark-700">{m.onHandUnits}</strong></span>
      )}
    </div>
  </div>
);

const OpportunitiesTab: React.FC<{ periodDays: number | null }> = ({ periodDays }) => {
  const { stock, sales } = useData();
  const chart = useChartTheme();

  const summary = useMemo(
    () => computeOpportunities(stock, sales, { periodDays }),
    [stock, sales, periodDays]
  );
  const insights = useMemo(() => selectInsights(summary), [summary]);
  const headlines = useMemo(() => summaryHeadlines(summary), [summary]);

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

  const paretoData = useMemo(() => {
    const ranked = summary.models.filter((m) => m.revenue > 0).slice(0, 10);
    const total = summary.totalRevenue || 1;
    let cum = 0;
    return ranked.map((m) => {
      cum += m.revenue;
      return { name: m.key, faturamento: Math.round(m.revenue), acumulado: Math.round((cum / total) * 100) };
    });
  }, [summary]);

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

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          icon={<Banknote size={16} />}
          label="Faturamento"
          value={formatBRL(summary.totalRevenue)}
          headline={headlines.revenue}
        />
        <KpiCard
          icon={<Percent size={16} />}
          label="Margem bruta"
          value={formatBRL(summary.totalGrossMargin)}
          headline={headlines.margin}
        />
        <KpiCard
          icon={<Gauge size={16} />}
          label="GMROI"
          value={summary.weightedGmroi != null ? summary.weightedGmroi.toFixed(2) : '—'}
          headline={headlines.gmroi}
        />
        <KpiCard
          icon={<Wallet size={16} />}
          label="Capital parado"
          value={formatBRL(summary.deadStockCapital || summary.idleCapital)}
          headline={headlines.idle}
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
        <h2 className="text-ios-headline font-bold text-gray-900 dark:text-white">Matriz Velocidade × Margem</h2>
        <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500">
          Quadrante superior-direito = investir. Inferior-esquerdo = liquidar. Tamanho da bolha = capital em estoque.
        </p>
        <div className="h-72 w-full">
          <StableResponsiveContainer>
            <ScatterChart margin={{ top: 10, right: 16, bottom: 16, left: 0 }}>
              <CartesianGrid stroke={chart.gridColor} />
              <XAxis
                type="number"
                dataKey="x"
                name="Velocidade"
                stroke={chart.axisColor}
                tick={{ fill: chart.axisColor, fontSize: 11 }}
                label={{ value: 'Velocidade (un/mês)', position: 'insideBottom', offset: -8, fill: chart.axisColor, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Margem"
                unit="%"
                stroke={chart.axisColor}
                tick={{ fill: chart.axisColor, fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="z" range={[60, 400]} name="Capital" />
              <ReferenceLine x={medVel} stroke={chart.axisColor} strokeDasharray="4 4" />
              <ReferenceLine y={medMargin} stroke={chart.axisColor} strokeDasharray="4 4" />
              <Tooltip
                contentStyle={chart.tooltipContentStyle}
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value: number | string, name: string) => {
                  if (name === 'Margem') return [`${value}%`, name];
                  if (name === 'Capital') return [formatBRL(Number(value)), 'Capital em estoque'];
                  if (name === 'Velocidade') return [`${value} un/mês`, name];
                  return [value, name];
                }}
                labelFormatter={() => ''}
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
          <h2 className="text-ios-headline font-bold text-gray-900 dark:text-white">Curva ABC (Pareto de faturamento)</h2>
          <p className="text-ios-caption-1 text-gray-500 dark:text-surface-dark-500">
            Poucos modelos concentram a maior parte do faturamento. Priorize quem está à esquerda da curva.
          </p>
          <div className="h-72 w-full">
            <StableResponsiveContainer>
              <ComposedChart data={paretoData} margin={{ top: 10, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid stroke={chart.gridColor} vertical={false} />
                <XAxis dataKey="name" stroke={chart.axisColor} tick={{ fill: chart.axisColor, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={56} />
                <YAxis yAxisId="left" stroke={chart.axisColor} tick={{ fill: chart.axisColor, fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" stroke={chart.axisColor} tick={{ fill: chart.axisColor, fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={chart.tooltipContentStyle}
                  formatter={(value: number | string, name: string) =>
                    name === 'acumulado' ? [`${value}%`, 'Acumulado'] : [formatBRL(Number(value)), 'Faturamento']
                  }
                />
                <Bar yAxisId="left" dataKey="faturamento" fill={chart.seriesPrimary} radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="acumulado" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
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
            Ordenado por faturamento no período. ABC, giro e GMROI lado a lado.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-ios-footnote">
            <thead>
              <tr className="text-ios-caption-1 text-gray-500 border-b border-gray-200 dark:border-surface-dark-200 bg-gray-50 dark:bg-surface-dark-200">
                <th className="p-3 font-medium">Modelo</th>
                <th className="p-3 font-medium text-center">ABC</th>
                <th className="p-3 font-medium text-right">Vendidos</th>
                <th className="p-3 font-medium text-right">Sell-through</th>
                <th className="p-3 font-medium text-right">Giro</th>
                <th className="p-3 font-medium text-right">GMROI</th>
                <th className="p-3 font-medium text-right">Estoque</th>
                <th className="p-3 font-medium text-right">Idade méd.</th>
                <th className="p-3 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-200">
              {summary.models.map((m) => (
                <tr key={m.key} className="hover:bg-gray-50 dark:hover:bg-surface-dark-200/50 transition-colors">
                  <td className="p-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{m.key}</td>
                  <td className="p-3 text-center text-gray-600 dark:text-surface-dark-600">{m.abc}</td>
                  <td className="p-3 text-right text-gray-700 dark:text-surface-dark-700">{m.unitsSold}</td>
                  <td className="p-3 text-right text-gray-700 dark:text-surface-dark-700">{formatPct(m.sellThrough)}</td>
                  <td className="p-3 text-right text-gray-700 dark:text-surface-dark-700">{formatDays(m.avgDaysToSell)}</td>
                  <td className="p-3 text-right text-gray-700 dark:text-surface-dark-700">{m.gmroi != null ? m.gmroi.toFixed(1) : '∞'}</td>
                  <td className="p-3 text-right text-gray-700 dark:text-surface-dark-700">{m.onHandUnits}</td>
                  <td className="p-3 text-right text-gray-700 dark:text-surface-dark-700">{formatDays(m.avgAgeDays)}</td>
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
