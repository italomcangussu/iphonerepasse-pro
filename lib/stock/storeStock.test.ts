import { describe, expect, it } from 'vitest';
import { StockStatus } from '../../types';
import type { StockItem } from '../../types';
import { summarizeStoreStock } from './storeStock';

const item = (storeId: string, status: StockStatus, sellPrice: number) =>
  ({ id: `${storeId}-${status}-${sellPrice}`, storeId, status, sellPrice }) as StockItem;

describe('summarizeStoreStock', () => {
  const stock = [
    item('gr', StockStatus.AVAILABLE, 1000),
    item('gr', StockStatus.PREPARATION, 500),
    item('gr', StockStatus.RESERVED, 2000),
    item('gr', StockStatus.SOLD, 9000),
    item('gr', StockStatus.IN_USE, 700),
    item('hds', StockStatus.AVAILABLE, 3000),
  ];

  it('conta só o que ainda é da loja, sem vendidos nem "Em Uso"', () => {
    expect(summarizeStoreStock(stock, 'gr')).toEqual({ count: 3, value: 3500 });
  });

  it('não mistura itens de outra loja', () => {
    expect(summarizeStoreStock(stock, 'hds')).toEqual({ count: 1, value: 3000 });
  });

  it('loja sem itens fica zerada', () => {
    expect(summarizeStoreStock(stock, 'nova')).toEqual({ count: 0, value: 0 });
  });
});
