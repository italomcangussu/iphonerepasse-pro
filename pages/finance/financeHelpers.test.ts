import { describe, it, expect } from 'vitest';
import type { Debt, Transaction } from '../../types';
import {
  buildAccountStatementCsv,
  buildCancelTransactionMessage,
  debtStatusBadgeClass,
  formatDueDate,
  formatSignedBRL,
  getTransactionDescription,
  summarizeCustomerDebts
} from './financeHelpers';
import { getEffectiveDateRange, isInDateRange } from './periodRange';

const trx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  type: 'OUT',
  category: 'Aluguel',
  amount: 1500,
  date: '2026-10-05T10:00:00.000Z',
  description: 'Aluguel loja',
  account: 'Conta Bancária',
  ...overrides
});

describe('formatSignedBRL', () => {
  it('puts the typographic minus before the currency', () => {
    expect(formatSignedBRL(-10)).toBe('−R$ 10,00');
    expect(formatSignedBRL(10)).toBe('R$ 10,00');
  });
});

describe('summarizeCustomerDebts', () => {
  it('splits open, overdue and settled amounts', () => {
    const debts = [
      { id: 'a', status: 'Quitada', originalAmount: 300, remainingAmount: 0 },
      { id: 'b', status: 'Aberta', originalAmount: 500, remainingAmount: 500, dueDate: '2000-01-01' },
      { id: 'c', status: 'Parcial', originalAmount: 400, remainingAmount: 200, dueDate: '2999-01-01' }
    ] as unknown as Debt[];
    expect(summarizeCustomerDebts(debts)).toEqual({ openAmount: 700, overdueAmount: 500, settledAmount: 300 });
  });
});

describe('buildCancelTransactionMessage', () => {
  const empty = { debtPayments: [], debts: [], customers: [], transactions: [] };

  it('asks a plain confirmation for an ordinary entry', () => {
    expect(buildCancelTransactionMessage(trx(), empty)).toBe('Tem certeza que deseja cancelar o lançamento "Aluguel loja"?');
  });

  it('explains the debt payment reversal with the customer name', () => {
    const message = buildCancelTransactionMessage(trx({ debtPaymentId: 'p1' }), {
      ...empty,
      debtPayments: [{ id: 'p1', debtId: 'd1', amount: 250 }],
      debts: [{ id: 'd1', customerId: 'c1' }],
      customers: [{ id: 'c1', name: 'Ana' }]
    } as never);
    expect(message).toContain('estornará o pagamento do cliente Ana e devolverá R$ 250,00 à dívida');
  });

  it('explains which account gets the transfer back', () => {
    const out = trx({ id: 'o', transferGroupId: 'g', account: 'Cofre', amount: 1000 });
    const message = buildCancelTransactionMessage(out, {
      ...empty,
      transactions: [out, trx({ id: 'i', type: 'IN', transferGroupId: 'g', account: 'Conta Bancária' })]
    });
    expect(message).toContain('R$ 1.000,00 retornará para Cofre e sairá de Conta Bancária');
  });
});

describe('buildAccountStatementCsv', () => {
  it('names the file after the account and formats values in pt-BR', () => {
    const { fileName, rows } = buildAccountStatementCsv('Conta Bancária', [trx()], (t) => t.description);
    expect(fileName).toBe('extrato-conta-bancaria.csv');
    expect(rows[1]).toEqual(['05/10/2026', 'Conta Bancária', 'Saída', 'Aluguel', 'Aluguel loja', '1500,00']);
  });
});

describe('debt display helpers', () => {
  it('maps status to badge colors and formats due dates', () => {
    expect(debtStatusBadgeClass('Quitada')).toBe('ios-badge-green');
    expect(debtStatusBadgeClass('Parcial')).toBe('ios-badge-blue');
    expect(debtStatusBadgeClass('Aberta')).toBe('ios-badge-orange');
    expect(formatDueDate('2026-04-30')).toBe('30/04/2026');
    expect(formatDueDate(undefined)).toBe('-');
  });
});

describe('periodRange', () => {
  it('builds a custom range covering whole days', () => {
    const { from, to } = getEffectiveDateRange('custom', '2026-10-01', '2026-10-31');
    expect(isInDateRange('2026-10-31T20:00:00', from, to)).toBe(true);
    expect(isInDateRange('2026-11-01T00:00:01', from, to)).toBe(false);
  });

  it('keeps everything with "all"', () => {
    const { from, to } = getEffectiveDateRange('all', '', '');
    expect(isInDateRange('1999-01-01T00:00:00.000Z', from, to)).toBe(true);
  });
});

describe('getTransactionDescription', () => {
  const sources = {
    sales: [{ id: 'sale-1', sellerId: 'v1', customerId: 'c1' }],
    sellers: [{ id: 'v1', name: 'Bruno' }],
    customers: [{ id: 'c1', name: 'Ana' }],
    debts: [{ id: 'debt-1', customerId: 'c1' }]
  } as never;

  it('names the seller on commissions', () => {
    expect(getTransactionDescription(trx({ category: 'Comissão', saleId: 'sale-1' }), sources)).toBe('Comissão recebida pelo vendedor Bruno');
  });

  it('names the customer on debt settlements', () => {
    expect(getTransactionDescription(trx({ description: 'Quitação de dívida - debt-1' }), sources)).toBe('Quitação de dívida - Ana');
  });

  it('swaps the sale id for the customer name and keeps the label', () => {
    expect(getTransactionDescription(trx({ saleId: 'sale-1', description: 'Venda (Pix) - sale-1' }), sources)).toBe('Venda (Pix) - Ana');
  });

  it('keeps the original text when nothing matches', () => {
    expect(getTransactionDescription(trx({ saleId: 'sale-9', description: 'Venda - sale-9' }), sources)).toBe('Venda - sale-9');
  });
});
