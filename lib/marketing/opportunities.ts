import { StockItem, StockStatus, Sale } from '../../types';

/**
 * "Oportunidades" — motor de estatísticas comerciais da aba Marketing.
 *
 * Lógica PURA (sem React) para ser unitariamente testável. Recebe o estoque
 * atual + o histórico de vendas e devolve, por modelo (grão = modelo+capacidade),
 * as métricas que dizem à loja ONDE INVESTIR e O QUE ESTÁ ENCALHADO.
 *
 * As fórmulas seguem padrões consagrados de merchandising/varejo:
 *  - GMROI (Gross Margin Return on Inventory Investment) = margem bruta ÷ custo
 *    médio do estoque. É a métrica de "onde investir": benchmark ≥ 3 excelente,
 *    > 1 lucrativo, < 1 perde dinheiro.
 *    https://www.shopify.com/blog/gmroi
 *  - Sell-through = vendidos ÷ (vendidos + em estoque): demanda vs. oferta.
 *  - DSI / giro = dias entre entrada (entryDate) e a venda; saudável ~60–90 dias.
 *    https://www.finaleinventory.com/inventory-planning-software/days-sales-in-inventory
 *  - Aging / dead stock: 0–30 / 31–60 / 61–90 / 91–180 / 180+ (encalhe).
 *    https://www.shopify.com/blog/inventory-aging-report
 *  - Curva ABC / Pareto (80/20): contribuição de faturamento por modelo.
 *  - Matriz Velocidade × Margem (adaptação BCG): investir / manter / renegociar / liquidar.
 */

/** Estoque parado além disto é considerado encalhe (dead stock) no varejo. */
export const DEAD_STOCK_DAYS = 180;
/** A partir daqui o capital já merece atenção (giro saudável é ~60–90 dias). */
export const AGING_WARNING_DAYS = 90;
/** GMROI ≥ isto = retorno excelente sobre o capital de estoque. */
export const GMROI_EXCELLENT = 3;
/** GMROI > isto = estoque lucrativo; abaixo de 1 a loja perde dinheiro. */
export const GMROI_PROFITABLE = 1;
/** Curva ABC: A acumula até 80% do faturamento, B até 95%, C o resto. */
export const ABC_A_THRESHOLD = 0.8;
export const ABC_B_THRESHOLD = 0.95;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Status que ainda contam como estoque em mãos (capital imobilizado). */
const ON_HAND_STATUSES: ReadonlySet<StockStatus> = new Set([
  StockStatus.AVAILABLE,
  StockStatus.RESERVED,
  StockStatus.PREPARATION,
]);

export type OpportunityClass = 'invest' | 'keep' | 'renegotiate' | 'liquidate';
export type AbcClass = 'A' | 'B' | 'C';

export interface AgingBuckets {
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d91_180: number;
  d180plus: number;
}

export interface ModelOpportunity {
  key: string;
  model: string;
  capacity: string;
  type: string;
  // Lado vendido (no período)
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossMargin: number;
  marginPct: number; // 0..1
  avgDaysToSell: number | null; // giro
  velocityPerMonth: number;
  // Lado em estoque (snapshot atual)
  onHandUnits: number;
  reservedUnits: number;
  onHandCost: number; // capital imobilizado
  avgAgeDays: number | null;
  agingBuckets: AgingBuckets;
  deadStockUnits: number;
  deadStockCost: number;
  // Derivadas
  sellThrough: number; // 0..1
  gmroi: number | null; // null = vendeu tudo (sem estoque para dividir)
  soldOut: boolean;
  classification: OpportunityClass;
  abc: AbcClass;
}

export interface OpportunitiesSummary {
  models: ModelOpportunity[];
  totalRevenue: number;
  totalGrossMargin: number;
  avgMarginPct: number; // ponderado por faturamento
  weightedGmroi: number | null; // GMROI agregado (margem total ÷ custo total em estoque)
  onHandCost: number;
  idleCapital: number; // custo do estoque parado há mais de AGING_WARNING_DAYS
  deadStockCapital: number; // custo do estoque parado há mais de DEAD_STOCK_DAYS
  periodDays: number | null;
}

export interface OpportunitiesOptions {
  /** Janela (em dias) para o lado VENDIDO. null = todo o histórico. */
  periodDays?: number | null;
  /** Injeção de relógio para testes determinísticos. */
  now?: Date;
}

