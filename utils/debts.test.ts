import { describe, expect, it } from 'vitest';
import type { Customer, Debt } from '../types';
import {
  calculateDebtSummary,
  filterDebts,
  isDebtOverdue,
  matchCustomerByPriority,
  normalizeDigits,
  normalizeName,
  validateDebtPaymentAmount
} from './debts';

const makeCustomer = (overrides: Partial<Customer>): Customer => ({
  id: 'cust-1',
  name: 'Cliente',
  cpf: '',
  phone: '',
  email: '',
  birthDate: '',
  purchases: 0,
  totalSpent: 0,
  ...overrides
});

const makeDebt = (overrides: Partial<Debt>): Debt => ({
  id: 'debt-1',
  customerId: 'cust-1',
  originalAmount: 100,
  remainingAmount: 100,
  status: 'Aberta',
  source: 'manual',
  createdAt: '2026-02-01T10:00:00.000Z',
  updatedAt: '2026-02-01T10:00:00.000Z',
  ...overrides
});

describe('debt utils', () => {
  it('normalizes digits and names correctly', () => {
    expect(normalizeDigits('123.456.789-00')).toBe('12345678900');
    expect(normalizeName('  maria   da   silva  ')).toBe('MARIA DA SILVA');
  });

  it('matches customer by CPF first, then phone, then normalized name', () => {
    const customers: Customer[] = [
      makeCustomer({ id: 'cpf', name: 'Pessoa CPF', cpf: '111.111.111-11', phone: '85999990001' }),
      makeCustomer({ id: 'phone', name: 'Pessoa Telefone', cpf: '222.222.222-22', phone: '(85) 98888-0002' }),
      makeCustomer({ id: 'name', name: 'JOAO PEDRO', cpf: '333.333.333-33', phone: '85977770003' })
    ];

    const byCpf = matchCustomerByPriority(customers, {
      name: 'Outro Nome',
      cpf: '11111111111',
      phone: '(85) 98888-0002'
    });
    expect(byCpf?.id).toBe('cpf');

    const byPhone = matchCustomerByPriority(customers, {
      name: 'Outro Nome',
      phone: '85 98888-0002'
    });
    expect(byPhone?.id).toBe('phone');

    const byName = matchCustomerByPriority(customers, {
      name: '  joao   pedro '
    });
    expect(byName?.id).toBe('name');
  });

  it('returns undefined when no customer matches', () => {
    const customers: Customer[] = [makeCustomer({ id: '1', name: 'Ana Paula' })];
    const matched = matchCustomerByPriority(customers, { name: 'Carlos Alberto', phone: '85999990000' });
    expect(matched).toBeUndefined();
  });

  it('computes debt summary including overdue and settled totals', () => {
    const now = new Date('2026-02-15T12:00:00.000Z');
    const debts: Debt[] = [
      makeDebt({ id: 'd1', remainingAmount: 300, originalAmount: 300, status: 'Aberta', dueDate: '2026-02-10' }),
      makeDebt({ id: 'd2', remainingAmount: 150, originalAmount: 200, status: 'Parcial', dueDate: '2026-02-20' }),
      makeDebt({ id: 'd3', remainingAmount: 0, originalAmount: 500, status: 'Quitada', dueDate: '2026-01-15' })
    ];

    const summary = calculateDebtSummary(debts, now);
    expect(summary).toEqual({
      openAmount: 450,
      overdueAmount: 300,
      settledAmount: 500
    });
  });

  it('filters debts by search, status and overdue flag', () => {
    const now = new Date('2026-02-15T12:00:00.000Z');
    const debts: Debt[] = [
      makeDebt({
        id: 'd1',
        customerId: 'c1',
        status: 'Aberta',
        remainingAmount: 350,
        dueDate: '2026-02-10',
        notes: 'Pagamento semanal'
      }),
      makeDebt({
        id: 'd2',
        customerId: 'c2',
        status: 'Parcial',
        remainingAmount: 100,
        dueDate: '2026-02-25',
        notes: 'Mensal'
      }),
      makeDebt({
        id: 'd3',
        customerId: 'c3',
        status: 'Quitada',
        remainingAmount: 0,
        originalAmount: 900,
        notes: 'Liquidado'
      })
    ];

    const customerById = new Map<string, string>([
      ['c1', 'Felipe Vieira'],
      ['c2', 'Samuel'],
      ['c3', 'Renata']
    ]);

    const overdue = filterDebts(debts, { customerById, onlyOverdue: true, now });
    expect(overdue.map((debt) => debt.id)).toEqual(['d1']);

    const bySearch = filterDebts(debts, { customerById, searchTerm: 'samuel', now });
    expect(bySearch.map((debt) => debt.id)).toEqual(['d2']);

    const byStatus = filterDebts(debts, { customerById, statusFilter: 'Quitada', now });
    expect(byStatus.map((debt) => debt.id)).toEqual(['d3']);
  });

  it('detects overdue debt and validates payment amount boundaries', () => {
    const now = new Date('2026-02-15T12:00:00.000Z');
    const overdueDebt = makeDebt({ dueDate: '2026-02-14', remainingAmount: 200, status: 'Aberta' });
    const todayDebt = makeDebt({ dueDate: '2026-02-15', remainingAmount: 200, status: 'Aberta' });

    expect(isDebtOverdue(overdueDebt, now)).toBe(true);
    expect(isDebtOverdue(todayDebt, now)).toBe(false);

    expect(validateDebtPaymentAmount(120, 300)).toBe(true);
    expect(validateDebtPaymentAmount(300, 300)).toBe(true);
    expect(validateDebtPaymentAmount(301, 300)).toBe(false);
    expect(validateDebtPaymentAmount(0, 300)).toBe(false);
  });
});
