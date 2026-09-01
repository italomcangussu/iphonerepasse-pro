import type { Customer, Debt, DebtPayment, DebtStatus } from '../types';
import {
  calculateDebtLikeSummary,
  getDebtLikeDeadlineBadge,
  getDebtLikeDueDate,
  isDebtLikeOverdue,
  sortDebtLikesByDueDate,
  validateDebtLikePaymentAmount,
} from './debtCore';

export type CustomerMatchInput = Partial<Customer> & { name: string };

export const normalizeDigits = (value?: string) => (value || '').replace(/\D/g, '');

export const normalizeName = (value?: string) =>
  (value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

export const matchCustomerByPriority = (customers: Customer[], input: CustomerMatchInput): Customer | undefined => {
  const cpf = normalizeDigits(input.cpf);
  const phone = normalizeDigits(input.phone);
  const alternativePhone = normalizeDigits(input.alternativePhone);
  const name = normalizeName(input.name);

  if (cpf) {
    const byCpf = customers.find((customer) => normalizeDigits(customer.cpf) === cpf);
    if (byCpf) return byCpf;
  }

  if (phone) {
    const byPhone = customers.find((customer) => (
      normalizeDigits(customer.phone) === phone || normalizeDigits(customer.alternativePhone) === phone
    ));
    if (byPhone) return byPhone;
  }

  if (alternativePhone) {
    const byAlternativePhone = customers.find((customer) => (
      normalizeDigits(customer.alternativePhone) === alternativePhone || normalizeDigits(customer.phone) === alternativePhone
    ));
    if (byAlternativePhone) return byAlternativePhone;
  }

  if (name) {
    return customers.find((customer) => normalizeName(customer.name) === name);
  }

  return undefined;
};

export type DebtDeadlineBadge = 'Em aberto' | 'Atrasado' | 'Em dias' | 'Pago';

export const getDebtDueDate = (debt: Debt) => getDebtLikeDueDate(debt);

export const isDebtOverdue = (debt: Debt, now?: Date) => isDebtLikeOverdue(debt, now);

export const getDebtDeadlineBadge = (
  debt: Debt,
  payments: Pick<DebtPayment, 'paidAt'>[] = [],
  now?: Date,
): DebtDeadlineBadge => {
  if (debt.customBadge) return debt.customBadge as DebtDeadlineBadge;
  return getDebtLikeDeadlineBadge(debt, payments, now);
};

export const calculateDebtSummary = (debts: Debt[], now?: Date) =>
  calculateDebtLikeSummary(debts, now);

export type DebtSubtypeFilter = 'all' | 'em_dia' | 'atrasada';

export interface DebtFilterInput {
  searchTerm?: string;
  statusFilter?: DebtStatus | 'all';
  subtypeFilter?: DebtSubtypeFilter;
  onlyOverdue?: boolean;
  customerById: Map<string, string>;
  now?: Date;
}

export const filterDebts = (debts: Debt[], filters: DebtFilterInput) => {
  const {
    searchTerm = '',
    statusFilter = 'all',
    subtypeFilter = 'all',
    onlyOverdue = false,
    customerById,
    now = new Date(),
  } = filters;
  const q = searchTerm.trim().toLowerCase();

  return debts.filter((debt) => {
    const customerName = (customerById.get(debt.customerId) || '').toLowerCase();
    const notes = (debt.notes || '').toLowerCase();
    const matchSearch = q.length === 0 || customerName.includes(q) || notes.includes(q);
    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'Aberta'
          ? debt.status === 'Aberta' || debt.status === 'Parcial'
          : debt.status === statusFilter;
    const isOverdue = isDebtOverdue(debt, now);
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

export const validateDebtPaymentAmount = (amount: number, remainingAmount: number) =>
  validateDebtLikePaymentAmount(amount, remainingAmount);

export const sortDebtsByDueDate = (debts: Debt[]) =>
  sortDebtLikesByDueDate(debts);

