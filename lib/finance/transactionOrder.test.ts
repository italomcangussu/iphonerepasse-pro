import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../types';
import { compareTransactionsChronologically, localDayKey } from './transactionOrder';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? 't',
  type: 'IN',
  category: 'Venda',
  amount: 0,
  date: over.date ?? '2026-07-18T12:00:00.000Z',
  createdAt: over.createdAt,
  description: '',
  account: 'Conta Bancária',
  ...over
});

describe('localDayKey', () => {
  it('collapses different times of the same local day to one key', () => {
    expect(localDayKey('2026-07-18T00:00:00')).toBe(localDayKey('2026-07-18T23:59:00'));
  });

  it('returns 0 for invalid dates instead of NaN', () => {
    expect(localDayKey('not-a-date')).toBe(0);
  });
});

describe('compareTransactionsChronologically', () => {
  it('orders more recent days first', () => {
    const rows = [
      tx({ id: 'old', date: '2026-07-10T09:00:00' }),
      tx({ id: 'new', date: '2026-07-18T09:00:00' })
    ];
    expect(rows.sort(compareTransactionsChronologically).map((t) => t.id)).toEqual(['new', 'old']);
  });

  it('breaks same-day ties by real creation time, not by the business date', () => {
    // Cenário do bug: uma quitação com date ao meio-dia foi criada DEPOIS de um
    // aporte manual da tarde. Sem createdAt ela afundava; com createdAt sobe.
    const aporte = tx({
      id: 'aporte',
      date: '2026-07-18T18:44:00',
      createdAt: '2026-07-18T18:44:00'
    });
    const quitacao = tx({
      id: 'quitacao',
      date: '2026-07-18T12:00:00', // data de negócio ao meio-dia
      createdAt: '2026-07-18T18:50:00' // criada de fato mais tarde
    });

    expect([aporte, quitacao].sort(compareTransactionsChronologically).map((t) => t.id)).toEqual([
      'quitacao',
      'aporte'
    ]);
  });

  it('keeps the visible day grouping even when createdAt is on another day', () => {
    // Lançamento com data retroativa (dia anterior) registrado hoje não deve
    // pular para o topo: o agrupamento segue a coluna "Data".
    const hoje = tx({ id: 'hoje', date: '2026-07-18T09:00:00', createdAt: '2026-07-18T09:00:00' });
    const retroativo = tx({
      id: 'retroativo',
      date: '2026-07-17T09:00:00',
      createdAt: '2026-07-18T20:00:00'
    });
    expect([retroativo, hoje].sort(compareTransactionsChronologically).map((t) => t.id)).toEqual([
      'hoje',
      'retroativo'
    ]);
  });

  it('falls back to date when createdAt is missing', () => {
    const a = tx({ id: 'a', date: '2026-07-18T10:00:00', createdAt: undefined });
    const b = tx({ id: 'b', date: '2026-07-18T15:00:00', createdAt: undefined });
    expect([a, b].sort(compareTransactionsChronologically).map((t) => t.id)).toEqual(['b', 'a']);
  });
});
