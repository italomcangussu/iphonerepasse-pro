import type { PayableDebt, PayableDebtPayment, PayableDebtStatus } from '../types';
import {
  calculateDebtLikeSummary,
  getDebtLikeDeadlineBadge,
  getDebtLikeDueDate,
  isDebtLikeOverdue,
  validateDebtLikePaymentAmount,
} from './debtCore';

export type PayableDebtDeadlineBadge = 'Em aberto' | 'Atrasado' | 'Em dias';

export const getPayableDebtDueDate = (debt: PayableDebt) => getDebtLikeDueDate(debt);

export const isPayableDebtOverdue = (debt: PayableDebt, now?: Date) => isDebtLikeOverdue(debt, now);

export const getPayableDebtDeadlineBadge = (
  debt: PayableDebt,
  payments: Pick<PayableDebtPayment, 'paidAt'>[] = [],
  now?: Date,
): PayableDebtDeadlineBadge => getDebtLikeDeadlineBadge(debt, payments, now);

export const calculatePayableDebtSummary = (debts: PayableDebt[], now?: Date) =>
  calculateDebtLikeSummary(debts, now);

export interface PayableDebtFilterInput {
  searchTerm?: string;
  statusFilter?: PayableDebtStatus | 'all';
  onlyOverdue?: boolean;
  creditorById: Map<string, string>;
  now?: Date;
}

export const filterPayableDebts = (debts: PayableDebt[], filters: PayableDebtFilterInput) => {
  const {
    searchTerm = '',
    statusFilter = 'all',
    onlyOverdue = false,
    creditorById,
    now = new Date(),
  } = filters;
  const q = searchTerm.trim().toLowerCase();

  return debts.filter((debt) => {
    const creditorName = (creditorById.get(debt.creditorId) || debt.creditorName || '').toLowerCase();
    const notes = (debt.notes || '').toLowerCase();
    const matchSearch = q.length === 0 || creditorName.includes(q) || notes.includes(q);
    const matchStatus = statusFilter === 'all' ? true : debt.status === statusFilter;
    const matchOverdue = onlyOverdue ? isPayableDebtOverdue(debt, now) : true;
    return matchSearch && matchStatus && matchOverdue;
  });
};

export const validatePayableDebtPaymentAmount = (amount: number, remainingAmount: number) =>
  validateDebtLikePaymentAmount(amount, remainingAmount);
