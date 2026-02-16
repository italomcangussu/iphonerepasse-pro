import type { Customer, Debt, DebtStatus } from '../types';

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
  const name = normalizeName(input.name);

  if (cpf) {
    const byCpf = customers.find((customer) => normalizeDigits(customer.cpf) === cpf);
    if (byCpf) return byCpf;
  }

  if (phone) {
    const byPhone = customers.find((customer) => normalizeDigits(customer.phone) === phone);
    if (byPhone) return byPhone;
  }

  if (name) {
    return customers.find((customer) => normalizeName(customer.name) === name);
  }

  return undefined;
};

const parseDate = (value: Date | string) => {
  if (value instanceof Date) {
    return new Date(value);
  }

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

export const isDebtOverdue = (debt: Debt, now: Date = new Date()) => {
  if (!debt.dueDate) return false;
  if (debt.status === 'Quitada') return false;
  if (debt.remainingAmount <= 0) return false;

  const dueDate = toDateOnly(debt.dueDate);
  const today = toDateOnly(now);
  return dueDate.getTime() < today.getTime();
};

export const calculateDebtSummary = (debts: Debt[], now: Date = new Date()) => {
  let openAmount = 0;
  let overdueAmount = 0;
  let settledAmount = 0;

  debts.forEach((debt) => {
    if (debt.status === 'Quitada') {
      settledAmount += debt.originalAmount;
      return;
    }

    openAmount += debt.remainingAmount;
    if (isDebtOverdue(debt, now)) {
      overdueAmount += debt.remainingAmount;
    }
  });

  return { openAmount, overdueAmount, settledAmount };
};

export interface DebtFilterInput {
  searchTerm?: string;
  statusFilter?: DebtStatus | 'all';
  onlyOverdue?: boolean;
  customerById: Map<string, string>;
  now?: Date;
}

export const filterDebts = (debts: Debt[], filters: DebtFilterInput) => {
  const {
    searchTerm = '',
    statusFilter = 'all',
    onlyOverdue = false,
    customerById,
    now = new Date()
  } = filters;
  const q = searchTerm.trim().toLowerCase();

  return debts.filter((debt) => {
    const customerName = (customerById.get(debt.customerId) || '').toLowerCase();
    const notes = (debt.notes || '').toLowerCase();
    const matchSearch = q.length === 0 || customerName.includes(q) || notes.includes(q);
    const matchStatus = statusFilter === 'all' ? true : debt.status === statusFilter;
    const matchOverdue = onlyOverdue ? isDebtOverdue(debt, now) : true;
    return matchSearch && matchStatus && matchOverdue;
  });
};

export const validateDebtPaymentAmount = (amount: number, remainingAmount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) return false;
  return amount <= remainingAmount;
};
