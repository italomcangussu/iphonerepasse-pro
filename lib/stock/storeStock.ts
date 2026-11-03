import { StockStatus } from '../../types';
import type { StockItem } from '../../types';
import { toFiniteNumber } from '../../utils/number';

// Aparelho que ainda é da loja: vendido e "Em Uso" já saíram do estoque de venda.
// Reservado continua contando porque a venda só acontece (ou não) depois.
const IN_STORE_STATUSES: ReadonlySet<StockStatus> = new Set([
  StockStatus.AVAILABLE,
  StockStatus.PREPARATION,
  StockStatus.RESERVED,
]);

export const isInStoreStock = (item: Pick<StockItem, 'status'>): boolean =>
  IN_STORE_STATUSES.has(item.status);

export interface StoreStockSummary {
  count: number;
  value: number;
}

export const summarizeStoreStock = (stock: StockItem[], storeId: string): StoreStockSummary => {
  const inStore = stock.filter((item) => item.storeId === storeId && isInStoreStock(item));
  const value = inStore.reduce((acc, item) => acc + toFiniteNumber(item.sellPrice), 0);
  return { count: inStore.length, value };
};
