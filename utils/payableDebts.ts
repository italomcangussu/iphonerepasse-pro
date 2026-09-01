import type { PayableDebt, PayableDebtPayment, PayableDebtStatus } from '../types';
import {
  calculateDebtLikeSummary,
  getDebtLikeDeadlineBadge,
  getDebtLikeDueDate,
  isDebtLikeOverdue,
  sortDebtLikesByDueDate,
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

export type PayableDebtSubtypeFilter = 'all' | 'em_dia' | 'atrasada';

export interface PayableDebtFilterInput {
  searchTerm?: string;
  statusFilter?: PayableDebtStatus | 'all';
  subtypeFilter?: PayableDebtSubtypeFilter;
  onlyOverdue?: boolean;
  creditorById: Map<string, string>;
  now?: Date;
}

export const filterPayableDebts = (debts: PayableDebt[], filters: PayableDebtFilterInput) => {
  const {
    searchTerm = '',
    statusFilter = 'all',
    subtypeFilter = 'all',
    onlyOverdue = false,
    creditorById,
    now = new Date(),
  } = filters;
  const q = searchTerm.trim().toLowerCase();

  return debts.filter((debt) => {
    const creditorName = (creditorById.get(debt.creditorId) || debt.creditorName || '').toLowerCase();
    const notes = (debt.notes || '').toLowerCase();
    const matchSearch = q.length === 0 || creditorName.includes(q) || notes.includes(q);
    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'Aberta'
          ? debt.status === 'Aberta' || debt.status === 'Parcial'
          : debt.status === statusFilter;
    const isOverdue = isPayableDebtOverdue(debt, now);
    let matchSubtype = true;
    if (subtypeFilter === 'atrasada') {
      matchSubtype = isOverdue;
    } else if (subtypeFilter === 'em_dia') {
      matchSubtype = !isOverdue;
    }
    const matchOverdue = onlyOverdue ? isOverdue : true;
    return matchSearch && matchStatus && matchSubtype && matchOverdue;
  });
};

export const validatePayableDebtPaymentAmount = (amount: number, remainingAmount: number) =>
  validateDebtLikePaymentAmount(amount, remainingAmount);

export const sortPayableDebtsByDueDate = (debts: PayableDebt[]) =>
  sortDebtLikesByDueDate(debts);

