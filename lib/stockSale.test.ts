import { describe, expect, it } from 'vitest';
import type { TransferableItem } from '../services/tenants';
import { buildStockSale, costDigits, saleButtonLabel, salePriceDigits, salePriceMissing, saleSummary, saleToast, saleTotal } from './stockSale';

const item = (id: string, cost: number): TransferableItem => ({
  id, type: 'iPhone', model: 'iPhone 15', color: null, capacity: '128GB', imei: null,
  condition: 'Seminovo', status: 'Disponível', battery_health: null, sell_price: null, cost,
});

const items = [item('a', 3150), item('b', 1999.9)];

describe('stockSale', () => {
  it('começa no custo de cada aparelho, em centavos', () => {
    expect(costDigits(3150)).toBe('315000');
    expect(costDigits(1999.9)).toBe('199990');
    expect(costDigits(null)).toBe('0');
    expect(salePriceDigits(items[0], {})).toBe('315000');
  });

  it('usa o valor editado no total e no pedido', () => {
    const edited = { a: '350000' };
    expect(saleTotal(items, edited)).toBeCloseTo(5499.9);
    expect(buildStockSale('Cofre', items, edited)).toEqual({ account: 'Cofre', prices: { a: 3500, b: 1999.9 } });
  });

  it('valor apagado conta como faltando; zero vale', () => {
    expect(salePriceMissing(items, { a: '' })).toBe(true);
    expect(salePriceMissing(items, { a: '0' })).toBe(false);
  });

  it('textos dizem quem recebe, quanto e onde', () => {
    expect(saleButtonLabel(2, 'Nova', 5499.9)).toBe('Vender 2 aparelhos por R$ 5.499,90 para Nova');
    expect(saleSummary({ originName: 'Repasse', targetName: 'Nova' }, 'Conta Bancária', 100)).toContain('A Repasse recebe R$ 100,00 em Conta Bancária');
    expect(saleToast(1, 'Loja B · Nova', 100)).toBe('1 aparelho vendido para Loja B · Nova por R$ 100,00.');
  });
});
