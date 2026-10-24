import { describe, expect, it } from 'vitest';
import { Condition, StockStatus, WarrantyType, type StockItem } from '../../../types';
import { DEFAULT_CARD_FEE_SETTINGS } from '../../../utils/cardFees';
import {
  clampValidityDays,
  cleanQuoteItem,
  computeQuoteExpiry,
  computeQuoteTotals,
  createManualQuoteItem,
  DEFAULT_QUOTE_PAYMENT_PLAN,
  findQuoteDraftIssues,
  formatQuoteNumber,
  longestInstallment,
  resolveQuoteLifecycle,
  stockItemToQuoteItem,
  type QuoteItem,
} from './quoteModel';

const item = (overrides: Partial<QuoteItem> = {}): QuoteItem => ({
  ...createManualQuoteItem('k1'),
  name: 'iPhone 15 128GB',
  unitPrice: 4000,
  ...overrides,
});

describe('computeQuoteTotals', () => {
  it('soma itens, aplica desconto e calcula parcelas com a taxa da bandeira', () => {
    const totals = computeQuoteTotals(
      { items: [item(), item({ key: 'k2', unitPrice: 1000, quantity: 2 })], discount: 500, presentation: 'sum', plan: DEFAULT_QUOTE_PAYMENT_PLAN },
      DEFAULT_CARD_FEE_SETTINGS,
    );
    expect(totals.subtotal).toBe(6000);
    expect(totals.total).toBe(5500);
    expect(totals.payment.cash).toBe(5500);
    expect(totals.payment.installments.map((row) => row.installments)).toEqual([1, 3, 6, 10, 12, 18]);
    const eighteen = longestInstallment(totals.payment)!;
    expect(eighteen.customerAmount).toBeCloseTo(5500 / (1 - 0.1537), 1);
    expect(eighteen.installmentAmount).toBeCloseTo(eighteen.customerAmount / 18, 1);
  });

  it('só à vista não gera parcelas nem débito', () => {
    const totals = computeQuoteTotals(
      { items: [item()], discount: 0, presentation: 'sum', plan: { ...DEFAULT_QUOTE_PAYMENT_PLAN, cashOnly: true, includeDebit: true } },
      DEFAULT_CARD_FEE_SETTINGS,
    );
    expect(totals.payment.installments).toEqual([]);
    expect(totals.payment.debit).toBeNull();
  });

  it('modo comparar ignora o desconto e precifica cada item', () => {
    const totals = computeQuoteTotals(
      { items: [item(), item({ key: 'k2', unitPrice: 3000 })], discount: 200, presentation: 'compare', plan: DEFAULT_QUOTE_PAYMENT_PLAN },
      DEFAULT_CARD_FEE_SETTINGS,
    );
    expect(totals.discount).toBe(0);
    expect(totals.itemPayments.map((row) => row.cash)).toEqual([4000, 3000]);
  });

  it('desconto nunca passa do subtotal e parcelas fora de 1..18 são descartadas', () => {
    const totals = computeQuoteTotals(
      { items: [item({ unitPrice: 100 })], discount: 999, presentation: 'sum', plan: { ...DEFAULT_QUOTE_PAYMENT_PLAN, installments: [0, 3, 3, 19], includeDebit: true } },
      DEFAULT_CARD_FEE_SETTINGS,
    );
    expect(totals.total).toBe(0);
    expect(totals.payment.installments).toEqual([]);
    const withValue = computeQuoteTotals(
      { items: [item({ unitPrice: 100 })], discount: 0, presentation: 'sum', plan: { ...DEFAULT_QUOTE_PAYMENT_PLAN, installments: [0, 3, 3, 19], includeDebit: true } },
      DEFAULT_CARD_FEE_SETTINGS,
    );
    expect(withValue.payment.installments.map((row) => row.installments)).toEqual([3]);
    expect(withValue.payment.debit?.feeRate).toBe(DEFAULT_CARD_FEE_SETTINGS.debitRate);
  });
});

describe('validade', () => {
  it('fica entre 1 e 30 dias, padrão 1', () => {
    expect(clampValidityDays(0)).toBe(1);
    expect(clampValidityDays(31)).toBe(30);
    expect(clampValidityDays(Number.NaN)).toBe(1);
    const createdAt = new Date('2026-10-24T14:30:00-03:00');
    expect(computeQuoteExpiry(createdAt, 1).toISOString()).toBe('2026-10-25T17:30:00.000Z');
  });

  it('classifica válido, vencido e cancelado', () => {
    const now = new Date('2026-10-24T12:00:00Z');
    expect(resolveQuoteLifecycle({ status: 'aberto', expiresAt: '2026-10-25T00:00:00Z' }, now)).toBe('valido');
    expect(resolveQuoteLifecycle({ status: 'aberto', expiresAt: '2026-10-24T11:59:00Z' }, now)).toBe('vencido');
    expect(resolveQuoteLifecycle({ status: 'cancelado', expiresAt: '2026-10-25T00:00:00Z' }, now)).toBe('cancelado');
  });
});

describe('itens', () => {
  it('converte item do estoque com nome, detalhes e preço de venda', () => {
    const stock = {
      id: 's1', type: 'iPhone', model: 'iPhone 14 Pro', capacity: '256GB', color: 'Roxo', condition: Condition.USED,
      batteryHealth: 89, sellPrice: 4599.9, status: StockStatus.AVAILABLE, warrantyType: WarrantyType.STORE,
    } as unknown as StockItem;
    expect(stockItemToQuoteItem(stock, 'k')).toMatchObject({
      source: 'stock', stockItemId: 's1', name: 'iPhone 14 Pro 256GB', details: ['Roxo', 'Seminovo', 'Bateria 89%'], unitPrice: 4599.9,
    });
  });

  it('aponta orçamento vazio, item sem nome e item sem valor', () => {
    expect(findQuoteDraftIssues([])).toHaveLength(1);
    expect(findQuoteDraftIssues([item({ name: ' ' })])[0].message).toMatch(/nome/);
    expect(findQuoteDraftIssues([item({ unitPrice: 0 })])[0].message).toMatch(/valor/);
    expect(findQuoteDraftIssues([item()])).toEqual([]);
  });

  it('limpa nome, detalhes vazios e prazo antes de salvar', () => {
    expect(cleanQuoteItem(item({ name: ' X ', details: ['Azul ', '', ' '], leadTime: '  ' }))).toMatchObject({ name: 'X', details: ['Azul'], leadTime: undefined });
  });

  it('formata o número do orçamento', () => {
    expect(formatQuoteNumber(7)).toBe('ORC-0007');
  });
});
