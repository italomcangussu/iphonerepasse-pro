import { GMROI_EXCELLENT, GMROI_PROFITABLE, AGING_WARNING_DAYS, DEAD_STOCK_DAYS } from './opportunities';

/**
 * Glossário das métricas da aba Oportunidades, em PT-BR e em linguagem de loja
 * (não de analista). Fonte ÚNICA de definições: KPIs, cabeçalhos da tabela e
 * títulos de gráficos consomem daqui, para não espalhar texto solto nem divergir.
 *
 * `short` = o que é, em uma frase. `benchmark` = como saber se está bom/ruim.
 */
export interface MetricInfo {
  /** Frase curta: o que a métrica significa. */
  short: string;
  /** Opcional: referência de "bom vs. ruim". */
  benchmark?: string;
}

export const METRIC_GLOSSARY: Record<string, MetricInfo> = {
  revenue: {
    short: 'Soma de tudo que entrou em vendas no período (preço de venda dos aparelhos).',
  },
  margin: {
    short: 'O que sobra das vendas depois de descontar o custo dos aparelhos (lucro bruto, antes das despesas da loja).',
  },
  gmroi: {
    short: 'Para cada R$ 1 parado em estoque, quanto volta de margem. É a métrica de "onde investir o dinheiro".',
    benchmark: `Acima de ${GMROI_PROFITABLE},0 o estoque se paga; a partir de ${GMROI_EXCELLENT},0 é excelente; abaixo de ${GMROI_PROFITABLE},0 perde dinheiro.`,
  },
  idle: {
    short: 'Dinheiro imobilizado em aparelhos que não giram — capital parado na prateleira.',
    benchmark: `Conta o estoque parado há mais de ${AGING_WARNING_DAYS} dias; acima de ${DEAD_STOCK_DAYS} dias vira "dead stock" (encalhe).`,
  },
  sellThrough: {
    short: 'Dos aparelhos que você teve, qual % já foi vendido. Mede demanda vs. oferta.',
    benchmark: 'Quanto mais alto, mais a procura supera a oferta — sinal de recomprar.',
  },
  giro: {
    short: 'Tempo médio entre a entrada do aparelho no estoque e a venda.',
    benchmark: `Saudável fica em torno de 60–90 dias; acima disso o capital demora a voltar.`,
  },
  velocity: {
    short: 'Quantas unidades do modelo saem por mês, em média.',
  },
  abc: {
    short: 'Curva ABC (regra 80/20): A = poucos modelos que puxam a maior parte do faturamento; C = cauda longa.',
    benchmark: 'A = até 80% do faturamento acumulado · B = até 95% · C = o resto.',
  },
  age: {
    short: 'Há quantos dias, em média, os aparelhos desse modelo estão parados em estoque agora.',
    benchmark: `Acima de ${DEAD_STOCK_DAYS} dias é encalhe (dead stock).`,
  },
  estoque: {
    short: 'Unidades em mãos agora (disponível + reservado + em preparação).',
  },
  vendidos: {
    short: 'Unidades vendidas do modelo dentro do período selecionado.',
  },
  action: {
    short: 'Recomendação automática: 🚀 Investir, 🐄 Manter, 🧩 Renegociar compra, 🧊 Liquidar — pela posição em velocidade × margem e pelo encalhe.',
  },
};
