import { Customer, Sale, StockItem } from '../../types';
import { computeOpportunities } from './opportunities';

/**
 * "Campanhas" — motor de planejamento de campanhas da aba Marketing.
 *
 * Lógica PURA (sem React) para ser unitariamente testável. Recebe o histórico de
 * vendas + a base de clientes (+ o estoque, para o caminho de upgrade) e devolve
 * QUEM mirar e QUANDO, com argumentos que mudam conforme os dados.
 *
 * As métricas seguem frameworks clássicos de marketing/CRM:
 *  - RFM (Recency, Frequency, Monetary): modelo consagrado de database marketing
 *    para segmentar a base e priorizar reativação/recompensa. Os cortes de F e M
 *    são QUANTIS adaptativos da própria base — por isso "mudam conforme os dados".
 *    https://en.wikipedia.org/wiki/RFM_(market_research)
 *  - Win-back / clientes dormentes: recência acima de um limiar marca a base
 *    reativável (reativar custa menos que adquirir).
 *  - Ciclo de recompra: dias médios entre compras de quem comprou ≥2× → cadência.
 *  - Sazonalidade: distribuição de vendas por mês e por dia da semana → melhor
 *    janela para disparar a campanha.
 *  - Upgrade path: cruza compradores antigos com os modelos que a engine de
 *    Oportunidades classifica como `invest` (estoque que a loja quer girar).
 */

/** Recência (em dias) que define "sumido" quando não há período selecionado. */
export const DORMANT_DAYS = 120;
/** Primeira compra dentro disto = cliente novo (ainda em conquista). */
export const NEW_CUSTOMER_DAYS = 60;
/** Comprou há mais que isto → candidato a oferta de upgrade (ciclo do usado). */
export const UPGRADE_CYCLE_DAYS = 240;
/** Quantil que separa "alta" frequência/valor do resto da base. */
export const HIGH_QUANTILE = 0.66;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export type CampaignSegment =
  | 'champions'
  | 'loyal'
  | 'promising'
  | 'new'
  | 'at_risk'
  | 'dormant';

export interface CustomerRfm {
  customerId: string;
  name: string;
  phone: string;
  email: string;
  recencyDays: number;
  frequency: number;
  monetary: number;
  firstPurchaseDays: number;
  lastPurchaseDate: string;
  lastModelKey: string;
  segment: CampaignSegment;
}

export interface SegmentAgg {
  segment: CampaignSegment;
  count: number;
  totalValue: number;
  avgTicket: number;
}

export interface SeasonPoint {
  key: number;
  label: string;
  units: number;
  revenue: number;
}

export interface UpgradeTarget {
  customerId: string;
  name: string;
  phone: string;
  lastModelKey: string;
  recencyDays: number;
  monetary: number;
  suggestedModel: string;
}

export interface CampaignPlan {
  customers: CustomerRfm[];
  segments: SegmentAgg[];
  byMonth: SeasonPoint[];
  byWeekday: SeasonPoint[];
  bestMonth: SeasonPoint | null;
  bestWeekday: SeasonPoint | null;
  winBack: CustomerRfm[];
  upgrades: UpgradeTarget[];
  activeCustomers: number;
  dormantCustomers: number;
  avgTicket: number;
  avgRepurchaseDays: number | null;
  totalCustomers: number;
  totalLifetimeValue: number;
  recencyCutoff: number;
  periodDays: number | null;
}

export interface CampaignOptions {
  /** Janela (em dias) que define ativo × sumido (recência). null = DORMANT_DAYS. */
  periodDays?: number | null;
  /** Injeção de relógio para testes determinísticos. */
  now?: Date;
}

