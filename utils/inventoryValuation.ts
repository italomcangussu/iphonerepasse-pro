// Pure inventory valuation, extracted from pages/Finance.tsx where the same
// acquisition-cost / sales-value reduce was duplicated across the inUseStats
// and stockStats useMemos. Behavior is a faithful copy of that inline logic.

import { StockItem } from '../types';

const toFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Purchase price plus the sum of all repair/cost entries for a single item. */
export const itemAcquisitionCost = (item: StockItem): number => {
  const repairCosts = (Array.isArray(item.costs) ? item.costs : []).reduce(
    (acc, cost) => acc + toFiniteNumber(cost.amount),
    0
  );
  return toFiniteNumber(item.purchasePrice) + repairCosts;
};

export type InventoryValuation = {
  count: number;
  acquisitionCost: number;
  salesValue: number;
};

/** Aggregate count, total acquisition cost and total sell-price over a list of items. */
export const computeInventoryValuation = (items: StockItem[]): InventoryValuation => {
  const acquisitionCost = items.reduce((acc, item) => acc + itemAcquisitionCost(item), 0);
  const salesValue = items.reduce((acc, item) => acc + toFiniteNumber(item.sellPrice), 0);
  return { count: items.length, acquisitionCost, salesValue };
};
