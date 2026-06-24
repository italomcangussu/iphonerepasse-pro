import { describe, expect, it } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType, type Customer, type Sale, type StockItem } from '../../types';
import { computeCampaignPlan, UPGRADE_CYCLE_DAYS } from './campaigns';

const NOW = new Date('2026-06-24T12:00:00.000Z');

const customer = (id: string, name: string, overrides: Partial<Customer> = {}): Customer => ({
  id,
  name,
  cpf: '',
  phone: `1199999-${id}`,
  email: `${id}@mail.com`,
  purchases: 0,
  totalSpent: 0,
  ...overrides,
});

const stockItem = (overrides: Partial<StockItem> = {}): StockItem => ({
  id: overrides.id || `stock-${Math.random()}`,
  type: DeviceType.IPHONE,
  model: 'iPhone 13',
  color: 'Preto',
  capacity: '128 GB',
  imei: overrides.imei || `imei-${Math.random()}`,
  condition: Condition.USED,
  status: StockStatus.AVAILABLE,
  storeId: 'store-1',
  purchasePrice: 2000,
  sellPrice: 3000,
  maxDiscount: 0,
  warrantyType: WarrantyType.STORE,
  costs: [],
  photos: [],
  entryDate: '2026-06-08',
  ...overrides,
});

const sale = (
  customerId: string,
  total: number,
  date: string,
  items: StockItem[] = [stockItem()]
): Sale => ({
  id: `sale-${Math.random()}`,
  customerId,
  sellerId: 's1',
  items,
  tradeInValue: 0,
  discount: 0,
  total,
  paymentMethods: [],
  date,
  warrantyExpiresAt: null,
});

describe('computeCampaignPlan — RFM e segmentos', () => {
  const customers = [
    customer('c1', 'Ana'),
    customer('c2', 'Bruno'),
    customer('c3', 'Carla'),
    customer('c4', 'Davi'),
  ];

  const sales: Sale[] = [
    // Ana — campeã: 4 compras, alto valor, recente
    sale('c1', 3000, '2026-06-20', [stockItem({ model: 'iPhone 14', capacity: '256 GB' })]),
    sale('c1', 3000, '2026-05-20'),
    sale('c1', 3000, '2026-04-20'),
    sale('c1', 3000, '2026-03-20'),
    // Davi — em risco: 3 compras (alta freq) porém última há ~174 dias
    sale('c4', 2000, '2026-01-01'),
    sale('c4', 2000, '2025-12-01'),
    sale('c4', 2000, '2025-11-01'),
    // Carla — nova: 1 compra recente
    sale('c3', 2500, '2026-06-10'),
    // Bruno — sumido: 1 compra antiga, baixo valor
    sale('c2', 1500, '2025-10-01'),
  ];

  const plan = computeCampaignPlan(sales, customers, [], { now: NOW, periodDays: 90 });
  const byId = (id: string) => plan.customers.find((c) => c.customerId === id)!;

  it('calcula recência, frequência e valor por cliente', () => {
    const ana = byId('c1');
    expect(ana.frequency).toBe(4);
    expect(ana.monetary).toBe(12000);
    expect(ana.recencyDays).toBe(5); // 2026-06-24 12:00 − 2026-06-20 00:00 = 4,5 → arredonda 5
    expect(ana.lastModelKey).toBe('iPhone 14 256 GB');
  });

  it('segmenta a base com cortes adaptativos + recência', () => {
    expect(byId('c1').segment).toBe('champions');
    expect(byId('c4').segment).toBe('at_risk');
    expect(byId('c3').segment).toBe('new');
    expect(byId('c2').segment).toBe('dormant');
  });

  it('conta ativos × sumidos pelo corte de recência (período)', () => {
    expect(plan.activeCustomers).toBe(2); // Ana, Carla
    expect(plan.dormantCustomers).toBe(2); // Bruno, Davi
    expect(plan.recencyCutoff).toBe(90);
  });

  it('monta a lista de win-back ordenada por valor', () => {
    expect(plan.winBack.map((c) => c.customerId)).toEqual(['c4', 'c2']); // Davi (6000) antes de Bruno (1500)
  });

  it('mede a cadência de recompra (mediana dos intervalos)', () => {
    expect(plan.avgRepurchaseDays).not.toBeNull();
    expect(plan.avgRepurchaseDays!).toBeGreaterThan(25);
    expect(plan.avgRepurchaseDays!).toBeLessThan(35);
  });

  it('agrega ticket médio e LTV total da base', () => {
    expect(plan.totalCustomers).toBe(4);
    expect(plan.totalLifetimeValue).toBe(12000 + 6000 + 2500 + 1500);
    expect(plan.avgTicket).toBeCloseTo(22000 / 9, 5); // 9 compras no total
  });

  it('produz sazonalidade por mês e por dia da semana', () => {
    expect(plan.byMonth).toHaveLength(12);
    expect(plan.byWeekday).toHaveLength(7);
    const totalUnits = plan.byMonth.reduce((s, m) => s + m.units, 0);
    expect(totalUnits).toBe(9); // 9 vendas, 1 item cada
    expect(plan.bestMonth).not.toBeNull();
  });
});

describe('computeCampaignPlan — caminho de upgrade', () => {
  // Modelo que gira rápido com boa margem e ainda tem 1 em estoque → invest.
  const soldFast = [0, 1, 2, 3].map((n) =>
    stockItem({ id: `f-${n}`, model: 'iPhone 13', capacity: '128 GB', entryDate: '2026-06-08' })
  );
  const onHandFast = stockItem({ id: 'f-stock', model: 'iPhone 13', capacity: '128 GB', entryDate: '2026-06-14' });
  // Modelo encalhado (não vira alvo de upgrade).
  const stale = [0, 1, 2].map((n) =>
    stockItem({ id: `s-${n}`, model: 'iPhone XR', capacity: '64 GB', purchasePrice: 1500, sellPrice: 2200, entryDate: '2025-12-01' })
  );

  const customers = [customer('old', 'Eduardo')];
  const sales: Sale[] = [
    ...soldFast.map((it) => sale('buyerFast', 3000, '2026-06-18', [it])),
    // Eduardo comprou um XR há ~327 dias → candidato a upgrade
    sale('old', 2200, '2025-08-01', [stockItem({ model: 'iPhone XR', capacity: '64 GB' })]),
  ];

  it('sugere modelo invest em estoque para compradores antigos', () => {
    const plan = computeCampaignPlan(sales, customers, [onHandFast, ...stale], { now: NOW, periodDays: 90 });
    const eduardo = plan.upgrades.find((u) => u.customerId === 'old');
    expect(eduardo).toBeDefined();
    expect(eduardo!.recencyDays).toBeGreaterThanOrEqual(UPGRADE_CYCLE_DAYS);
    expect(eduardo!.suggestedModel).toBe('iPhone 13 128 GB');
    expect(eduardo!.suggestedModel).not.toBe(eduardo!.lastModelKey);
  });

  it('não gera upgrades quando não há modelo invest em estoque', () => {
    const plan = computeCampaignPlan(sales, customers, stale, { now: NOW, periodDays: 90 });
    expect(plan.upgrades).toHaveLength(0);
  });
});