const SEGMENT_ORDER: CampaignSegment[] = ['champions', 'loyal', 'promising', 'new', 'at_risk', 'dormant'];

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.max(0, (later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

function modelKey(item: { model?: string; capacity?: string }): string {
  return `${(item.model || '—').trim()} ${(item.capacity || '').trim()}`.trim();
}

interface CustomerAcc {
  customerId: string;
  frequency: number;
  monetary: number;
  firstDate: Date;
  lastDate: Date;
  lastModelKey: string;
  saleDates: Date[];
}

/**
 * Constrói o plano de campanhas. RFM (frequência/valor) usa TODO o histórico;
 * o `periodDays` define o corte de recência (ativo × sumido) — é o controle que
 * dimensiona a lista de win-back. A sazonalidade usa todo o histórico (o sinal
 * sazonal precisa de amplitude).
 */
export function computeCampaignPlan(
  sales: Sale[],
  customers: Customer[],
  stock: StockItem[],
  options: CampaignOptions = {}
): CampaignPlan {
  const now = options.now ?? new Date();
  const periodDays = options.periodDays ?? null;
  const recencyCutoff = periodDays ?? DORMANT_DAYS;

  const customerById = new Map(customers.map((c) => [c.id, c]));

  // --- Agrega vendas por cliente (histórico completo) + sazonalidade ---
  const acc = new Map<string, CustomerAcc>();
  const monthAgg: SeasonPoint[] = MONTH_LABELS.map((label, key) => ({ key, label, units: 0, revenue: 0 }));
  const weekdayAgg: SeasonPoint[] = WEEKDAY_LABELS.map((label, key) => ({ key, label, units: 0, revenue: 0 }));

  for (const sale of sales) {
    const date = parseDate(sale.date);
    if (!date) continue;
    const units = (sale.items ?? []).length || 1;
    const revenue = Number(sale.total) || 0;
    monthAgg[date.getMonth()].units += units;
    monthAgg[date.getMonth()].revenue += revenue;
    weekdayAgg[date.getDay()].units += units;
    weekdayAgg[date.getDay()].revenue += revenue;

    const customerId = sale.customerId;
    if (!customerId) continue; // venda de balcão sem cadastro — não dá para mirar
    let a = acc.get(customerId);
    if (!a) {
      a = {
        customerId,
        frequency: 0,
        monetary: 0,
        firstDate: date,
        lastDate: date,
        lastModelKey: modelKey((sale.items ?? [])[0] ?? {}),
        saleDates: [],
      };
      acc.set(customerId, a);
    }
    a.frequency += 1;
    a.monetary += revenue;
    a.saleDates.push(date);
    if (date < a.firstDate) a.firstDate = date;
    if (date >= a.lastDate) {
      a.lastDate = date;
      a.lastModelKey = modelKey((sale.items ?? [])[0] ?? {}) || a.lastModelKey;
    }
  }

  // --- Cortes adaptativos (quantis) de frequência e valor ---
  const freqValues = Array.from(acc.values()).map((a) => a.frequency);
  const monValues = Array.from(acc.values()).map((a) => a.monetary);
  const freqHigh = Math.max(2, quantile(freqValues, HIGH_QUANTILE));
  const monHigh = quantile(monValues, HIGH_QUANTILE);

  // --- Materializa RFM + segmenta cada cliente ---
  const rfm: CustomerRfm[] = Array.from(acc.values()).map((a) => {
    const recencyDays = daysBetween(now, a.lastDate);
    const firstPurchaseDays = daysBetween(now, a.firstDate);
    const c = customerById.get(a.customerId);
    const segment = classifySegment({
      recencyDays,
      frequency: a.frequency,
      monetary: a.monetary,
      firstPurchaseDays,
      recencyCutoff,
      freqHigh,
      monHigh,
    });
    return {
      customerId: a.customerId,
      name: c?.name || 'Cliente',
      phone: c?.phone || '',
      email: c?.email || '',
      recencyDays: Math.round(recencyDays),
      frequency: a.frequency,
      monetary: a.monetary,
      firstPurchaseDays: Math.round(firstPurchaseDays),
      lastPurchaseDate: a.lastDate.toISOString().slice(0, 10),
      lastModelKey: a.lastModelKey,
      segment,
    };
  });

  // --- Agrega por segmento ---
  const segments: SegmentAgg[] = SEGMENT_ORDER.map((segment) => {
    const members = rfm.filter((r) => r.segment === segment);
    const totalValue = members.reduce((s, r) => s + r.monetary, 0);
    const purchases = members.reduce((s, r) => s + r.frequency, 0);
    return {
      segment,
      count: members.length,
      totalValue,
      avgTicket: purchases > 0 ? totalValue / purchases : 0,
    };
  }).filter((s) => s.count > 0);

  // --- Win-back: sumidos/em risco ordenados por valor ---
  const winBack = rfm
    .filter((r) => r.recencyDays > recencyCutoff && r.frequency >= 1)
    .sort((a, b) => b.monetary - a.monetary);

  // --- Upgrade: compradores antigos × modelos `invest` em estoque ---
  const opportunities = computeOpportunities(stock, sales, { now });
  const investInStock = opportunities.models
    .filter((m) => m.classification === 'invest' && m.onHandUnits > 0)
    .map((m) => m.key);
  const upgrades: UpgradeTarget[] = investInStock.length === 0
    ? []
    : rfm
        .filter((r) => r.recencyDays >= UPGRADE_CYCLE_DAYS)
        .sort((a, b) => b.monetary - a.monetary)
        .map((r) => ({
          customerId: r.customerId,
          name: r.name,
          phone: r.phone,
          lastModelKey: r.lastModelKey,
          recencyDays: r.recencyDays,
          monetary: r.monetary,
          suggestedModel: investInStock.find((k) => k !== r.lastModelKey) || investInStock[0],
        }));

  // --- Ciclo de recompra (mediana dos intervalos de quem comprou ≥2×) ---
  const gaps: number[] = [];
  for (const a of acc.values()) {
    if (a.saleDates.length < 2) continue;
    const ordered = [...a.saleDates].sort((x, y) => x.getTime() - y.getTime());
    for (let i = 1; i < ordered.length; i++) {
      gaps.push(daysBetween(ordered[i], ordered[i - 1]));
    }
  }
  const avgRepurchaseDays = gaps.length > 0 ? median(gaps) : null;

  // --- Resumo ---
  const activeCustomers = rfm.filter((r) => r.recencyDays <= recencyCutoff).length;
  const dormantCustomers = rfm.length - activeCustomers;
  const totalLifetimeValue = rfm.reduce((s, r) => s + r.monetary, 0);
  const totalPurchases = rfm.reduce((s, r) => s + r.frequency, 0);
  const avgTicket = totalPurchases > 0 ? totalLifetimeValue / totalPurchases : 0;

  const bestMonth = pickBest(monthAgg);
  const bestWeekday = pickBest(weekdayAgg);

  return {
    customers: rfm.sort((a, b) => b.monetary - a.monetary),
    segments,
    byMonth: monthAgg,
    byWeekday: weekdayAgg,
    bestMonth,
    bestWeekday,
    winBack,
    upgrades,
    activeCustomers,
    dormantCustomers,
    avgTicket,
    avgRepurchaseDays,
    totalCustomers: rfm.length,
    totalLifetimeValue,
    recencyCutoff,
    periodDays,
  };
}

function classifySegment(args: {
  recencyDays: number;
  frequency: number;
  monetary: number;
  firstPurchaseDays: number;
  recencyCutoff: number;
  freqHigh: number;
  monHigh: number;
}): CampaignSegment {
  const { recencyDays, frequency, monetary, firstPurchaseDays, recencyCutoff, freqHigh, monHigh } = args;
  const recent = recencyDays <= recencyCutoff;
  const highF = frequency >= freqHigh;
  const highM = monetary >= monHigh;
  const isNew = frequency === 1 && firstPurchaseDays <= NEW_CUSTOMER_DAYS;

  if (isNew) return 'new';
  if (recent && highF && highM) return 'champions';
  if (recent && highF) return 'loyal';
  if (recent) return 'promising';
  // Inativo a partir daqui (recencyDays > corte)
  if (highF || highM) return 'at_risk';
  return 'dormant';
}

function pickBest(points: SeasonPoint[]): SeasonPoint | null {
  let best: SeasonPoint | null = null;
  for (const p of points) {
    if (p.units === 0) continue;
    if (!best || p.units > best.units) best = p;
  }
  return best;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
