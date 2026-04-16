import type { FinancialAccount } from '../types';

export const ACCOUNT_BANK: FinancialAccount = 'Conta Bancária';
export const ACCOUNT_SAFE: FinancialAccount = 'Cofre';
export const ACCOUNT_DEBTORS: FinancialAccount = 'Devedores';

export const FINANCIAL_ACCOUNTS: FinancialAccount[] = [ACCOUNT_BANK, ACCOUNT_SAFE, ACCOUNT_DEBTORS];
export const CASH_EQUIVALENT_ACCOUNTS: FinancialAccount[] = [ACCOUNT_BANK, ACCOUNT_SAFE];

export const normalizeFinancialAccount = (value?: string | null): FinancialAccount => {
  if (!value || value === 'Caixa' || value === ACCOUNT_BANK) return ACCOUNT_BANK;
  if (value === ACCOUNT_SAFE) return ACCOUNT_SAFE;
  if (value === ACCOUNT_DEBTORS) return ACCOUNT_DEBTORS;
  return ACCOUNT_BANK;
};

