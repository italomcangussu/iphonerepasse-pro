import {
  ModelOpportunity,
  OpportunitiesSummary,
  OpportunityClass,
  GMROI_EXCELLENT,
  GMROI_PROFITABLE,
  DEAD_STOCK_DAYS,
} from './opportunities';

/**
 * Tradução das métricas em ARGUMENTOS de negócio (PT-BR) que mudam conforme os
 * dados. Mantém a UI burra: a página só renderiza o que estas funções decidem.
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export function formatBRL(value: number): string {
  return BRL.format(Math.round(value || 0));
}

export function formatPct(value: number): string {
  return `${Math.round((value || 0) * 100)}%`;
}

export function formatDays(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value)} dias`;
}

export const CLASS_META: Record<OpportunityClass, { label: string; tone: 'positive' | 'neutral' | 'warning' | 'negative'; emoji: string }> = {
  invest: { label: 'Investir', tone: 'positive', emoji: '🚀' },
  keep: { label: 'Manter', tone: 'neutral', emoji: '🐄' },
  renegotiate: { label: 'Renegociar compra', tone: 'warning', emoji: '🧩' },
  liquidate: { label: 'Liquidar', tone: 'negative', emoji: '🧊' },
};

export function gmroiLabel(gmroi: number | null): string {
  if (gmroi == null) return 'sem estoque';
  if (gmroi >= GMROI_EXCELLENT) return 'excelente';
  if (gmroi >= GMROI_PROFITABLE) return 'saudável';
  return 'abaixo do ideal';
}

/** Frase-argumento principal para um modelo, conforme sua classificação. */
export function buildModelArgument(m: ModelOpportunity): string {
  const name = m.key;
  const st = formatPct(m.sellThrough);
  const giro = formatDays(m.avgDaysToSell);
  const gmroi = m.gmroi != null ? m.gmroi.toFixed(1) : '∞';

  switch (m.classification) {
    case 'invest':
      if (m.soldOut) {
        return `${name}: vendeu todas as ${m.unitsSold} unidades e zerou o estoque — a procura supera a oferta. Recompre com prioridade.`;
      }
      return `${name}: sell-through de ${st}, gira em ${giro} e GMROI ${gmroi} (${gmroiLabel(m.gmroi)}). Demanda forte com boa margem — aumente o estoque.`;
    case 'keep':
      return `${name}: margem boa (${formatPct(m.marginPct)}), mas saída moderada. Mantenha o nível e use em combos/ofertas para acelerar o giro.`;
    case 'renegotiate':
      return `${name}: sai rápido (${st} de sell-through) porém com margem apertada (${formatPct(m.marginPct)}). Renegocie a compra ou ajuste o preço para ganhar mais por unidade.`;
    case 'liquidate': {
      const parado = m.deadStockUnits > 0
        ? `${m.deadStockUnits} unid. parada(s) há +${DEAD_STOCK_DAYS} dias`
        : `parado há ${formatDays(m.avgAgeDays)}`;
      return `${name}: ${parado} (${formatBRL(m.onHandCost)} imobilizados) e pouca saída. Liquide com desconto/anúncio e evite recomprar.`;
    }
  }
}

export interface InsightLists {
  invest: ModelOpportunity[];
  idle: ModelOpportunity[];
}

/**
 * Seleciona os destaques: onde investir (maior potencial) e dinheiro parado.
 * Investir: classificados como invest, priorizando GMROI/sell-through.
 * Parado: tem estoque envelhecido (dead stock ou baixa saída com capital preso).
 */
export function selectInsights(summary: OpportunitiesSummary, limit = 5): InsightLists {
  const invest = summary.models
    .filter((m) => m.classification === 'invest')
    .sort((a, b) => investScore(b) - investScore(a))
    .slice(0, limit);

  const idle = summary.models
    .filter((m) => m.onHandUnits > 0 && (m.deadStockUnits > 0 || (m.classification === 'liquidate' && m.onHandCost > 0)))
    .sort((a, b) => idleScore(b) - idleScore(a))
    .slice(0, limit);

  return { invest, idle };
}

function investScore(m: ModelOpportunity): number {
  // Vendeu tudo pesa muito; senão combina GMROI (cap p/ não explodir) + sell-through + volume.
  const gmroi = m.gmroi ?? GMROI_EXCELLENT; // soldOut ~ excelente
  return (m.soldOut ? 1000 : 0) + Math.min(gmroi, 10) * 10 + m.sellThrough * 20 + m.unitsSold;
}

function idleScore(m: ModelOpportunity): number {
  // Capital parado pesa; idade reforça.
  return m.deadStockCost * 2 + m.onHandCost + (m.avgAgeDays ?? 0);
}

/** Leitura "nerd" de cada KPI do topo, interpretando o número vs. benchmark. */
export function summaryHeadlines(summary: OpportunitiesSummary): {
  revenue: string;
  margin: string;
  gmroi: string;
  idle: string;
} {
  const gmroiText = summary.weightedGmroi == null
    ? 'Sem estoque para medir o retorno.'
    : summary.weightedGmroi >= GMROI_EXCELLENT
      ? `Excelente: cada R$ 1 em estoque devolve R$ ${summary.weightedGmroi.toFixed(2)} de margem.`
      : summary.weightedGmroi >= GMROI_PROFITABLE
        ? `Saudável: acima de 1,0 o estoque se paga (R$ ${summary.weightedGmroi.toFixed(2)} por R$ 1).`
        : `Atenção: abaixo de 1,0 o estoque não está se pagando (R$ ${summary.weightedGmroi.toFixed(2)} por R$ 1).`;

  return {
    revenue: `${summary.models.reduce((s, m) => s + m.unitsSold, 0)} aparelhos vendidos no período.`,
    margin: `Margem média de ${formatPct(summary.avgMarginPct)} sobre o faturamento.`,
    gmroi: gmroiText,
    idle: summary.deadStockCapital > 0
      ? `${formatBRL(summary.deadStockCapital)} parados há +${DEAD_STOCK_DAYS} dias (dead stock).`
      : summary.idleCapital > 0
        ? `${formatBRL(summary.idleCapital)} em estoque envelhecendo (+90 dias).`
        : 'Nenhum capital relevante parado. Estoque girando bem.',
  };
}
