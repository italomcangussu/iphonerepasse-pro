import { describe, it, expect } from 'vitest';
import { buildSalesReport, summarizeSalesReport, toSalesReportRow } from './salesReport';
import type { Sale } from '../../types';

const sale = (overrides: Partial<Sale> = {}): Sale =>
  ({
    id: 's1',
    date: '2026-10-01T12:00:00.000Z',
    total: 2000,
    tradeInValue: 1000,
    commission: 100,
    items: [{ model: 'iPhone 13', purchasePrice: 1500, costs: [{ amount: 200 }] }],
    paymentMethods: [{ amount: 2000, customerAmount: 2100, feeAmount: 100 }],
    ...overrides
  }) as unknown as Sale;

describe('toSalesReportRow', () => {
  it('counts the trade-in as revenue and subtracts cost of goods and commission from profit', () => {
    const row = toSalesReportRow(sale());
    expect(row.total).toBe(3000);
    expect(row.costOfGoods).toBe(1700);
    expect(row.profit).toBe(1200);
    expect(row.cardSurcharge).toBe(100);
    expect(row.customerChargedTotal).toBe(3100);
  });

  it('survives missing items and payments', () => {
    const row = toSalesReportRow(sale({ items: undefined, paymentMethods: undefined, tradeInValue: undefined } as Partial<Sale>));
    expect(row.items).toEqual([]);
    expect(row.costOfGoods).toBe(0);
    expect(row.customerChargedTotal).toBe(0);
  });
});

describe('buildSalesReport', () => {
  it('keeps sales in the period, newest first, and sums the KPIs', () => {
    const rows = buildSalesReport(
      [sale({ id: 'old', date: '2026-01-01T00:00:00.000Z' }), sale({ id: 'new', date: '2026-10-02T00:00:00.000Z' }), sale({ id: 'out', date: '2025-01-01T00:00:00.000Z' })],
      (date) => date.startsWith('2026')
    );
    expect(rows.map((row) => row.id)).toEqual(['new', 'old']);
    expect(summarizeSalesReport(rows)).toMatchObject({ count: 2, revenue: 6000, profit: 2400 });
  });
});
