import { describe, it, expect } from 'vitest';
import {
  summarizeAccountTransactions,
  summarizeByCategory,
  matchesCategoryFilter,
  EMPTY_ACCOUNT_TRANSACTION_SUMMARY,
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_ALL_INCOME,
  CATEGORY_FILTER_ALL_EXPENSE
} from './accountSummary';
import type { Transaction } from '../../types';

const trx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'trx-1',
  type: 'IN',
  category: 'Aporte',
  amount: 100,
  date: '2026-08-25T10:00:00.000Z',
  description: 'Lançamento',
  account: 'Conta Bancária',
  ...overrides
});

describe('summarizeAccountTransactions', () => {
  it('returns zeroes for an empty statement', () => {
    expect(summarizeAccountTransactions([])).toEqual(EMPTY_ACCOUNT_TRANSACTION_SUMMARY);
  });

  it('separates entradas from saídas and nets them', () => {
    const summary = summarizeAccountTransactions([
      trx({ id: 'a', type: 'IN', amount: 5000 }),
      trx({ id: 'b', type: 'OUT', amount: 1500 }),
      trx({ id: 'c', type: 'IN', amount: 250 })
    ]);

    expect(summary).toEqual({ totalIn: 5250, totalOut: 1500, net: 3750 });
  });

  it('reports a negative net when saídas exceed entradas', () => {
    const summary = summarizeAccountTransactions([
      trx({ id: 'a', type: 'IN', amount: 100 }),
      trx({ id: 'b', type: 'OUT', amount: 400 })
    ]);

    expect(summary.net).toBe(-300);
  });

  it('counts internal transfers, so the cards match the statement rendered below them', () => {
    // Uma transferência Cofre -> Conta Bancária grava um par IN/OUT de categoria
    // "Transferência" nas duas contas. Do lado do Cofre é uma saída de caixa real da
    // conta, e o extrato logo abaixo dos cards a exibe — então a soma tem que incluí-la.
    const summary = summarizeAccountTransactions([
      trx({ id: 'a', type: 'IN', amount: 2000, category: 'Aporte' }),
      trx({ id: 'transfer-out', type: 'OUT', amount: 10000, category: 'Transferência', account: 'Cofre' })
    ]);

    expect(summary).toEqual({ totalIn: 2000, totalOut: 10000, net: -8000 });
  });

  it('keeps cents instead of truncating them', () => {
    const summary = summarizeAccountTransactions([
      trx({ id: 'a', type: 'IN', amount: 1500.5 }),
      trx({ id: 'b', type: 'OUT', amount: 0.25 })
    ]);

    expect(summary.totalIn).toBeCloseTo(1500.5, 2);
    expect(summary.net).toBeCloseTo(1500.25, 2);
  });

  it('treats non-finite amounts as zero instead of poisoning the total with NaN', () => {
    const summary = summarizeAccountTransactions([
      trx({ id: 'a', type: 'IN', amount: 1000 }),
      trx({ id: 'b', type: 'IN', amount: undefined as unknown as number }),
      trx({ id: 'c', type: 'OUT', amount: 'abc' as unknown as number })
    ]);

    expect(summary).toEqual({ totalIn: 1000, totalOut: 0, net: 1000 });
  });
});

describe('matchesCategoryFilter', () => {
  const income = trx({ type: 'IN', category: 'Venda' });
  const expense = trx({ type: 'OUT', category: 'Aluguel' });

  it('keeps everything with "all"', () => {
    expect([income, expense].filter((t) => matchesCategoryFilter(t, CATEGORY_FILTER_ALL))).toHaveLength(2);
  });

  it('keeps only receitas or only despesas with the group filters', () => {
    expect(matchesCategoryFilter(income, CATEGORY_FILTER_ALL_INCOME)).toBe(true);
    expect(matchesCategoryFilter(expense, CATEGORY_FILTER_ALL_INCOME)).toBe(false);
    expect(matchesCategoryFilter(expense, CATEGORY_FILTER_ALL_EXPENSE)).toBe(true);
    expect(matchesCategoryFilter(income, CATEGORY_FILTER_ALL_EXPENSE)).toBe(false);
  });

  it('matches a single category by name', () => {
    expect(matchesCategoryFilter(expense, 'Aluguel')).toBe(true);
    expect(matchesCategoryFilter(income, 'Aluguel')).toBe(false);
  });
});

describe('summarizeByCategory', () => {
  it('groups by side and category, largest first, with share of the side', () => {
    const breakdown = summarizeByCategory([
      trx({ id: 'a', type: 'IN', category: 'Venda', amount: 300 }),
      trx({ id: 'b', type: 'IN', category: 'Aporte', amount: 100 }),
      trx({ id: 'c', type: 'IN', category: 'Venda', amount: 600 }),
      trx({ id: 'd', type: 'OUT', category: 'Aluguel', amount: 50 })
    ]);

    expect(breakdown.IN).toEqual([
      { category: 'Venda', total: 900, count: 2, share: 0.9 },
      { category: 'Aporte', total: 100, count: 1, share: 0.1 }
    ]);
    expect(breakdown.OUT).toEqual([{ category: 'Aluguel', total: 50, count: 1, share: 1 }]);
  });

  it('labels blank categories and returns empty sides for an empty statement', () => {
    expect(summarizeByCategory([])).toEqual({ IN: [], OUT: [] });
    expect(summarizeByCategory([trx({ category: '  ' })]).IN[0].category).toBe('Sem categoria');
  });
});
