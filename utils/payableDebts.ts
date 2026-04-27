import type { PayableDebt, PayableDebtPayment, PayableDebtStatus } from '../types';

const parseDate = (value: Date | string) => {
  if (value instanceof Date) return new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
};

const toDateOnly = (value: Date | string) => {
  const date = parseDate(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export type PayableDebtDeadlineBadge = 'Em aberto' | 'Atrasado' | 'Em dias';

export const getPayableDebtDueDate = (debt: PayableDebt) => debt.firstDueDate || debt.dueDate || undefined;

export const isPayableDebtOverdue = (debt: PayableDebt, now: Date = new Date()) => {
  const dueDateValue = getPayableDebtDueDate(debt);
  if (!dueDateValue) return false;
  if (debt.status === 'Quitada') return false;
  if (debt.remainingAmount <= 0) return false;
  return toDateOnly(dueDateValue).getTime() < toDateOnly(now).getTime();
};

export const getPayableDebtDeadlineBadge = (
  debt: PayableDebt,
  payments: Pick<PayableDebtPayment, 'paidAt'>[] = [],
  now: Date = new Date()
): PayableDebtDeadlineBadge => {
  const dueDateValue = getPayableDebtDueDate(debt);
  if (!dueDateValue) {
    return debt.status === 'Quitada' ? 'Em dias' : 'Em aberto';
  }

  const dueDate = toDateOnly(dueDateValue);
  const today = toDateOnly(now);
  const isSettled = debt.status === 'Quitada' || debt.remainingAmount <= 0;

  if (!isSettled) {
    return dueDate.getTime() < today.getTime() ? 'Atrasado' : 'Em aberto';
  }

  const settlementDateValue =
    payments
      .map((p) => p.paidAt)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || debt.updatedAt;

  return toDateOnly(settlementDateValue).getTime() <= dueDate.getTime() ? 'Em dias' : 'Atrasado';
};

export const calculatePayableDebtSummary = (debts: PayableDebt[], now: Date = new Date()) => {
  let openAmount = 0;
  let overdueAmount = 0;
  let settledAmount = 0;

  debts.forEach((debt) => {
    if (debt.status === 'Quitada') {
      settledAmount += debt.originalAmount;
      return;
    }
    openAmount += debt.remainingAmount;
    if (isPayableDebtOverdue(debt, now)) {
      overdueAmount += debt.remainingAmount;
    }
  });

  return { openAmount, overdueAmount, settledAmount };
};

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
    now = new Date()
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

export const validatePayableDebtPaymentAmount = (amount: number, remainingAmount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) return false;
  return amount <= remainingAmount;
};
