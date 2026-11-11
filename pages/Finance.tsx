import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../services/dataContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useFinanceDemand, useSalesHistoryDemand } from '../hooks/useDataGroupDemand';
import type { FinancialAccount, Transaction } from '../types';
import DesktopContextMenuHost from '../components/ui/DesktopContextMenu';
import { ACCOUNT_BANK, ACCOUNT_DEBTORS, ACCOUNT_SAFE } from '../utils/financialAccounts';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { useDesktopContextMenu } from '../hooks/useDesktopContextMenu';
import { ERP_COMPACT_CONTENT_MAX_WIDTH } from '../lib/erpResponsive';
import { toFiniteNumber } from '../utils/number';
import {
  accountLabelByTab,
  getAccountFromTab,
  getTransactionDescription,
  resolvePayeeName,
  type TabType
} from './finance/financeHelpers';
import PeriodFilterCard from './finance/PeriodFilterCard';
import DashboardTab from './finance/DashboardTab';
import DebtorsTab from './finance/DebtorsTab';
import AccountTab from './finance/AccountTab';
import TransactionStatement from './finance/TransactionStatement';
import PayableDebtsTab from './finance/PayableDebtsTab';
import FaturamentoTab from './finance/FaturamentoTab';
import TransactionFormModal from './finance/TransactionFormModal';
import { useTransactionEditor } from './finance/useTransactionEditor';
import { useAccountTransfer } from './finance/useAccountTransfer';
import TransactionDetailsModal from './finance/TransactionDetailsModal';
import TransferModal from './finance/TransferModal';
import { useCustomerDebtsView } from './finance/useCustomerDebtsView';
import { usePayableDebtsView } from './finance/usePayableDebtsView';
import { useTransactionActions } from './finance/useTransactionActions';
import { useAccountStatement } from './finance/useAccountStatement';

// Seis visões em quatro grupos: o segmentado principal fica com 4 opções (Hick)
// e o grupo com mais de uma visão mostra uma segunda linha só com as dele.
const FINANCE_TAB_GROUPS: { id: string; label: string; tabs: { id: TabType; label: string }[] }[] = [
  { id: 'dashboard', label: 'Dashboard', tabs: [{ id: 'dashboard', label: 'Dashboard' }] },
  { id: 'cash', label: 'Caixa', tabs: [{ id: 'bank', label: ACCOUNT_BANK }, { id: 'safe', label: ACCOUNT_SAFE }] },
  { id: 'debts', label: 'Dívidas', tabs: [{ id: 'debtors', label: 'Devedores' }, { id: 'payable_debts', label: 'Contas a pagar' }] },
  { id: 'faturamento', label: 'Faturamento', tabs: [{ id: 'faturamento', label: 'Faturamento' }] }
];
const groupOfTab = (tab: TabType) => FINANCE_TAB_GROUPS.find((group) => group.tabs.some((t) => t.id === tab)) ?? FINANCE_TAB_GROUPS[0];

const isAccountTab = (tab: TabType): tab is 'bank' | 'safe' | 'debtors' => tab === 'bank' || tab === 'safe' || tab === 'debtors';
const isCashTab = (tab: TabType): tab is 'bank' | 'safe' => tab === 'bank' || tab === 'safe';

