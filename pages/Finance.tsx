import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter, Pencil, Trash2 } from 'lucide-react';
import { useData } from '../services/dataContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useFinanceDemand, useSalesHistoryDemand } from '../hooks/useDataGroupDemand';
import type { FinancialAccount, PayableDebtStatus, Transaction } from '../types';
import { useToast } from '../components/ui/ToastProvider';
import { useAsyncHandler } from '../hooks/useAsyncHandler';
import DesktopContextMenuHost from '../components/ui/DesktopContextMenu';
import type { ContextMenuAction } from '../components/ui/contextMenuCore';
import { ACCOUNT_BANK, ACCOUNT_DEBTORS, ACCOUNT_SAFE, CASH_EQUIVALENT_ACCOUNTS } from '../utils/financialAccounts';
import { sortDebtsByDueDate } from '../utils/debts';
import { calculatePayableDebtSummary, filterPayableDebts, sortPayableDebtsByDueDate } from '../utils/payableDebts';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { useDesktopContextMenu } from '../hooks/useDesktopContextMenu';
import { ERP_COMPACT_CONTENT_MAX_WIDTH } from '../lib/erpResponsive';
import { compareTransactionsChronologically } from '../lib/finance/transactionOrder';
import {
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_ALL_EXPENSE,
  CATEGORY_FILTER_ALL_INCOME,
  EMPTY_ACCOUNT_TRANSACTION_SUMMARY,
  matchesCategoryFilter,
  summarizeAccountTransactions,
  summarizeByCategory
} from '../lib/finance/accountSummary';
import { toFiniteNumber } from '../utils/number';
import { buildCsv, downloadTextFile } from '../utils/csv';
import {
  accountLabelByTab,
  buildAccountStatementCsv,
  buildCancelTransactionMessage,
  dedupeCategoriesByType,
  getAccountFromTab,
  getTransactionDescription,
  summarizeCustomerDebts,
  type TabType
} from './finance/financeHelpers';
import { getEffectiveDateRange, isInDateRange, type DatePreset } from './finance/periodRange';
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

