import { describe, it, expect } from 'vitest';
import { itemAcquisitionCost, computeInventoryValuation } from './inventoryValuation';
import type { StockItem } from '../types';

// The valuation functions only read purchasePrice, costs[].amount and sellPrice,
// so tests build minimal items and cast to StockItem.
const item = (partial: Partial<StockItem>): StockItem => partial as StockItem;

describe('itemAcquisitionCost', () => {
  it('adds purchase price and repair costs', () => {
    expect(itemAcquisitionCost(item({ purchasePrice: 1000, costs: [{ amount: 150 } as any, { amount: 50 } as any] }))).toBe(1200);
  });

  it('treats missing/invalid costs as zero', () => {
    expect(itemAcquisitionCost(item({ purchasePrice: 500, costs: undefined as any }))).toBe(500);
    expect(itemAcquisitionCost(item({ purchasePrice: 500, costs: [{ amount: 'oops' } as any] }))).toBe(500);
  });

  it('coerces a non-numeric purchase price to zero', () => {
    expect(itemAcquisitionCost(item({ purchasePrice: undefined as any, costs: [{ amount: 75 } as any] }))).toBe(75);
  });
});

describe('computeInventoryValuation', () => {
  it('aggregates count, acquisition cost and sales value', () => {
    const items = [
      item({ purchasePrice: 1000, costs: [{ amount: 100 } as any], sellPrice: 1500 }),
      item({ purchasePrice: 800, costs: [], sellPrice: 1200 }),
    ];
    expect(computeInventoryValuation(items)).toEqual({
      count: 2,
      acquisitionCost: 1900, // (1000+100) + (800+0)
      salesValue: 2700, // 1500 + 1200
    });
  });

  it('returns zeros for an empty list', () => {
    expect(computeInventoryValuation([])).toEqual({ count: 0, acquisitionCost: 0, salesValue: 0 });
  });

  it('is resilient to invalid numbers', () => {
    const items = [item({ purchasePrice: 'x' as any, costs: undefined as any, sellPrice: null as any })];
    expect(computeInventoryValuation(items)).toEqual({ count: 1, acquisitionCost: 0, salesValue: 0 });
  });
});