const Finance: React.FC = () => {
  const { stock, transactions, sales, sellers = [], addTransaction, updateTransaction, removeTransaction, transferBetweenAccounts, removeDebt, debts, debtPayments, customers, financialCategories, payableDebts, creditors } = useData();
  const { can } = usePermissions();
  const canEdit = can('finance', 'editable');
  const canDelete = can('finance', 'deletable');
  // Excluir dívida pelo Financeiro segue a mesma regra do banco (Devedores ou Financeiro).
  const canDeleteDebt = canDelete || can('debtors', 'deletable');
  const financeLoading = useFinanceDemand();
  const salesHistoryLoading = useSalesHistoryDemand();
  const isMobile = useIsMobileViewport(ERP_COMPACT_CONTENT_MAX_WIDTH);
  const contextMenu = useDesktopContextMenu();
  const [activeTab, setActiveTabState] = useState<TabType>('dashboard');
  // Voltar a um grupo reabre a visão que estava aberta nele (ex.: Cofre).
  const [lastTabByGroup, setLastTabByGroup] = useState<Record<string, TabType>>({});
  const activeGroup = groupOfTab(activeTab);
  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    setLastTabByGroup((prev) => ({ ...prev, [groupOfTab(tab).id]: tab }));
  };
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const getBalance = (account: FinancialAccount) =>
    transactions
      .filter((t) => t.account === account)
      .reduce((acc, t) => (t.type === 'IN' ? acc + toFiniteNumber(t.amount) : acc - toFiniteNumber(t.amount)), 0);

  const bankBalance = getBalance(ACCOUNT_BANK);
  const safeBalance = getBalance(ACCOUNT_SAFE);
  const debtorsAccountBalance = getBalance(ACCOUNT_DEBTORS);

  const transactionEditor = useTransactionEditor({
    financialCategories,
    bankBalance,
    safeBalance,
    addTransaction,
    updateTransaction,
    onOpen: () => setSelectedTransaction(null)
  });
  const transfer = useAccountTransfer({ bankBalance, safeBalance, transferBetweenAccounts });
  const customerDebts = useCustomerDebtsView({ debts, customers, removeDebt });
  const payable = usePayableDebtsView(payableDebts, creditors);
  const [salesPage, setSalesPage] = useState(0);
  const { handleCancelTransaction, buildTransactionContextActions } = useTransactionActions({
    debtPayments,
    debts,
    customers,
    transactions,
    removeTransaction,
    canEdit,
    canDelete,
    setSelectedTransaction,
    openEdit: transactionEditor.openEdit
  });




  const activeAccount = getAccountFromTab(activeTab);
  const activeBalance =
    activeAccount === ACCOUNT_BANK ? bankBalance : activeAccount === ACCOUNT_SAFE ? safeBalance : debtorsAccountBalance;

  const nameSources = { sales, sellers, customers, debts };
  const sellerNameById = useMemo(() => new Map(sellers.map((seller) => [seller.id, seller.name])), [sellers]);
  const payeeNameOf = (transaction: Transaction) => resolvePayeeName(transaction, sellerNameById);
  const statement = useAccountStatement({
    transactions,
    financialCategories,
    activeAccount,
    pageResetKey: activeTab,
    describeTransaction: (transaction) => getTransactionDescription(transaction, nameSources),
    payeeNameOf
  });
  const { datePreset, customDateFrom, customDateTo } = statement.period;
  useEffect(() => { setSalesPage(0); }, [datePreset, customDateFrom, customDateTo]);

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      {(financeLoading || salesHistoryLoading) && <p role="status" className="text-ios-subhead app-text-muted">Carregando dados financeiros...</p>}
      <div>
        <h2 className="text-ios-title-1 md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Financeiro</h2>
        <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Conta bancária, cofre, devedores e resultados</p>
      </div>

      <div className="space-y-2">
        <div className="ios-segmented-control grid grid-cols-4 sm:inline-flex w-full sm:w-auto" aria-label="Seções do financeiro">
          {FINANCE_TAB_GROUPS.map((group) => {
            const selected = activeGroup.id === group.id;
            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveTab(lastTabByGroup[group.id] ?? group.tabs[0].id)}
                data-testid={`finance-group-${group.id}`}
                className={`ios-segment min-w-0 px-2 sm:px-4 text-center whitespace-nowrap ${selected ? 'ios-segment-active' : ''}`}
              >
                {group.label}
              </button>
            );
          })}
        </div>
        {activeGroup.tabs.length > 1 && (
          <div className="ios-segmented-control grid grid-cols-2 sm:inline-flex w-full sm:w-auto" aria-label={activeGroup.label}>
            {activeGroup.tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`finance-tab-${tab.id}`}
                className={`ios-segment min-w-0 px-2 sm:px-4 text-center whitespace-nowrap ${activeTab === tab.id ? 'ios-segment-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {(isAccountTab(activeTab) || activeTab === 'faturamento') && (
        <PeriodFilterCard
          datePreset={datePreset}
          onDatePresetChange={statement.period.setDatePreset}
          customDateFrom={customDateFrom}
          onCustomDateFromChange={statement.period.setCustomDateFrom}
          customDateTo={customDateTo}
          onCustomDateToChange={statement.period.setCustomDateTo}
          categoryFilter={
            isCashTab(activeTab)
              ? { value: statement.categoryFilter, onChange: statement.setCategoryFilter, options: statement.categoryOptions }
              : null
          }
        />
      )}

      {activeTab === 'dashboard' && (
        <DashboardTab
          stock={stock}
          debtSummary={customerDebts.debtSummary}
          payableDebtSummary={payable.payableDebtSummary}
          bankBalance={bankBalance}
          safeBalance={safeBalance}
        />
      )}

      {isAccountTab(activeTab) && (
        <div className="space-y-6">
          {activeTab === 'debtors' && (
            <DebtorsTab {...customerDebts} isMobile={isMobile} canDeleteDebt={canDeleteDebt} />
          )}
          <AccountTab
            activeTab={activeTab}
            accountLabel={accountLabelByTab[activeTab]}
            activeAccount={activeAccount}
            activeBalance={activeBalance}
            canEdit={canEdit}
            accountTransactionSummary={statement.summary}
            periodCategoryOverview={statement.periodCategoryOverview}
            transactionCategoryFilter={statement.categoryFilter}
            activeCategoryFilterLabel={statement.categoryFilterLabel}
            setTransactionCategoryFilter={statement.setCategoryFilter}
            openTransactionModal={transactionEditor.open}
            onTransferClick={() => transfer.openFrom(activeAccount)}
            handleExportActiveAccountTransactions={statement.exportActiveAccount}
            statement={
              <TransactionStatement
                filtered={statement.rows}
                page={statement.page}
                setPage={statement.setPage}
                isMobile={isMobile}
                contextMenu={contextMenu}
                buildTransactionContextActions={buildTransactionContextActions}
                setSelectedTransaction={setSelectedTransaction}
                describeTransaction={(transaction) => getTransactionDescription(transaction, nameSources)}
                payeeNameOf={payeeNameOf}
              />
            }
          />
        </div>
      )}

      {activeTab === 'payable_debts' && (
        <PayableDebtsTab {...payable} isMobile={isMobile} />
      )}

      {activeTab === 'faturamento' && (
        <FaturamentoTab
          sales={sales}
          customers={customers}
          sellers={sellers}
          datePreset={datePreset}
          customDateFrom={customDateFrom}
          customDateTo={customDateTo}
          salesPage={salesPage}
          setSalesPage={setSalesPage}
          isMobile={isMobile}
        />
      )}

      <DesktopContextMenuHost controller={contextMenu} />

      <TransactionFormModal
        open={transactionEditor.isOpen}
        isEditing={transactionEditor.isEditing}
        isSaving={transactionEditor.isSaving}
        formData={transactionEditor.formData}
        setFormData={transactionEditor.setFormData}
        financialCategories={financialCategories}
        sellers={sellers}
        findDefaultManualCategory={transactionEditor.findDefaultManualCategory}
        onClose={transactionEditor.close}
        onSubmit={transactionEditor.submit}
      />

      <TransactionDetailsModal
        selectedTransaction={selectedTransaction}
        description={selectedTransaction ? getTransactionDescription(selectedTransaction, nameSources) : ''}
        payeeName={selectedTransaction && payeeNameOf(selectedTransaction)}
        canEdit={canEdit}
        canDelete={canDelete}
        onClose={() => setSelectedTransaction(null)}
        onEdit={transactionEditor.openEdit}
        onCancelTransaction={handleCancelTransaction}
      />

      <TransferModal
        open={transfer.isOpen}
        isTransferring={transfer.isTransferring}
        transferData={transfer.transferData}
        setTransferData={transfer.setTransferData}
        onClose={transfer.close}
        onSubmit={transfer.submit}
      />
    </div>
  );
};

export default Finance;