const FINANCE_TABS: { id: TabType; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'bank', label: ACCOUNT_BANK },
  { id: 'safe', label: ACCOUNT_SAFE },
  { id: 'debtors', label: 'Devedores' },
  { id: 'payable_debts', label: 'Dívidas Ativas' },
  { id: 'faturamento', label: 'Faturamento' }
];

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
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [stockFilterType, setStockFilterType] = useState<string>('all');
  const [stockFilterCondition, setStockFilterCondition] = useState<string>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const toast = useToast();
  const run = useAsyncHandler();

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

  const customerById = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((customer) => map.set(customer.id, customer.name));
    return map;
  }, [customers]);

  const debtSummary = useMemo(() => summarizeCustomerDebts(debts), [debts]);
  const debtRows = useMemo(
    () => sortDebtsByDueDate(debts),
    [debts]
  );

  const creditorById = useMemo(() => {
    const map = new Map<string, string>();
    creditors.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [creditors]);

  const payableDebtSummary = useMemo(() => calculatePayableDebtSummary(payableDebts), [payableDebts]);

  const [pdSearchTerm, setPdSearchTerm] = useState('');
  const [pdStatusFilter, setPdStatusFilter] = useState<PayableDebtStatus | 'all'>('all');
  const [pdOnlyOverdue, setPdOnlyOverdue] = useState(false);

  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [transactionCategoryFilter, setTransactionCategoryFilter] = useState('all');


  const [trxPage, setTrxPage] = useState(0);
  const [salesPage, setSalesPage] = useState(0);
  const [debtorsPage, setDebtorsPage] = useState(0);
  const [pdPage, setPdPage] = useState(0);

  useEffect(() => { setTrxPage(0); }, [activeTab, datePreset, customDateFrom, customDateTo, transactionCategoryFilter]);
  useEffect(() => { setSalesPage(0); }, [datePreset, customDateFrom, customDateTo]);
  useEffect(() => { setPdPage(0); }, [pdSearchTerm, pdStatusFilter, pdOnlyOverdue]);

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

  const payableDebtRows = useMemo(() => {
    const filtered = filterPayableDebts(payableDebts, { searchTerm: pdSearchTerm, statusFilter: pdStatusFilter, onlyOverdue: pdOnlyOverdue, creditorById });
    return sortPayableDebtsByDueDate(filtered);
  }, [payableDebts, creditorById, pdSearchTerm, pdStatusFilter, pdOnlyOverdue]);


  const handleCancelTransaction = async (target: Transaction) => {
    if (!target) return;

    const description = buildCancelTransactionMessage(target, { debtPayments, debts, customers, transactions });

    const confirmed = await toast.confirm({
      title: 'Cancelar lançamento',
      description,
      confirmLabel: 'Cancelar lançamento',
      variant: 'danger',
    });

    if (!confirmed) return;

    await run(async () => {
      await removeTransaction(target.id);
      setSelectedTransaction((prev) => (prev?.id === target.id ? null : prev));
      toast.success('Lançamento cancelado.');
    }, 'Não foi possível cancelar o lançamento.');
  };

  const buildTransactionContextActions = (transaction: Transaction): ContextMenuAction[] => {
    const actions: ContextMenuAction[] = [
      {
        id: 'details',
        label: 'Ver detalhes',
        icon: <Filter size={16} />,
        onSelect: () => setSelectedTransaction(transaction),
      },
    ];
    if (canEdit) {
      actions.push({
        id: 'edit',
        label: 'Editar',
        icon: <Pencil size={16} />,
        onSelect: () => transactionEditor.openEdit(transaction),
      });
    }
    if (canDelete) {
      actions.push({
        id: 'cancel',
        label: 'Cancelar lançamento',
        icon: <Trash2 size={16} />,
        destructive: true,
        separatorBefore: true,
        onSelect: () => void handleCancelTransaction(transaction),
      });
    }
    return actions;
  };

  const handleDeleteDebt = async (debtId: string) => {
    const targetDebt = debts.find((debt) => debt.id === debtId);
    if (!targetDebt) return;

    const customerLabel = customerById.get(targetDebt.customerId) || 'Cliente removido';
    const confirmed = await toast.confirm({
      title: 'Excluir dívida',
      description: `Excluir a dívida de ${customerLabel} removerá a dívida, pagamentos registrados e lançamentos financeiros vinculados. Esta ação não altera a venda original.`,
      confirmLabel: 'Excluir dívida',
      variant: 'danger',
    });

    if (!confirmed) return;

    await run(async () => {
      await removeDebt(debtId);
      toast.success('Dívida excluída com sucesso.');
    }, 'Não foi possível excluir a dívida.');
  };

  // Memoizado de propósito: `accountTransactionSummary` depende deste filtro, e listar as
  // dependências aqui — coladas no corpo que as usa — evita que um filtro novo entre sem
  // que o resumo seja recalculado (o projeto não habilita react-hooks/exhaustive-deps).
  // Extrato da conta no período, ainda sem o filtro de tipo: base do resumo "Por tipo".
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

  const handleExportActiveAccountTransactions = () => {
    const account = getAccountFromTab(activeTab);
    const rows = getFilteredTransactionsForAccount(account);
    if (rows.length === 0) {
      toast.info('Nenhuma movimentação para exportar.');
      return;
    }

    const statement = buildAccountStatementCsv(account, rows, (transaction) =>
      getTransactionDescription(transaction, sales, sellers, customers, debts)
    );
    downloadTextFile(statement.fileName, buildCsv(statement.rows), 'text/csv;charset=utf-8');
    toast.success('Extrato exportado.');
  };

  const activeAccount = getAccountFromTab(activeTab);
  const activeBalance =
    activeAccount === ACCOUNT_BANK ? bankBalance : activeAccount === ACCOUNT_SAFE ? safeBalance : debtorsAccountBalance;

  const accountTransactionSummary = useMemo(() => {
    if (!CASH_EQUIVALENT_ACCOUNTS.includes(activeAccount)) return EMPTY_ACCOUNT_TRANSACTION_SUMMARY;
    return summarizeAccountTransactions(getFilteredTransactionsForAccount(activeAccount));
  }, [activeAccount, getFilteredTransactionsForAccount]);

  const periodCategoryOverview = useMemo(() => {
    const rows = CASH_EQUIVALENT_ACCOUNTS.includes(activeAccount) ? getPeriodTransactionsForAccount(activeAccount) : [];
    return { breakdown: summarizeByCategory(rows), totals: summarizeAccountTransactions(rows) };
  }, [activeAccount, getPeriodTransactionsForAccount]);

  const activeCategoryFilterLabel =
    transactionCategoryFilter === CATEGORY_FILTER_ALL
      ? null
      : transactionCategoryFilter === CATEGORY_FILTER_ALL_INCOME
        ? 'Todas as receitas'
        : transactionCategoryFilter === CATEGORY_FILTER_ALL_EXPENSE
          ? 'Todas as despesas'
          : transactionCategoryFilter;


  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      {(financeLoading || salesHistoryLoading) && <p role="status" className="text-ios-subhead app-text-muted">Carregando dados financeiros...</p>}
      <div>
        <h2 className="text-ios-title-1 md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Financeiro</h2>
        <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Conta bancária, cofre, devedores e resultados</p>
      </div>

      <div className="ios-segmented-control grid grid-cols-2 sm:flex overflow-visible sm:overflow-x-auto">
        {FINANCE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`finance-tab-${tab.id}`}
            className={`ios-segment min-w-0 px-2 text-center leading-tight whitespace-normal sm:whitespace-nowrap ${activeTab === tab.id ? 'ios-segment-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(isAccountTab(activeTab) || activeTab === 'faturamento') && (
        <PeriodFilterCard
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          customDateFrom={customDateFrom}
          onCustomDateFromChange={setCustomDateFrom}
          customDateTo={customDateTo}
          onCustomDateToChange={setCustomDateTo}
          categoryFilter={
            isCashTab(activeTab)
              ? { value: transactionCategoryFilter, onChange: setTransactionCategoryFilter, options: transactionCategoryOptions }
              : null
          }
        />
      )}

      {activeTab === 'dashboard' && (
        <DashboardTab
          stock={stock}
          stockFilterType={stockFilterType}
          onStockFilterTypeChange={setStockFilterType}
          stockFilterCondition={stockFilterCondition}
          onStockFilterConditionChange={setStockFilterCondition}
          debtSummary={debtSummary}
          payableDebtSummary={payableDebtSummary}
          bankBalance={bankBalance}
          safeBalance={safeBalance}
        />
      )}

      {isAccountTab(activeTab) && (
        <div className="space-y-6">
          {activeTab === 'debtors' && (
            <DebtorsTab
              debtSummary={debtSummary}
              debtRows={debtRows}
              customerById={customerById}
              debtorsPage={debtorsPage}
              setDebtorsPage={setDebtorsPage}
              isMobile={isMobile}
              canDeleteDebt={canDeleteDebt}
              handleDeleteDebt={handleDeleteDebt}
            />
          )}
          <AccountTab
            activeTab={activeTab}
            accountLabel={accountLabelByTab[activeTab]}
            activeAccount={activeAccount}
            activeBalance={activeBalance}
            canEdit={canEdit}
            accountTransactionSummary={accountTransactionSummary}
            periodCategoryOverview={periodCategoryOverview}
            transactionCategoryFilter={transactionCategoryFilter}
            activeCategoryFilterLabel={activeCategoryFilterLabel}
            setTransactionCategoryFilter={setTransactionCategoryFilter}
            openTransactionModal={transactionEditor.open}
            onTransferClick={() => transfer.openFrom(activeAccount)}
            handleExportActiveAccountTransactions={handleExportActiveAccountTransactions}
            statement={
              <TransactionStatement
                filtered={getFilteredTransactionsForAccount(activeAccount)}
                page={trxPage}
                setPage={setTrxPage}
                isMobile={isMobile}
                contextMenu={contextMenu}
                buildTransactionContextActions={buildTransactionContextActions}
                setSelectedTransaction={setSelectedTransaction}
              />
            }
          />
        </div>
      )}

      {activeTab === 'payable_debts' && (
        <PayableDebtsTab
          payableDebtSummary={payableDebtSummary}
          payableDebtRows={payableDebtRows}
          creditorById={creditorById}
          pdSearchTerm={pdSearchTerm}
          setPdSearchTerm={setPdSearchTerm}
          pdStatusFilter={pdStatusFilter}
          setPdStatusFilter={setPdStatusFilter}
          pdOnlyOverdue={pdOnlyOverdue}
          setPdOnlyOverdue={setPdOnlyOverdue}
          pdPage={pdPage}
          setPdPage={setPdPage}
          isMobile={isMobile}
        />
      )}

      {activeTab === 'faturamento' && (
        <FaturamentoTab
          sales={sales}
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
        findDefaultManualCategory={transactionEditor.findDefaultManualCategory}
        onClose={transactionEditor.close}
        onSubmit={transactionEditor.submit}
      />

      <TransactionDetailsModal
        selectedTransaction={selectedTransaction}
        description={selectedTransaction ? getTransactionDescription(selectedTransaction, sales, sellers, customers, debts) : ''}
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
