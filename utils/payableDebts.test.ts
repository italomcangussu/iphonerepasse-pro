import { describe, it, expect } from 'vitest';
import {
  isPayableDebtOverdue,
  getPayableDebtDeadlineBadge,
  calculatePayableDebtSummary,
  filterPayableDebts,
  validatePayableDebtPaymentAmount
} from './payableDebts';
import type { PayableDebt } from '../types';

const makeDebt = (overrides: Partial<PayableDebt> = {}): PayableDebt => ({
  id: 'pd-1',
  creditorId: 'cr-1',
  creditorName: 'Fornecedor A',
  originalAmount: 1000,
  remainingAmount: 1000,
  status: 'Aberta',
  source: 'manual',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides
});

describe('isPayableDebtOverdue', () => {
  it('returns false when no due date', () => {
    expect(isPayableDebtOverdue(makeDebt())).toBe(false);
  });

  it('returns false when settled', () => {
    const debt = makeDebt({ dueDate: '2025-01-01', status: 'Quitada', remainingAmount: 0 });
    expect(isPayableDebtOverdue(debt, new Date('2026-01-10'))).toBe(false);
  });

  it('returns true when past due and open', () => {
    const debt = makeDebt({ dueDate: '2025-12-01' });
    expect(isPayableDebtOverdue(debt, new Date('2026-01-10'))).toBe(true);
  });

  it('returns false when due date is today', () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const debt = makeDebt({ dueDate: `${yyyy}-${mm}-${dd}` });
    expect(isPayableDebtOverdue(debt, today)).toBe(false);
  });
});

describe('getPayableDebtDeadlineBadge', () => {
  it('returns Em aberto when open with no due date', () => {
    expect(getPayableDebtDeadlineBadge(makeDebt())).toBe('Em aberto');
  });

  it('returns Atrasado when overdue and open', () => {
    const debt = makeDebt({ dueDate: '2025-01-01' });
    expect(getPayableDebtDeadlineBadge(debt, [], new Date('2026-01-10'))).toBe('Atrasado');
  });

  it('returns Em dias when settled on time', () => {
    const debt = makeDebt({ dueDate: '2026-02-01', status: 'Quitada', remainingAmount: 0 });
    const payments = [{ paidAt: '2026-01-31T12:00:00Z' }];
    expect(getPayableDebtDeadlineBadge(debt, payments, new Date('2026-02-05'))).toBe('Em dias');
  });

  it('returns Atrasado when settled late', () => {
    const debt = makeDebt({ dueDate: '2026-01-01', status: 'Quitada', remainingAmount: 0 });
    const payments = [{ paidAt: '2026-02-01T12:00:00Z' }];
    expect(getPayableDebtDeadlineBadge(debt, payments, new Date('2026-02-05'))).toBe('Atrasado');
  });
});

describe('calculatePayableDebtSummary', () => {
  it('sums open, overdue and settled amounts correctly', () => {
    const now = new Date('2026-04-27');
    const debts: PayableDebt[] = [
      makeDebt({ id: '1', remainingAmount: 500, status: 'Aberta', dueDate: '2026-01-01' }),
      makeDebt({ id: '2', remainingAmount: 300, status: 'Parcial', dueDate: '2026-06-01' }),
      makeDebt({ id: '3', remainingAmount: 0, status: 'Quitada', originalAmount: 200 })
    ];
    const summary = calculatePayableDebtSummary(debts, now);
    expect(summary.openAmount).toBe(800);
    expect(summary.overdueAmount).toBe(500);
    expect(summary.settledAmount).toBe(200);
  });
});

describe('filterPayableDebts', () => {
  const creditorById = new Map([['cr-1', 'Fornecedor A'], ['cr-2', 'Banco XYZ']]);
  const debts: PayableDebt[] = [
    makeDebt({ id: '1', creditorId: 'cr-1', status: 'Aberta', notes: 'parcela mensal' }),
    makeDebt({ id: '2', creditorId: 'cr-2', status: 'Quitada' }),
    makeDebt({ id: '3', creditorId: 'cr-1', status: 'Parcial', dueDate: '2025-01-01' })
  ];

  it('returns all debts with no filters', () => {
    expect(filterPayableDebts(debts, { creditorById }).length).toBe(3);
  });

  it('filters by search term on creditor name', () => {
    const result = filterPayableDebts(debts, { creditorById, searchTerm: 'banco' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('2');
  });

  it('filters by status', () => {
    const result = filterPayableDebts(debts, { creditorById, statusFilter: 'Quitada' });
    expect(result.length).toBe(1);
  });

  it('filters only overdue', () => {
    const result = filterPayableDebts(debts, { creditorById, onlyOverdue: true, now: new Date('2026-04-27') });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('3');
  });
});

describe('validatePayableDebtPaymentAmount', () => {
  it('returns true for valid partial amount', () => {
    expect(validatePayableDebtPaymentAmount(100, 500)).toBe(true);
  });

  it('returns true for exact amount', () => {
    expect(validatePayableDebtPaymentAmount(500, 500)).toBe(true);
  });

  it('returns false when amount exceeds remaining', () => {
    expect(validatePayableDebtPaymentAmount(600, 500)).toBe(false);
  });

  it('returns false for zero amount', () => {
    expect(validatePayableDebtPaymentAmount(0, 500)).toBe(false);
  });

  it('returns false when remaining is zero', () => {
    expect(validatePayableDebtPaymentAmount(100, 0)).toBe(false);
  });
});
