import { describe, expect, it } from 'vitest';
import { Condition, StockStatus, type Customer, type Sale, type StockItem } from '../types';
import { buildSaleSearchIndex, matchesSaleSearch, type SaleSearchSubject } from './saleSearch';

const customer: Customer = {
  id: 'cus-1',
  name: 'Jorge Bhering Linhares Aragão',
  cpf: '123.456.789-09',
  phone: '(88) 99999-0000',
  alternativePhone: '',
  email: 'jorge@exemplo.com',
  purchases: 1,
  totalSpent: 4390
};

const item = (overrides: Partial<StockItem> = {}): StockItem =>
  ({
    id: 'stk-1',
    type: 'iPhone',
    model: 'iPhone 15 Pro',
    color: 'Titânio Natural',
    capacity: '256 GB',
    imei: '357000000000001',
    condition: Condition.USED,
    status: StockStatus.SOLD,
    storeId: 'store-1',
    purchasePrice: 3800,
    sellPrice: 4390,
    ...overrides
  }) as StockItem;

const sale = (overrides: Partial<Sale> = {}): Sale =>
  ({
    id: 'sale-abc123def',
    saleNumber: 377,
    date: '2026-08-23T20:34:23.000Z',
    customerId: 'cus-1',
    sellerId: 'sel-1',
    storeId: 'store-1',
    items: [item()],
    paymentMethods: [{ type: 'Cartão', amount: 4390, cardBrand: 'visa_master', installments: 10 }],
    total: 4390,
    discount: 0,
    tradeInValue: 0,
    ...overrides
  }) as unknown as Sale;

const subject = (overrides: Partial<SaleSearchSubject> = {}): SaleSearchSubject => ({
  sale: sale(),
  customer,
  sellerName: 'Kauan Lean Lima da Silva',
  storeName: 'Sobral',
  ...overrides
});

const search = (query: string, over: Partial<SaleSearchSubject> = {}) =>
  matchesSaleSearch(buildSaleSearchIndex(subject(over)), query);

describe('matchesSaleSearch', () => {
  it('accepts an empty query — busca vazia não filtra nada', () => {
    expect(search('')).toBe(true);
    expect(search('   ')).toBe(true);
  });

  it('finds the sale by customer, seller and store, ignoring case and accents', () => {
    expect(search('ARAGAO')).toBe(true);
    expect(search('kauan')).toBe(true);
    expect(search('sobral')).toBe(true);
  });

  it('finds the sale by device model, capacity, color and IMEI', () => {
    expect(search('15 pro')).toBe(true);
    expect(search('256')).toBe(true);
    expect(search('titanio')).toBe(true);
    expect(search('357000000000001')).toBe(true);
  });

  it('finds the sale by number, with or without the # prefix', () => {
    expect(search('#377')).toBe(true);
    expect(search('377')).toBe(true);
  });

  it('matches a masked document or phone typed as plain digits', () => {
    expect(search('12345678909')).toBe(true);
    expect(search('88999990000')).toBe(true);
  });

  it('matches the total typed as a round number or as currency', () => {
    expect(search('4390')).toBe(true);
    expect(search('4.390,00')).toBe(true);
  });

  it('finds the sale by payment method', () => {
    expect(search('visa')).toBe(true);
    expect(search('cartao')).toBe(true);
  });

  it('finds the sale by the traded-in device', () => {
    const withTradeIn = sale({
      tradeIns: [{ id: 't-1', stockItemId: 'stk-9', model: 'iPhone 12', imei: '354999999999999', receivedValue: 1500 }],
      tradeInValue: 1500
    });

    expect(search('iphone 12', { sale: withTradeIn })).toBe(true);
    expect(search('354999999999999', { sale: withTradeIn })).toBe(true);
  });

  it('requires every term to match — os termos se somam, não se acumulam', () => {
    expect(search('kauan 15 pro')).toBe(true);
    expect(search('kauan iphone 14')).toBe(false);
  });

  it('does not match a number that only exists across two different fields', () => {
    // "0900" não existe em nenhum campo: só apareceria colando o fim do IMEI
    // (…0001) no começo de outro número, que é o que a lista de dígitos evita.
    expect(search('00013570')).toBe(false);
  });

  it('rejects a sale that has nothing to do with the query', () => {
    expect(search('samsung')).toBe(false);
  });

  it('survives a sale with no customer, seller or store resolved', () => {
    const index = buildSaleSearchIndex({ sale: sale(), customer: null });

    expect(matchesSaleSearch(index, '377')).toBe(true);
    expect(matchesSaleSearch(index, 'kauan')).toBe(false);
  });
});
