/**
 * Shared date/calculation primitives used by both debts.ts and payableDebts.ts.
 * Import from those files — do not import debtCore directly from pages.
 */

export const parseDebtDate = (value: Date | string): Date => {
  if (value instanceof Date) return new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = (value as string).split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
};

export const toDebtDateOnly = (value: Date | string): Date => {
  const date = parseDebtDate(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export interface DebtLike {
  status: string;
  remainingAmount: number;
  originalAmount: number;
  firstDueDate?: string | null;
  dueDate?: string | null;
  updatedAt: string;
}

export const getDebtLikeDueDate = (debt: DebtLike) =>
  debt.firstDueDate || debt.dueDate || undefined;

export const isDebtLikeOverdue = (debt: DebtLike, now: Date = new Date()): boolean => {
  const due = getDebtLikeDueDate(debt);
  if (!due) return false;
  if (debt.status === 'Quitada') return false;
  if (debt.remainingAmount <= 0) return false;
  return toDebtDateOnly(due).getTime() < toDebtDateOnly(now).getTime();
};

export const getDebtLikeDeadlineBadge = (
  debt: DebtLike,
  payments: { paidAt: string }[],
  now: Date = new Date(),
): 'Em aberto' | 'Atrasado' | 'Em dias' => {
  const due = getDebtLikeDueDate(debt);
  const isSettled = debt.status === 'Quitada' || debt.remainingAmount <= 0;

  if (!due) return isSettled ? 'Em dias' : 'Em aberto';

  const dueDate = toDebtDateOnly(due);
  const today = toDebtDateOnly(now);

  if (!isSettled) return dueDate.getTime() < today.getTime() ? 'Atrasado' : 'Em aberto';

  const settlementDate =
    payments
      .map((p) => p.paidAt)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || debt.updatedAt;

  return toDebtDateOnly(settlementDate).getTime() <= dueDate.getTime() ? 'Em dias' : 'Atrasado';
};

export const calculateDebtLikeSummary = (
  debts: DebtLike[],
  now: Date = new Date(),
) => {
  let openAmount = 0;
  let overdueAmount = 0;
  let settledAmount = 0;

  for (const debt of debts) {
    if (debt.status === 'Quitada') {
      settledAmount += debt.originalAmount;
    } else {
      openAmount += debt.remainingAmount;
      if (isDebtLikeOverdue(debt, now)) overdueAmount += debt.remainingAmount;
    }
  }

  return { openAmount, overdueAmount, settledAmount };
};

export const validateDebtLikePaymentAmount = (amount: number, remainingAmount: number): boolean => {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) return false;
  return amount <= remainingAmount;
};
