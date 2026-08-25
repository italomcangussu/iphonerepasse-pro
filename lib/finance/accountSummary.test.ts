import { describe, it, expect } from 'vitest';
import { summarizeAccountTransactions, EMPTY_ACCOUNT_TRANSACTION_SUMMARY } from './accountSummary';
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