/** Custo unitário = preço de compra + custos extras (peças, frete, etc.). */
export function itemUnitCost(item: StockItem): number {
  const extra = (item.costs ?? []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  return (Number(item.purchasePrice) || 0) + extra;
}

function daysBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / MS_PER_DAY;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function groupKey(model: string, capacity: string): string {
  return `${(model || '—').trim()} ${(capacity || '').trim()}`.trim();
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function emptyBuckets(): AgingBuckets {
  return { d0_30: 0, d31_60: 0, d61_90: 0, d91_180: 0, d180plus: 0 };
}

interface Accumulator {
  model: string;
  capacity: string;
  type: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  daysToSellSum: number;
  daysToSellCount: number;
  onHandUnits: number;
  reservedUnits: number;
  onHandCost: number;
  ageSum: number;
  ageCount: number;
  agingBuckets: AgingBuckets;
  deadStockUnits: number;
  deadStockCost: number;
}

function blankAcc(item: { model: string; capacity: string; type: string }): Accumulator {
  return {
    model: item.model || '—',
    capacity: item.capacity || '',
    type: item.type || '',
    unitsSold: 0,
    revenue: 0,
    cogs: 0,
    daysToSellSum: 0,
    daysToSellCount: 0,
    onHandUnits: 0,
    reservedUnits: 0,
    onHandCost: 0,
    ageSum: 0,
    ageCount: 0,
    agingBuckets: emptyBuckets(),
    deadStockUnits: 0,
    deadStockCost: 0,
  };
}

function addAging(buckets: AgingBuckets, ageDays: number): void {
  if (ageDays <= 30) buckets.d0_30 += 1;
  else if (ageDays <= 60) buckets.d31_60 += 1;
  else if (ageDays <= 90) buckets.d61_90 += 1;
  else if (ageDays <= DEAD_STOCK_DAYS) buckets.d91_180 += 1;
  else buckets.d180plus += 1;
}

/**
 * Calcula todas as métricas de oportunidade por modelo + um resumo agregado.
 * As decisões da matriz (investir/manter/renegociar/liquidar) usam MEDIANAS
 * adaptativas de velocidade e margem — por isso "mudam conforme os dados" —
 * combinadas com o benchmark absoluto de aging (dead stock).
 */
export function computeOpportunities(
  stock: StockItem[],
  sales: Sale[],
  options: OpportunitiesOptions = {}
): OpportunitiesSummary {
  const now = options.now ?? new Date();
  const periodDays = options.periodDays ?? null;
  const cutoff = periodDays != null ? new Date(now.getTime() - periodDays * MS_PER_DAY) : null;

  const acc = new Map<string, Accumulator>();
  const ensure = (item: { model: string; capacity: string; type: string }): Accumulator => {
    const key = groupKey(item.model, item.capacity);
    let a = acc.get(key);
    if (!a) {
      a = blankAcc(item);
      acc.set(key, a);
    }
    return a;
  };

  // --- Lado vendido (histórico de vendas, filtrado pelo período) ---
  let earliestSale: Date | null = null;
  for (const sale of sales) {
    const saleDate = parseDate(sale.date);
    if (!saleDate) continue;
    if (cutoff && saleDate < cutoff) continue;
    if (!earliestSale || saleDate < earliestSale) earliestSale = saleDate;

    for (const item of sale.items ?? []) {
      const a = ensure(item);
      const cost = itemUnitCost(item);
      const revenue = Number(item.sellPrice) || 0;
      a.unitsSold += 1;
      a.revenue += revenue;
      a.cogs += cost;
      const entry = parseDate(item.entryDate);
      if (entry) {
        const dts = daysBetween(saleDate, entry);
        if (dts >= 0) {
          a.daysToSellSum += dts;
          a.daysToSellCount += 1;
        }
      }
    }
  }

  // --- Lado em estoque (snapshot atual) ---
  for (const item of stock) {
    if (!ON_HAND_STATUSES.has(item.status)) continue;
    const a = ensure(item);
    const cost = itemUnitCost(item);
    a.onHandUnits += 1;
    a.onHandCost += cost;
    if (item.status === StockStatus.RESERVED) a.reservedUnits += 1;
    const entry = parseDate(item.entryDate);
    if (entry) {
      const age = Math.max(0, daysBetween(now, entry));
      a.ageSum += age;
      a.ageCount += 1;
      addAging(a.agingBuckets, age);
      if (age > DEAD_STOCK_DAYS) {
        a.deadStockUnits += 1;
        a.deadStockCost += cost;
      }
    }
  }

  // Período efetivo (para velocidade): janela explícita, ou do 1º registro até agora.
  const effectiveDays = periodDays != null
    ? Math.max(1, periodDays)
    : Math.max(1, earliestSale ? daysBetween(now, earliestSale) : 30);

  // --- Materializa métricas por modelo ---
  const models: ModelOpportunity[] = Array.from(acc.entries()).map(([key, a]) => {
    const grossMargin = a.revenue - a.cogs;
    const marginPct = a.revenue > 0 ? grossMargin / a.revenue : 0;
    const avgDaysToSell = a.daysToSellCount > 0 ? a.daysToSellSum / a.daysToSellCount : null;
    const avgAgeDays = a.ageCount > 0 ? a.ageSum / a.ageCount : null;
    const denom = a.unitsSold + a.onHandUnits;
    const sellThrough = denom > 0 ? a.unitsSold / denom : 0;
    const soldOut = a.onHandUnits === 0 && a.unitsSold > 0;
    // GMROI = margem bruta ÷ custo médio do estoque (proxy: custo atual em mãos).
    const gmroi = a.onHandCost > 0 ? grossMargin / a.onHandCost : null;
    const velocityPerMonth = a.unitsSold / (effectiveDays / 30);

    return {
      key,
      model: a.model,
      capacity: a.capacity,
      type: a.type,
      unitsSold: a.unitsSold,
      revenue: a.revenue,
      cogs: a.cogs,
      grossMargin,
      marginPct,
      avgDaysToSell,
      velocityPerMonth,
      onHandUnits: a.onHandUnits,
      reservedUnits: a.reservedUnits,
      onHandCost: a.onHandCost,
      avgAgeDays,
      agingBuckets: a.agingBuckets,
      deadStockUnits: a.deadStockUnits,
      deadStockCost: a.deadStockCost,
      sellThrough,
      gmroi,
      soldOut,
      classification: 'keep' as OpportunityClass, // preenchido abaixo (precisa das medianas)
      abc: 'C' as AbcClass, // idem
    };
  });

  // --- Classificação na matriz (medianas adaptativas + override de encalhe) ---
  const medVelocity = median(models.map((m) => m.velocityPerMonth));
  const medMargin = median(models.filter((m) => m.unitsSold > 0).map((m) => m.marginPct));
  for (const m of models) {
    m.classification = classify(m, medVelocity, medMargin);
  }

  // --- Curva ABC (Pareto por faturamento) ---
  const ranked = [...models].sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = ranked.reduce((s, m) => s + m.revenue, 0);
  let cumulative = 0;
  for (const m of ranked) {
    if (totalRevenue <= 0) {
      m.abc = 'C';
      continue;
    }
    cumulative += m.revenue;
    const share = cumulative / totalRevenue;
    m.abc = share <= ABC_A_THRESHOLD ? 'A' : share <= ABC_B_THRESHOLD ? 'B' : 'C';
  }

  // --- Resumo agregado ---
  const totalGrossMargin = models.reduce((s, m) => s + m.grossMargin, 0);
  const onHandCost = models.reduce((s, m) => s + m.onHandCost, 0);
  const avgMarginPct = totalRevenue > 0 ? totalGrossMargin / totalRevenue : 0;
  const weightedGmroi = onHandCost > 0 ? totalGrossMargin / onHandCost : null;
  const deadStockCapital = models.reduce((s, m) => s + m.deadStockCost, 0);
  const idleCapital = models.reduce((s, m) => {
    // estoque parado além do alerta (inclui o dead stock).
    const aging = m.agingBuckets;
    const idleUnits = aging.d91_180 + aging.d180plus;
    if (idleUnits === 0 || m.onHandUnits === 0) return s;
    // custo médio por unidade em mãos × unidades paradas (aproximação).
    const perUnit = m.onHandCost / m.onHandUnits;
    return s + perUnit * idleUnits;
  }, 0);

  return {
    models: ranked,
    totalRevenue,
    totalGrossMargin,
    avgMarginPct,
    weightedGmroi,
    onHandCost,
    idleCapital,
    deadStockCapital,
    periodDays,
  };
}

function classify(m: ModelOpportunity, medVelocity: number, medMargin: number): OpportunityClass {
  // Vendeu tudo e ainda há procura → claramente investir (oferta < demanda).
  if (m.soldOut) return 'invest';
  // Encalhe duro: parado além do dead stock e girando devagar → liquidar.
  if (m.avgAgeDays != null && m.avgAgeDays > DEAD_STOCK_DAYS && m.velocityPerMonth <= medVelocity) {
    return 'liquidate';
  }
  const highVelocity = m.velocityPerMonth >= medVelocity && m.sellThrough >= 0.5;
  const highMargin = m.marginPct >= medMargin;
  if (highVelocity && highMargin) return 'invest';
  if (!highVelocity && highMargin) return 'keep';
  if (highVelocity && !highMargin) return 'renegotiate';
  return 'liquidate';
}
