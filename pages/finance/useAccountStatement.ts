import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../components/ui/ToastProvider';
import type { FinancialAccount, FinancialCategory, Transaction } from '../../types';
import {
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_ALL_EXPENSE,
  CATEGORY_FILTER_ALL_INCOME,
  EMPTY_ACCOUNT_TRANSACTION_SUMMARY,
  matchesCategoryFilter,
  summarizeAccountTransactions,
  summarizeByCategory
} from '../../lib/finance/accountSummary';
import { compareTransactionsChronologically } from '../../lib/finance/transactionOrder';
import { CASH_EQUIVALENT_ACCOUNTS } from '../../utils/financialAccounts';
import { buildCsv, downloadTextFile } from '../../utils/csv';
import { buildAccountStatementCsv, dedupeCategoriesByType } from './financeHelpers';
import { getEffectiveDateRange, isInDateRange, type DatePreset } from './periodRange';

const describeCategoryFilter = (filter: string): string | null => {
  if (filter === CATEGORY_FILTER_ALL) return null;
  if (filter === CATEGORY_FILTER_ALL_INCOME) return 'Todas as receitas';
  if (filter === CATEGORY_FILTER_ALL_EXPENSE) return 'Todas as despesas';
  return filter;
};

interface AccountStatementDeps {
  transactions: Transaction[];
  financialCategories: FinancialCategory[];
  activeAccount: FinancialAccount;
  // Muda de aba → volta o extrato para a primeira página.
  pageResetKey: string;
  describeTransaction: (transaction: Transaction) => string;
  payeeNameOf?: (transaction: Transaction) => string | undefined;
}

// Período, filtro de tipo, resumo e exportação do extrato da conta ativa.
export const useAccountStatement = ({
  transactions,
  financialCategories,
  activeAccount,
  pageResetKey,
  describeTransaction,
  payeeNameOf
}: AccountStatementDeps) => {
  const toast = useToast();
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [transactionCategoryFilter, setTransactionCategoryFilter] = useState('all');
  const [trxPage, setTrxPage] = useState(0);

  useEffect(() => { setTrxPage(0); }, [pageResetKey, datePreset, customDateFrom, customDateTo, transactionCategoryFilter]);

  const transactionCategoryOptions = useMemo(() => {
    const configuredCategories = financialCategories.map((category) => ({
      name: category.name,
      type: category.type
    }));
    const existingTransactionCategories = transactions
      .filter((transaction) => CASH_EQUIVALENT_ACCOUNTS.includes(transaction.account))
      .map((transaction) => ({
        name: transaction.category,
        type: transaction.type
      }));

    return dedupeCategoriesByType([...configuredCategories, ...existingTransactionCategories]);
  }, [financialCategories, transactions]);


  const getPeriodTransactionsForAccount = useCallback((accountFilter: FinancialAccount): Transaction[] => {
    const { from: dateFrom, to: dateTo } = getEffectiveDateRange(datePreset, customDateFrom, customDateTo);
    return transactions
      .filter((t) => t.account === accountFilter)
      .filter((t) => isInDateRange(t.date, dateFrom, dateTo))
      .sort(compareTransactionsChronologically);
  }, [transactions, datePreset, customDateFrom, customDateTo]);

  const getFilteredTransactionsForAccount = useCallback((accountFilter: FinancialAccount): Transaction[] => {
    const rows = getPeriodTransactionsForAccount(accountFilter);
    if (!CASH_EQUIVALENT_ACCOUNTS.includes(accountFilter)) return rows;
    return rows.filter((t) => matchesCategoryFilter(t, transactionCategoryFilter));
  }, [getPeriodTransactionsForAccount, transactionCategoryFilter]);

  const exportActiveAccount = () => {
    const rows = getFilteredTransactionsForAccount(activeAccount);
    if (rows.length === 0) {
      toast.info('Nenhuma movimentação para exportar.');
      return;
    }
    const statement = buildAccountStatementCsv(activeAccount, rows, { describe: describeTransaction, payeeOf: payeeNameOf });
    downloadTextFile(statement.fileName, buildCsv(statement.rows), 'text/csv;charset=utf-8');
    toast.success('Extrato exportado.');
  };

  const accountTransactionSummary = useMemo(() => {
    if (!CASH_EQUIVALENT_ACCOUNTS.includes(activeAccount)) return EMPTY_ACCOUNT_TRANSACTION_SUMMARY;
    return summarizeAccountTransactions(getFilteredTransactionsForAccount(activeAccount));
  }, [activeAccount, getFilteredTransactionsForAccount]);

  const periodCategoryOverview = useMemo(() => {
    const rows = CASH_EQUIVALENT_ACCOUNTS.includes(activeAccount) ? getPeriodTransactionsForAccount(activeAccount) : [];
    return { breakdown: summarizeByCategory(rows), totals: summarizeAccountTransactions(rows) };
  }, [activeAccount, getPeriodTransactionsForAccount]);


  return {
    period: { datePreset, setDatePreset, customDateFrom, setCustomDateFrom, customDateTo, setCustomDateTo },
    categoryFilter: transactionCategoryFilter,
    setCategoryFilter: setTransactionCategoryFilter,
    categoryFilterLabel: describeCategoryFilter(transactionCategoryFilter),
    categoryOptions: transactionCategoryOptions,
    rows: getFilteredTransactionsForAccount(activeAccount),
    summary: accountTransactionSummary,
    periodCategoryOverview,
    page: trxPage,
    setPage: setTrxPage,
    exportActiveAccount
  };
};
