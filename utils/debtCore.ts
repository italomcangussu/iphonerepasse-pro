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
  createdAt?: string;
  installmentsTotal?: number;
}

export const getDebtLikeDueDate = (debt: DebtLike) =>
  debt.firstDueDate || debt.dueDate || undefined;

const CENT = 0.01;

const addMonthsClamped = (date: Date, months: number): Date => {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
};

const toDateOnlyString = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const isSettledDebtLike = (debt: DebtLike) => debt.status === 'Quitada' || debt.remainingAmount <= 0;

export interface DebtLikeSchedule {
  /** Quanto já deveria estar pago hoje (parcelas iguais e mensais a partir do 1º vencimento). */
  amountDue: number;
  paidAmount: number;
  /** Quanto falta para ficar em dia; 0 quando está em dia. */
  overdueAmount: number;
  /** Vencimento da parcela mais antiga que falta pagar (ou da próxima, se estiver em dia). */
  nextDueDate: string | null;
}

// Parcelas são mensais e iguais: uma dívida está em dia enquanto o que foi pago
// cobre as parcelas já vencidas, mesmo que o 1º vencimento tenha passado.
export const getDebtLikeSchedule = (debt: DebtLike, now: Date = new Date()): DebtLikeSchedule => {
  const paidAmount = Math.max(0, debt.originalAmount - debt.remainingAmount);
  const due = getDebtLikeDueDate(debt);
  if (!due || isSettledDebtLike(debt)) return { amountDue: 0, paidAmount, overdueAmount: 0, nextDueDate: null };

  const total = Math.max(1, Math.floor(debt.installmentsTotal || 1));
  const installmentValue = debt.originalAmount / total;
  const first = toDebtDateOnly(due);
  const today = toDebtDateOnly(now).getTime();
  const dueDates = Array.from({ length: total }, (_, index) => addMonthsClamped(first, index));
  const pastDueCount = dueDates.filter((date) => date.getTime() < today).length;
  const amountDue = installmentValue * pastDueCount;
  const overdueAmount = amountDue - paidAmount > CENT ? amountDue - paidAmount : 0;
  const coveredInstallments = Math.min(total - 1, Math.floor((paidAmount + CENT) / installmentValue));

  return { amountDue, paidAmount, overdueAmount, nextDueDate: toDateOnlyString(dueDates[coveredInstallments]) };
};

export const isDebtLikeOverdue = (debt: DebtLike, now: Date = new Date()): boolean =>
  getDebtLikeSchedule(debt, now).overdueAmount > 0;

export const getDebtLikeDeadlineBadge = (
  debt: DebtLike,
  payments: { paidAt: string }[],
  now: Date = new Date(),
): 'Em aberto' | 'Atrasado' | 'Em dias' => {
  const due = getDebtLikeDueDate(debt);
  const isSettled = isSettledDebtLike(debt);

  if (!due) return isSettled ? 'Em dias' : 'Em aberto';

  const dueDate = toDebtDateOnly(due);

  if (!isSettled) {
    const schedule = getDebtLikeSchedule(debt, now);
    if (schedule.overdueAmount > 0) return 'Atrasado';
    return schedule.amountDue > 0 ? 'Em dias' : 'Em aberto';
  }

  const settlementDate =
    payments
      .map((p) => p.paidAt)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || debt.updatedAt;

  return toDebtDateOnly(settlementDate).getTime() <= dueDate.getTime() ? 'Em dias' : 'Atrasado';
};

export const calculateDebtLikeSummary = <T extends DebtLike>(
  debts: T[],
  now: Date = new Date(),
  isOverdue: (debt: T, now: Date) => boolean = isDebtLikeOverdue,
) => {
  let openAmount = 0;
  let overdueAmount = 0;
  let settledAmount = 0;

  for (const debt of debts) {
    if (debt.status === 'Quitada') {
      settledAmount += debt.originalAmount;
    } else {
      openAmount += debt.remainingAmount;
      if (isOverdue(debt, now)) overdueAmount += debt.remainingAmount;
    }
  }

  return { openAmount, overdueAmount, settledAmount };
};

export const validateDebtLikePaymentAmount = (amount: number, remainingAmount: number): boolean => {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) return false;
  return amount <= remainingAmount;
};

export const sortDebtLikesByDueDate = <T extends DebtLike>(debts: T[]): T[] => {
  return [...debts].sort((a, b) => {
    const dueA = getDebtLikeDueDate(a);
    const dueB = getDebtLikeDueDate(b);

    if (dueA && dueB) {
      const diff = toDebtDateOnly(dueA).getTime() - toDebtDateOnly(dueB).getTime();
      if (diff !== 0) return diff;
    } else if (dueA && !dueB) {
      return -1;
    } else if (!dueA && dueB) {
      return 1;
    }

    if (a.status !== b.status) {
      const statusWeight: Record<string, number> = { Aberta: 3, Parcial: 2, Quitada: 1 };
      const weightA = statusWeight[a.status] ?? 0;
      const weightB = statusWeight[b.status] ?? 0;
      if (weightA !== weightB) return weightB - weightA;
    }

    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
};

