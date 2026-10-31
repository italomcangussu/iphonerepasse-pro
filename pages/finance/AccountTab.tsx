import React from 'react';
import { ArrowDownCircle, ArrowRightLeft, ArrowUpCircle, Download } from 'lucide-react';
import type { AccountTransactionSummary, CategoryBreakdown } from '../../lib/finance/accountSummary';
import type { FinancialAccount } from '../../types';
import AccountSummaryCard from './AccountSummaryCard';
import CategoryBreakdownCard from './CategoryBreakdownCard';
import { formatSignedBRL } from './financeHelpers';

type AccountTabId = 'bank' | 'safe' | 'debtors';

const BALANCE_BORDER_BY_TAB: Record<AccountTabId, string> = {
  bank: 'border-brand-200 dark:border-brand-800',
  safe: 'border-accent-200 dark:border-accent-800',
  debtors: 'border-orange-200 dark:border-orange-900/40'
};

interface BalanceCardProps {
  activeTab: AccountTabId;
  balance: number;
  // Aporte/Pagar/Transferir só nas contas reais: lançamentos manuais na conta
  // virtual 'Devedores' extraviavam dinheiro do Cofre/Conta.
  showActions: boolean;
  onIncome: () => void;
  onExpense: () => void;
  onTransfer: () => void;
}

const BalanceCard: React.FC<BalanceCardProps> = ({ activeTab, balance, showActions, onIncome, onExpense, onTransfer }) => (
  <div className={`ios-card p-5 md:p-8 ${BALANCE_BORDER_BY_TAB[activeTab]}`}>
    <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mb-2">Saldo Disponível</p>
    <h3
      className={`text-ios-title-1 md:text-ios-large font-bold tabular-nums mb-5 md:mb-8 ${
        balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
      }`}
    >
      {formatSignedBRL(balance)}
    </h3>

    {showActions && (
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onIncome}
          data-testid="finance-action-aporte"
          className="ios-button bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2"
        >
          <ArrowUpCircle size={18} /> Aporte
        </button>
        <button onClick={onExpense} className="ios-button bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2">
          <ArrowDownCircle size={18} /> Pagar
        </button>
        <button onClick={onTransfer} className="col-span-2 ios-button-secondary flex items-center justify-center gap-2">
          <ArrowRightLeft size={18} /> Transferir
        </button>
      </div>
    )}
  </div>
);

interface StatementCardProps {
  accountLabel: string;
  filterLabel: string | null;
  onExport: () => void;
  children: React.ReactNode;
}

const StatementCard: React.FC<StatementCardProps> = ({ accountLabel, filterLabel, onExport, children }) => (
  <div className="lg:col-span-2 ios-card flex flex-col">
    <div className="p-6 border-b border-gray-200 dark:border-surface-dark-200 flex justify-between items-center">
      <div className="min-w-0">
        <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Extrato de Movimentações - {accountLabel}</h3>
        {filterLabel && <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500">Mostrando: {filterLabel}</p>}
      </div>
      <button
        type="button"
        onClick={onExport}
        className="w-11 h-11 hit-target-44 inline-flex items-center justify-center text-gray-400 dark:text-surface-dark-500 hover:text-gray-600 rounded-ios-lg hover:bg-gray-100 dark:hover:bg-surface-dark-200"
        aria-label={`Exportar extrato de ${accountLabel}`}
      >
        <Download size={20} />
      </button>
    </div>
    {children}
  </div>
);

interface AccountTabProps {
  activeTab: AccountTabId;
  accountLabel: string;
  activeAccount: FinancialAccount;
  activeBalance: number;
  canEdit: boolean;
  accountTransactionSummary: AccountTransactionSummary;
  periodCategoryOverview: { breakdown: CategoryBreakdown; totals: AccountTransactionSummary };
  transactionCategoryFilter: string;
  activeCategoryFilterLabel: string | null;
  setTransactionCategoryFilter: (value: string) => void;
  openTransactionModal: (type: 'IN' | 'OUT', account: FinancialAccount) => void;
  onTransferClick: () => void;
  handleExportActiveAccountTransactions: () => void;
  statement: React.ReactNode;
}

const AccountTab: React.FC<AccountTabProps> = ({
  activeTab,
  accountLabel,
  activeAccount,
  activeBalance,
  canEdit,
  accountTransactionSummary,
  periodCategoryOverview,
  transactionCategoryFilter,
  activeCategoryFilterLabel,
  setTransactionCategoryFilter,
  openTransactionModal,
  onTransferClick,
  handleExportActiveAccountTransactions,
  statement
}) => {
  const isCashAccount = activeTab !== 'debtors';

  return (
    <>
      {isCashAccount && (
        <div
          className="ios-card divide-y divide-gray-100 dark:divide-surface-dark-200 md:grid md:grid-cols-3 md:divide-y-0 md:divide-x"
          data-testid="account-summary-cards"
        >
          <AccountSummaryCard label="Total Entradas" value={accountTransactionSummary.totalIn} tone="in" />
          <AccountSummaryCard label="Total Saídas" value={accountTransactionSummary.totalOut} tone="out" />
          <AccountSummaryCard label="Movimentação Líquida" value={accountTransactionSummary.net} tone="net" />
        </div>
      )}

      {isCashAccount && (
        <CategoryBreakdownCard
          breakdown={periodCategoryOverview.breakdown}
          totalIn={periodCategoryOverview.totals.totalIn}
          totalOut={periodCategoryOverview.totals.totalOut}
          activeFilter={transactionCategoryFilter}
          activeFilterLabel={activeCategoryFilterLabel}
          onFilterChange={setTransactionCategoryFilter}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <BalanceCard
            activeTab={activeTab}
            balance={activeBalance}
            showActions={canEdit && isCashAccount}
            onIncome={() => openTransactionModal('IN', activeAccount)}
            onExpense={() => openTransactionModal('OUT', activeAccount)}
            onTransfer={onTransferClick}
          />
        </div>
        <StatementCard
          accountLabel={accountLabel}
          filterLabel={isCashAccount ? activeCategoryFilterLabel : null}
          onExport={handleExportActiveAccountTransactions}
        >
          {statement}
        </StatementCard>
      </div>
    </>
  );
};

export default AccountTab;
