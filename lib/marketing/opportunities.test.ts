import { describe, expect, it } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType, type StockItem, type Sale } from '../../types';
import {
  computeOpportunities,
  itemUnitCost,
  DEAD_STOCK_DAYS,
} from './opportunities';

const NOW = new Date('2026-06-24T12:00:00.000Z');

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

const sale = (items: StockItem[], date = '2026-06-20'): Sale => ({
  id: `sale-${Math.random()}`,
  customerId: 'c1',
  sellerId: 's1',
  items,
  tradeInValue: 0,
  discount: 0,
  total: items.reduce((s, i) => s + i.sellPrice, 0),
  paymentMethods: [],
  date,
  warrantyExpiresAt: null,
});

describe('itemUnitCost', () => {
  it('soma preço de compra + custos extras', () => {
    const item = stockItem({
      purchasePrice: 2000,
      costs: [
        { id: 'c1', description: 'Tela', amount: 300, date: '2026-06-09' },
        { id: 'c2', description: 'Bateria', amount: 200, date: '2026-06-10' },
      ],
    });
    expect(itemUnitCost(item)).toBe(2500);
  });
});

describe('computeOpportunities — fórmulas centrais', () => {
  // A: gira rápido, margem boa, ainda tem 1 em estoque novo.
  const soldA = [0, 1, 2, 3].map((n) =>
    stockItem({ id: `a-sold-${n}`, model: 'iPhone 13', capacity: '128 GB', purchasePrice: 2000, sellPrice: 3000, entryDate: '2026-06-08' })
  );
  const onHandA = stockItem({ id: 'a-stock', model: 'iPhone 13', capacity: '128 GB', purchasePrice: 2000, entryDate: '2026-06-14' });

  // B: nunca vende, 3 unidades paradas há ~200 dias (dead stock).
  const onHandB = [0, 1, 2].map((n) =>
    stockItem({ id: `b-stock-${n}`, model: 'iPhone XR', capacity: '64 GB', purchasePrice: 1500, sellPrice: 2200, entryDate: '2025-12-01' })
  );

  // C: vendeu tudo, zerou o estoque (soldOut).
  const soldC = [0, 1].map((n) =>
    stockItem({ id: `c-sold-${n}`, model: 'iPhone 14', capacity: '256 GB', purchasePrice: 3000, sellPrice: 4000, entryDate: '2026-06-10' })
  );

  const stock = [onHandA, ...onHandB];
  const sales = [sale(soldA), sale(soldC)];
  const summary = computeOpportunities(stock, sales, { now: NOW, periodDays: 90 });

  const byKey = (k: string) => summary.models.find((m) => m.key === k)!;

  it('agrupa por modelo + capacidade', () => {
    expect(summary.models.map((m) => m.key).sort()).toEqual(
      ['iPhone 13 128 GB', 'iPhone 14 256 GB', 'iPhone XR 64 GB'].sort()
    );
  });

  it('calcula margem, giro e sell-through do modelo A', () => {
    const a = byKey('iPhone 13 128 GB');
    expect(a.unitsSold).toBe(4);
    expect(a.revenue).toBe(12000);
    expect(a.grossMargin).toBe(4000); // 4 × (3000 − 2000)
    expect(a.marginPct).toBeCloseTo(1 / 3, 5);
    expect(a.avgDaysToSell).toBe(12); // 2026-06-20 − 2026-06-08
    expect(a.onHandUnits).toBe(1);
    expect(a.sellThrough).toBeCloseTo(0.8, 5); // 4 / (4 + 1)
  });

  it('GMROI = margem bruta ÷ custo do estoque em mãos', () => {
    const a = byKey('iPhone 13 128 GB');
    expect(a.gmroi).toBeCloseTo(4000 / 2000, 5); // 2.0
  });

  it('marca soldOut e GMROI nulo quando zerou o estoque', () => {
    const c = byKey('iPhone 14 256 GB');
    expect(c.soldOut).toBe(true);
    expect(c.onHandUnits).toBe(0);
    expect(c.gmroi).toBeNull();
    expect(c.classification).toBe('invest');
  });

  it('detecta dead stock e classifica como liquidar', () => {
    const b = byKey('iPhone XR 64 GB');
    expect(b.unitsSold).toBe(0);
    expect(b.onHandUnits).toBe(3);
    expect(b.deadStockUnits).toBe(3); // > 180 dias
    expect(b.agingBuckets.d180plus).toBe(3);
    expect(b.avgAgeDays).toBeGreaterThan(DEAD_STOCK_DAYS);
    expect(b.classification).toBe('liquidate');
  });

  it('classifica A como investir (alta velocidade + boa margem)', () => {
    expect(byKey('iPhone 13 128 GB').classification).toBe('invest');
  });

  it('curva ABC: modelo de maior faturamento é A', () => {
    expect(byKey('iPhone 13 128 GB').abc).toBe('A'); // 12000 de 20000 → 60% acumulado
  });

  it('resumo agrega faturamento, capital parado e GMROI ponderado', () => {
    expect(summary.totalRevenue).toBe(20000); // 12000 + 8000
    expect(summary.totalGrossMargin).toBe(6000); // 4000 + 2000
    expect(summary.deadStockCapital).toBe(4500); // 3 × 1500
    expect(summary.onHandCost).toBe(2000 + 4500);
    expect(summary.weightedGmroi).toBeCloseTo(6000 / 6500, 5);
  });

  it('o período filtra o lado vendido', () => {
    const old = computeOpportunities(stock, [sale(soldA, '2025-01-01'), sale(soldC)], {
      now: NOW,
      periodDays: 90,
    });
    expect(old.models.find((m) => m.key === 'iPhone 13 128 GB')?.unitsSold ?? 0).toBe(0);
    // todo o histórico inclui a venda antiga
    const all = computeOpportunities(stock, [sale(soldA, '2025-01-01'), sale(soldC)], {
      now: NOW,
      periodDays: null,
    });
    expect(all.models.find((m) => m.key === 'iPhone 13 128 GB')?.unitsSold).toBe(4);
  });
});
