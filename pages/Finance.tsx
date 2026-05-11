import React, { useEffect, useMemo, useState } from 'react';
import { useDisclosure } from '../hooks/useDisclosure';
import { useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useData } from '../services/dataContext';
import { StockStatus, DeviceType, Transaction, Condition, FinancialAccount } from '../types';
import { ArrowDownCircle, ArrowRightLeft, ArrowUpCircle, CalendarDays, Download, Filter, Pencil, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useToast } from '../components/ui/ToastProvider';
import { useAsyncHandler } from '../hooks/useAsyncHandler';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { newId } from '../utils/id';
import StableResponsiveContainer from '../components/charts/StableResponsiveContainer';
import {
  ACCOUNT_BANK,
  ACCOUNT_DEBTORS,
  ACCOUNT_SAFE,
  CASH_EQUIVALENT_ACCOUNTS,
  FINANCIAL_ACCOUNTS
} from '../utils/financialAccounts';
import { isDebtOverdue } from '../utils/debts';
import { calculatePayableDebtSummary, filterPayableDebts, getPayableDebtDeadlineBadge, getPayableDebtDueDate, isPayableDebtOverdue } from '../utils/payableDebts';
import type { PayableDebtStatus } from '../types';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';

type TabType = 'dashboard' | 'bank' | 'safe' | 'debtors' | 'payable_debts' | 'faturamento';
type DatePreset = 'all' | 'today' | 'yesterday' | 'current_month' | 'last_month' | 'year' | 'custom';

const getEffectiveDateRange = (
  preset: DatePreset,
  customFrom: string,
  customTo: string
): { from: Date | null; to: Date | null } => {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  switch (preset) {
    case 'today':
      return { from: startOfToday, to: endOfToday };
    case 'yesterday': {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      return {
        from: new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0),
        to: new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999),
      };
    }
    case 'current_month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfToday };
    case 'last_month': {
      const fm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lm = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from: fm, to: lm };
    }
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfToday };
    case 'custom':
      return {
        from: customFrom ? new Date(`${customFrom}T00:00:00`) : null,
        to: customTo ? new Date(`${customTo}T23:59:59`) : null,
      };
    default:
      return { from: null, to: null };
  }
};

const isInDateRange = (dateStr: string, from: Date | null, to: Date | null): boolean => {
  if (!from && !to) return true;
  const d = new Date(dateStr);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};

const toFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getAccountFromTab = (tab: TabType): FinancialAccount => {
  if (tab === 'safe') return ACCOUNT_SAFE;
  if (tab === 'debtors') return ACCOUNT_DEBTORS;
  return ACCOUNT_BANK;
};

const accountLabelByTab: Record<'bank' | 'safe' | 'debtors', string> = {
  bank: ACCOUNT_BANK,
  safe: ACCOUNT_SAFE,
  debtors: ACCOUNT_DEBTORS
};


const Finance: React.FC = () => {
  const { stock, transactions, sales, addTransaction, updateTransaction, removeTransaction, removeDebt, debts, debtPayments, customers, financialCategories, payableDebts, creditors } = useData();
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobileViewport();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [stockFilterType, setStockFilterType] = useState<string>('all');
  const [stockFilterCondition, setStockFilterCondition] = useState<string>('all');
  const { isOpen: isTransModalOpen, open: openTransModal, close: closeTransModal } = useDisclosure();
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const { isOpen: isTransferModalOpen, open: openTransferModal, close: closeTransferModal } = useDisclosure();
  const [isTransferring, setIsTransferring] = useState(false);
  const [transFormData, setTransFormData] = useState<{
    type: 'IN' | 'OUT';
    category: Transaction['category'];
    amount: string;
    description: string;
    date: string;
    account: FinancialAccount;
  }>({
    type: 'IN',
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString(),
    account: ACCOUNT_BANK
  });
  const [transferData, setTransferData] = useState<{
    from: FinancialAccount;
    to: FinancialAccount;
    amount: string;
  }>({
    from: ACCOUNT_BANK,
    to: ACCOUNT_SAFE,
    amount: ''
  });
  const toast = useToast();
  const run = useAsyncHandler();

  const inUseStats = useMemo(() => {
    const items = stock.filter((s) => s.status === StockStatus.IN_USE);
    const acquisitionCost = items.reduce((acc, item) => {
      const repairCosts = (Array.isArray(item.costs) ? item.costs : []).reduce((r, c) => r + toFiniteNumber(c.amount), 0);
      return acc + toFiniteNumber(item.purchasePrice) + repairCosts;
    }, 0);
    const salesValue = items.reduce((acc, item) => acc + toFiniteNumber(item.sellPrice), 0);
    return { count: items.length, acquisitionCost, salesValue };
  }, [stock]);

  const stockStats = useMemo(() => {
    let filtered = stock.filter((s) => s.status === StockStatus.AVAILABLE || s.status === StockStatus.PREPARATION);

    if (stockFilterType !== 'all') {
      filtered = filtered.filter((s) => s.type === stockFilterType);
    }
    if (stockFilterCondition !== 'all') {
      filtered = filtered.filter((s) => s.condition === stockFilterCondition);
    }

    const acquisitionCost = filtered.reduce((acc, item) => {
      const repairCosts = (Array.isArray(item.costs) ? item.costs : []).reduce((cAcc, c) => cAcc + toFiniteNumber(c.amount), 0);
      return acc + toFiniteNumber(item.purchasePrice) + repairCosts;
    }, 0);

    const salesValue = filtered.reduce((acc, item) => acc + toFiniteNumber(item.sellPrice), 0);
    const projectedProfit = salesValue - acquisitionCost;

    return { count: filtered.length, acquisitionCost, salesValue, projectedProfit };
  }, [stock, stockFilterType, stockFilterCondition]);

  const getBalance = (account: FinancialAccount) =>
    transactions
      .filter((t) => t.account === account)
      .reduce((acc, t) => (t.type === 'IN' ? acc + toFiniteNumber(t.amount) : acc - toFiniteNumber(t.amount)), 0);

  const bankBalance = getBalance(ACCOUNT_BANK);
  const safeBalance = getBalance(ACCOUNT_SAFE);
  const debtorsAccountBalance = getBalance(ACCOUNT_DEBTORS);

  const customerById = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((customer) => map.set(customer.id, customer.name));
    return map;
  }, [customers]);

  const debtSummary = useMemo(() => {
    let openAmount = 0;
    let overdueAmount = 0;
    let settledAmount = 0;

    debts.forEach((debt) => {
      if (debt.status === 'Quitada') {
        settledAmount += debt.originalAmount;
        return;
      }

      openAmount += debt.remainingAmount;
      if (isDebtOverdue(debt)) {
        overdueAmount += debt.remainingAmount;
      }
    });

    return { openAmount, overdueAmount, settledAmount };
  }, [debts]);

  const debtRows = useMemo(
    () =>
      [...debts].sort((a, b) => {
        const overdueA = isDebtOverdue(a) ? 1 : 0;
        const overdueB = isDebtOverdue(b) ? 1 : 0;
        if (overdueA !== overdueB) return overdueB - overdueA;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
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

  const PAGE_SIZE_TRX = 50;
  const PAGE_SIZE_SALES = 25;
  const PAGE_SIZE_DEBTS = 15;
  const PAGE_SIZE_PD = 15;

  const [trxPage, setTrxPage] = useState(0);
  const [salesPage, setSalesPage] = useState(0);
  const [debtorsPage, setDebtorsPage] = useState(0);
  const [pdPage, setPdPage] = useState(0);

  useEffect(() => { setTrxPage(0); }, [activeTab, datePreset, customDateFrom, customDateTo]);
  useEffect(() => { setSalesPage(0); }, [datePreset, customDateFrom, customDateTo]);
  useEffect(() => { setPdPage(0); }, [pdSearchTerm, pdStatusFilter, pdOnlyOverdue]);

  const payableDebtRows = useMemo(() => {
    const filtered = filterPayableDebts(payableDebts, { searchTerm: pdSearchTerm, statusFilter: pdStatusFilter, onlyOverdue: pdOnlyOverdue, creditorById });
    return filtered.sort((a, b) => {
      const overdueA = isPayableDebtOverdue(a) ? 1 : 0;
      const overdueB = isPayableDebtOverdue(b) ? 1 : 0;
      if (overdueA !== overdueB) return overdueB - overdueA;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [payableDebts, creditorById, pdSearchTerm, pdStatusFilter, pdOnlyOverdue]);

  const salesReport = useMemo(() => {
    const { from: dateFrom, to: dateTo } = getEffectiveDateRange(datePreset, customDateFrom, customDateTo);
    return sales
      .filter((sale) => isInDateRange(sale.date, dateFrom, dateTo))
      .map((sale) => {
        const items = Array.isArray(sale.items) ? sale.items : [];
        const costOfGoods = items.reduce((acc, item) => {
          const repairs = (Array.isArray(item.costs) ? item.costs : []).reduce((r, c) => r + toFiniteNumber(c.amount), 0);
          return acc + toFiniteNumber(item.purchasePrice) + repairs;
        }, 0);

        const netFinancialTotal = toFiniteNumber(sale.total);
        const tradeInValue = toFiniteNumber(sale.tradeInValue);
        const revenue = netFinancialTotal + tradeInValue;
        const profit = revenue - costOfGoods;
        const cardSurcharge = (sale.paymentMethods || []).reduce((acc, payment) => acc + toFiniteNumber(payment.feeAmount), 0);
        const financialPaymentsTotal = (sale.paymentMethods || []).reduce(
          (acc, payment) => acc + toFiniteNumber(payment.customerAmount ?? payment.amount),
          0
        );
        const customerChargedTotal = financialPaymentsTotal + tradeInValue;

        return {
          ...sale,
          items,
          total: revenue,
          netFinancialTotal,
          tradeInValue,
          costOfGoods,
          profit,
          cardSurcharge,
          customerChargedTotal
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, datePreset, customDateFrom, customDateTo]);

  const closeTransactionModal = () => {
    closeTransModal();
    setEditingTransactionId(null);
    setTransFormData({
      type: 'IN',
      category: 'Aporte',
      amount: '',
      description: '',
      date: new Date().toISOString(),
      account: ACCOUNT_BANK
    });
  };

  const handleSaveTransaction = async () => {
    console.log('[Finance] handleSaveTransaction start', {
      amount: transFormData.amount,
      description: transFormData.description,
      type: transFormData.type,
      category: transFormData.category,
      account: transFormData.account,
      editingTransactionId,
    });

    const rawAmount = String(transFormData.amount ?? '').replace(',', '.').trim();

    if (!rawAmount) {
      toast.error('Informe o valor.');
      return;
    }

    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    const trimmedDescription = transFormData.description.trim();
    const effectiveDescription =
      trimmedDescription ||
      buildDefaultTransactionDescription(transFormData.type, transFormData.account);

    const payload: Omit<Transaction, 'id'> = {
      type: transFormData.type,
      category: transFormData.category,
      amount,
      description: effectiveDescription,
      date: transFormData.date || new Date().toISOString(),
      account: transFormData.account
    };

    setIsSavingTransaction(true);
    try {
      if (editingTransactionId) {
        await updateTransaction(editingTransactionId, payload);
        toast.success('Lançamento atualizado.');
      } else {
        await addTransaction({
          id: newId('trx'),
          ...payload
        });
        toast.success('Movimentação registrada.');
      }
      closeTransactionModal();
    } catch (error: any) {
      console.error('[Finance] handleSaveTransaction error:', error);
      const fallbackMessage =
        typeof error === 'string' ? error : error?.message || error?.error_description || error?.details;
      toast.error(fallbackMessage || 'Não foi possível salvar o lançamento.');
    } finally {
      setIsSavingTransaction(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferData.amount) {
      toast.error('Informe o valor da transferencia.');
      return;
    }
    const amount = Number(transferData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Informe um valor valido.');
      return;
    }
    if (transferData.from === transferData.to) {
      toast.error('Selecione contas diferentes para transferir.');
      return;
    }

    await run(async () => {
      await addTransaction({
        id: newId('trx-tr-out'),
        type: 'OUT',
        category: 'Serviço',
        amount,
        description: `Transferência para ${transferData.to}`,
        date: new Date().toISOString(),
        account: transferData.from
      });

      await addTransaction({
        id: newId('trx-tr-in'),
        type: 'IN',
        category: 'Aporte',
        amount,
        description: `Transferência de ${transferData.from}`,
        date: new Date().toISOString(),
        account: transferData.to
      });

      closeTransferModal();
      setTransferData({ from: ACCOUNT_BANK, to: ACCOUNT_SAFE, amount: '' });
      toast.success('Transferencia realizada.');
    }, { errorMsg: 'Nao foi possivel realizar a transferencia.', setLoading: setIsTransferring });
  };

  const buildDefaultTransactionDescription = (type: 'IN' | 'OUT', account: FinancialAccount) =>
    type === 'IN' ? `Aporte em ${account}` : `Pagamento em ${account}`;

  const openTransactionModal = (type: 'IN' | 'OUT', account: FinancialAccount) => {
    setEditingTransactionId(null);
    setSelectedTransaction(null);
    const defaultCat = financialCategories.find(c => c.type === type && c.isDefault) || financialCategories.find(c => c.type === type);
    setTransFormData({
      type,
      category: defaultCat ? defaultCat.name : '',
      amount: '',
      description: buildDefaultTransactionDescription(type, account),
      date: new Date().toISOString(),
      account
    });
    openTransModal();
  };

  const openEditTransactionModal = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id);
    setTransFormData({
      type: transaction.type,
      category: transaction.category,
      amount: String(toFiniteNumber(transaction.amount)),
      description: transaction.description,
      date: transaction.date,
      account: transaction.account
    });
    setSelectedTransaction(null);
    openTransModal();
  };

  const handleCancelTransaction = async (target: Transaction) => {
    if (!target) return;

    const baseMessage = `Tem certeza que deseja cancelar o lançamento "${target.description}"?`;
    let description = baseMessage;

    if (target.debtPaymentId) {
      const linkedPayment = debtPayments.find((p) => p.id === target.debtPaymentId);
      if (linkedPayment) {
        const linkedDebt = debts.find((d) => d.id === linkedPayment.debtId);
        const customer = linkedDebt ? customers.find((c) => c.id === linkedDebt.customerId) : undefined;
        const customerLabel = customer?.name ? ` do cliente ${customer.name}` : '';
        const amountLabel = toFiniteNumber(linkedPayment.amount).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        description = `${baseMessage} Isso estornará o pagamento${customerLabel} e devolverá R$ ${amountLabel} à dívida.`;
      }
    }

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

  const renderTransactionTable = (accountFilter: FinancialAccount, page: number, setPage: (p: number) => void) => {
    const { from: dateFrom, to: dateTo } = getEffectiveDateRange(datePreset, customDateFrom, customDateTo);
    const filtered = transactions
      .filter((t) => t.account === accountFilter)
      .filter((t) => isInDateRange(t.date, dateFrom, dateTo))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE_TRX);
    const paginated = filtered.slice(page * PAGE_SIZE_TRX, (page + 1) * PAGE_SIZE_TRX);

    if (isMobile) {
      if (filtered.length === 0) {
        return <div className="p-6 text-center text-gray-500">Nenhuma movimentação registrada.</div>;
      }

      return (
        <div>
          <div className="p-4 md:p-6 space-y-3">
            {paginated.map((t) => (
              <button
                key={t.id}
                type="button"
                className="ios-card w-full p-4 space-y-2 text-left hover:ring-1 hover:ring-brand-200"
                onClick={() => setSelectedTransaction(t)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-surface-dark-500">
                      {new Date(t.date).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{t.description}</p>
                  </div>
                  <p className={`text-sm font-bold ${t.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'IN' ? '+' : '-'} R$ {toFiniteNumber(t.amount).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`ios-badge ${t.type === 'IN' ? 'ios-badge-green' : 'ios-badge-orange'}`}>{t.category}</span>
                  <span className="text-xs text-gray-500">Toque para detalhes</span>
                </div>
              </button>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE_TRX} onPageChange={setPage} />
        </div>
      );
    }

    return (
      <div>
        <table className="w-full table-fixed text-left">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[45%]" />
            <col className="w-[21%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr className="text-ios-footnote text-gray-500 border-b border-gray-200 dark:border-surface-dark-200">
              <th className="p-4 font-medium">Data</th>
              <th className="p-4 font-medium">Descrição</th>
              <th className="p-4 font-medium">Categoria</th>
              <th className="p-4 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-200">
            {paginated.map((t) => (
              <tr
                key={t.id}
                className="hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors cursor-pointer"
                onClick={() => setSelectedTransaction(t)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedTransaction(t);
                  }
                }}
                tabIndex={0}
              >
                <td className="p-4 text-ios-subhead text-gray-600 dark:text-surface-dark-600">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                <td className="p-4 text-gray-900 dark:text-white font-medium">{t.description}</td>
                <td className="p-4">
                  <span className={`ios-badge ${t.type === 'IN' ? 'ios-badge-green' : 'ios-badge-orange'}`}>{t.category}</span>
                </td>
                <td className={`p-4 text-right font-bold ${t.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === 'IN' ? '+' : '-'} R$ {toFiniteNumber(t.amount).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  Nenhuma movimentação registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE_TRX} onPageChange={setPage} />
      </div>
    );
  };

  const activeAccount = getAccountFromTab(activeTab);
  const activeBalance =
    activeAccount === ACCOUNT_BANK ? bankBalance : activeAccount === ACCOUNT_SAFE ? safeBalance : debtorsAccountBalance;
  const isIncomingTransaction = transFormData.type === 'IN';
  const isEditingTransaction = !!editingTransactionId;
  const transactionModalTitle = isEditingTransaction ? 'Editar lançamento' : isIncomingTransaction ? 'Novo Aporte' : 'Novo Pagamento';
  const transactionModalConfirmLabel = isEditingTransaction
    ? 'Salvar alterações'
    : isIncomingTransaction
      ? 'Confirmar Aporte'
      : 'Confirmar Pagamento';
  const transactionDescriptionPlaceholder = isIncomingTransaction ? 'Ex: Aporte em caixa' : 'Ex: Pagamento de conta';

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Financeiro</h2>
        <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Conta bancária, cofre, devedores e resultados</p>
      </div>

      <div className="ios-segmented-control grid grid-cols-2 sm:flex overflow-visible sm:overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'bank', label: ACCOUNT_BANK },
          { id: 'safe', label: ACCOUNT_SAFE },
          { id: 'debtors', label: 'Devedores' },
          { id: 'payable_debts', label: 'Dívidas Ativas' },
          { id: 'faturamento', label: 'Faturamento' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            data-testid={`finance-tab-${tab.id}`}
            className={`ios-segment min-w-0 px-2 text-center leading-tight whitespace-normal sm:whitespace-nowrap ${activeTab === tab.id ? 'ios-segment-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(activeTab === 'bank' || activeTab === 'safe' || activeTab === 'debtors' || activeTab === 'faturamento') && (
        <div className="ios-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <CalendarDays size={18} className="text-gray-400 dark:text-surface-dark-500 shrink-0" />
            <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1 pb-0.5">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'today', label: 'Hoje' },
                  { id: 'yesterday', label: 'Ontem' },
                  { id: 'current_month', label: 'Mês Atual' },
                  { id: 'last_month', label: 'Último Mês' },
                  { id: 'year', label: 'Este Ano' },
                  { id: 'custom', label: 'Período' },
                ] as { id: DatePreset; label: string }[]
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDatePreset(id)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    datePreset === id
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-surface-dark-200 text-gray-600 dark:text-surface-dark-600 hover:bg-gray-200 dark:hover:bg-surface-dark-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {datePreset === 'custom' && (
            <div className="flex flex-wrap gap-3 items-center pl-7">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-surface-dark-500 shrink-0">De</span>
                <input
                  type="date"
                  className="ios-input py-1.5 text-sm"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-surface-dark-500 shrink-0">Até</span>
                <input
                  type="date"
                  className="ios-input py-1.5 text-sm"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-4 ios-card p-4">
            <div className="flex items-center gap-2 text-gray-500">
              <Filter size={18} />
              <span className="text-ios-subhead font-medium">Filtros</span>
            </div>
            <select value={stockFilterType} onChange={(e) => setStockFilterType(e.target.value)} className="ios-input w-auto py-2">
              <option value="all">Todos os Tipos</option>
              {Object.values(DeviceType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={stockFilterCondition}
              onChange={(e) => setStockFilterCondition(e.target.value)}
              className="ios-input w-auto py-2"
            >
              <option value="all">Todas as Condições</option>
              {Object.values(Condition).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="ios-card p-6">
              <p className="text-ios-footnote text-gray-500 mb-1">Custo do Estoque</p>
              <h3 className="text-ios-title-1 font-bold text-gray-900 dark:text-white">
                R$ {(stockStats.acquisitionCost + inUseStats.acquisitionCost).toLocaleString('pt-BR')}
              </h3>
              <p className="text-ios-footnote text-gray-500 mt-2">
                {stockStats.count + inUseStats.count} aparelhos
                {inUseStats.count > 0 && (
                  <span className="text-gray-400"> ({inUseStats.count} em uso)</span>
                )}
              </p>
            </div>

            <div className="ios-card p-6">
              <p className="text-ios-footnote text-gray-500 mb-1">Valor de Venda (Projetado)</p>
              <h3 className="text-ios-title-1 font-bold text-brand-500">R$ {(stockStats.salesValue + inUseStats.salesValue).toLocaleString('pt-BR')}</h3>
              <p className="text-ios-footnote text-gray-500 mt-2">Se todo o estoque for vendido</p>
            </div>

            <div className="ios-card p-6 bg-linear-to-br from-green-50 to-white dark:from-green-900/20 dark:to-surface-dark-100 border-green-200 dark:border-green-800">
              <p className="text-ios-footnote text-green-600 mb-1">Lucro Projetado</p>
              <h3 className="text-ios-title-1 font-bold text-green-600">R$ {stockStats.projectedProfit.toLocaleString('pt-BR')}</h3>
              <div className="w-full bg-gray-200 dark:bg-surface-dark-300 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{
                    width: `${stockStats.salesValue > 0 ? Math.min(100, (stockStats.projectedProfit / stockStats.salesValue) * 100) : 0}%`
                  }}
                />
              </div>
              <p className="text-ios-footnote text-green-600 mt-2">
                Margem: {stockStats.salesValue > 0 ? ((stockStats.projectedProfit / stockStats.salesValue) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
          </div>

          {payableDebtSummary.openAmount > 0 && (
            <div className="ios-card p-5 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 flex items-center justify-between gap-4">
              <div>
                <p className="text-ios-footnote text-red-600 mb-1">Dívidas Ativas em aberto</p>
                <p className="text-ios-title-2 font-bold text-red-700">R$ {payableDebtSummary.openAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                {payableDebtSummary.overdueAmount > 0 && (
                  <p className="text-ios-caption-1 text-red-500 mt-0.5">
                    R$ {payableDebtSummary.overdueAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vencidas
                  </p>
                )}
              </div>
              <Link to="/payable-debts" className="ios-button-secondary shrink-0 text-red-600 border-red-300 dark:border-red-700">
                Ver dívidas
              </Link>
            </div>
          )}

          <div className="ios-card p-6">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4">Saldos Consolidados</h3>
            <div className="space-y-0 divide-y divide-gray-100 dark:divide-surface-dark-200">
              {[
                { label: 'Saldo Aparelhos', value: stockStats.salesValue + inUseStats.salesValue, color: 'text-brand-500', hint: 'Valor de venda projetado do estoque' },
                { label: 'Saldo Devedores', value: debtSummary.openAmount, color: 'text-amber-600 dark:text-amber-400', hint: 'Total em aberto a receber' },
                { label: 'Saldo Conta Bancária', value: bankBalance, color: bankBalance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600', hint: null },
                { label: 'Saldo Cofre', value: safeBalance, color: safeBalance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600', hint: null },
              ].map(({ label, value, color, hint }) => (
                <div key={label} className="flex items-center justify-between py-3 gap-4">
                  <div>
                    <p className="text-ios-subhead font-medium text-gray-700 dark:text-gray-300">{label}</p>
                    {hint && <p className="text-ios-caption-1 text-gray-400">{hint}</p>}
                  </div>
                  <p className={`text-ios-title-3 font-bold tabular-nums shrink-0 ${color}`}>
                    {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              ))}
              {payableDebtSummary.openAmount > 0 && (
                <div className="flex items-center justify-between py-3 gap-4">
                  <div>
                    <p className="text-ios-subhead font-medium text-gray-700 dark:text-gray-300">Saldo Dívidas Ativas</p>
                    <p className="text-ios-caption-1 text-gray-400">Total em aberto a pagar (deduzido do total)</p>
                  </div>
                  <p className="text-ios-title-3 font-bold tabular-nums shrink-0 text-red-600">
                    − {payableDebtSummary.openAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between pt-4 pb-1 gap-4">
                <p className="text-ios-headline font-bold text-gray-900 dark:text-white">Total Acumulado</p>
                {(() => {
                  const total = stockStats.salesValue + inUseStats.salesValue + debtSummary.openAmount + bankBalance + safeBalance - payableDebtSummary.openAmount;
                  return (
                    <p className={`text-ios-title-2 font-bold tabular-nums shrink-0 ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="ios-card p-6 min-w-0">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-6">Comparativo Financeiro</h3>
            <div className="h-64 w-full">
              <StableResponsiveContainer>
                <BarChart
                  data={[
                    { name: 'Custo', value: stockStats.acquisitionCost },
                    { name: 'Venda', value: stockStats.salesValue },
                    { name: 'Lucro', value: stockStats.projectedProfit }
                  ]}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb'
                    }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={40} isAnimationActive={!reducedMotion} />
                </BarChart>
              </StableResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'bank' || activeTab === 'safe' || activeTab === 'debtors') && (
        <div className="space-y-6">
          {activeTab === 'debtors' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="ios-card p-5">
                  <p className="text-ios-footnote text-gray-500 mb-1">Em Aberto</p>
                  <p className="text-ios-title-2 font-bold text-gray-900 dark:text-white">R$ {debtSummary.openAmount.toLocaleString('pt-BR')}</p>
                </div>
                <div className="ios-card p-5">
                  <p className="text-ios-footnote text-gray-500 mb-1">Vencidas</p>
                  <p className="text-ios-title-2 font-bold text-red-600">R$ {debtSummary.overdueAmount.toLocaleString('pt-BR')}</p>
                </div>
                <div className="ios-card p-5">
                  <p className="text-ios-footnote text-gray-500 mb-1">Quitadas</p>
                  <p className="text-ios-title-2 font-bold text-green-600">R$ {debtSummary.settledAmount.toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div className="ios-card overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-surface-dark-200 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Devedores</h3>
                    <p className="text-xs text-gray-500">Resumo integrado do módulo de recebíveis.</p>
                  </div>
                  <Link to="/debtors" className="ios-button-secondary">
                    Gerenciar devedores
                  </Link>
                </div>
                {(() => {
                  const debtTotalPages = Math.ceil(debtRows.length / PAGE_SIZE_DEBTS);
                  const debtPaginated = debtRows.slice(debtorsPage * PAGE_SIZE_DEBTS, (debtorsPage + 1) * PAGE_SIZE_DEBTS);
                  return isMobile ? (
                    <div>
                      <div className="p-4 space-y-3">
                        {debtPaginated.map((debt) => (
                          <div key={debt.id} className={`ios-card p-4 space-y-2 ${isDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {customerById.get(debt.customerId) || 'Cliente removido'}
                              </p>
                              <p className="font-semibold text-brand-500">R$ {debt.remainingAmount.toLocaleString('pt-BR')}</p>
                            </div>
                            <span
                              className={`ios-badge ${
                                debt.status === 'Quitada' ? 'ios-badge-green' : debt.status === 'Parcial' ? 'ios-badge-blue' : 'ios-badge-orange'
                              }`}
                            >
                              {debt.status}
                            </span>
                            <div className="text-sm text-gray-700 dark:text-surface-dark-700 space-y-1">
                              <p>Parcelas: {debt.installmentsTotal || 1}x</p>
                              <p>
                                1º Vencimento:{' '}
                                {debt.firstDueDate || debt.dueDate
                                  ? new Date(`${(debt.firstDueDate || debt.dueDate) as string}T00:00:00`).toLocaleDateString('pt-BR')
                                  : '-'}
                              </p>
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => void handleDeleteDebt(debt.id)}
                                className="ios-button-destructive inline-flex items-center gap-2 text-xs px-3 py-2"
                                aria-label={`Excluir dívida de ${customerById.get(debt.customerId) || 'Cliente removido'}`}
                              >
                                <Trash2 size={14} />
                                Excluir
                              </button>
                            </div>
                          </div>
                        ))}
                        {debtRows.length === 0 && (
                          <div className="p-6 text-center text-gray-500">
                            Nenhum devedor cadastrado.
                          </div>
                        )}
                      </div>
                      <Pagination page={debtorsPage} totalPages={debtTotalPages} totalItems={debtRows.length} pageSize={PAGE_SIZE_DEBTS} onPageChange={setDebtorsPage} />
                    </div>
                  ) : (
                    <div>
                      <table className="w-full table-fixed text-left">
                        <colgroup>
                          <col className="w-[26%]" />
                          <col className="w-[14%]" />
                          <col className="w-[18%]" />
                          <col className="w-[16%]" />
                          <col className="w-[18%]" />
                          <col className="w-[8%]" />
                        </colgroup>
                        <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Cliente</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold text-right">Saldo</th>
                            <th className="px-4 py-3 font-semibold text-center">Parcelas</th>
                            <th className="px-4 py-3 font-semibold">1º Vencimento</th>
                            <th className="px-4 py-3 font-semibold text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
                          {debtPaginated.map((debt) => (
                            <tr key={debt.id} className={isDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}>
                              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{customerById.get(debt.customerId) || 'Cliente removido'}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`ios-badge ${
                                    debt.status === 'Quitada' ? 'ios-badge-green' : debt.status === 'Parcial' ? 'ios-badge-blue' : 'ios-badge-orange'
                                  }`}
                                >
                                  {debt.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-brand-500">R$ {debt.remainingAmount.toLocaleString('pt-BR')}</td>
                              <td className="px-4 py-3 text-center text-gray-700 dark:text-surface-dark-700">{debt.installmentsTotal || 1}x</td>
                              <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-700">
                                {debt.firstDueDate || debt.dueDate
                                  ? new Date(`${(debt.firstDueDate || debt.dueDate) as string}T00:00:00`).toLocaleDateString('pt-BR')
                                  : '-'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteDebt(debt.id)}
                                  className="ios-button-destructive inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5"
                                  aria-label={`Excluir dívida de ${customerById.get(debt.customerId) || 'Cliente removido'}`}
                                >
                                  <Trash2 size={12} />
                                  Excluir
                                </button>
                              </td>
                            </tr>
                          ))}
                          {debtRows.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                Nenhum devedor cadastrado.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      <Pagination page={debtorsPage} totalPages={debtTotalPages} totalItems={debtRows.length} pageSize={PAGE_SIZE_DEBTS} onPageChange={setDebtorsPage} />
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div
                className={`ios-card p-8 ${
                  activeTab === 'bank'
                    ? 'border-brand-200 dark:border-brand-800'
                    : activeTab === 'safe'
                      ? 'border-accent-200 dark:border-accent-800'
                      : 'border-orange-200 dark:border-orange-900/40'
                }`}
              >
                <p className="text-ios-footnote text-gray-500 mb-2">Saldo Disponível</p>
                <h3 className="text-ios-large font-bold text-gray-900 dark:text-white mb-8">R$ {activeBalance.toLocaleString('pt-BR')}</h3>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      openTransactionModal('IN', activeAccount);
                    }}
                    data-testid="finance-action-aporte"
                    className="ios-button bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2"
                  >
                    <ArrowUpCircle size={18} /> Aporte
                  </button>
                  <button
                    onClick={() => {
                      openTransactionModal('OUT', activeAccount);
                    }}
                    className="ios-button bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2"
                  >
                    <ArrowDownCircle size={18} /> Pagar
                  </button>
                  {(activeTab === 'bank' || activeTab === 'safe') && (
                    <button
                      onClick={() => {
                        setTransferData({
                          from: activeTab === 'bank' ? ACCOUNT_BANK : ACCOUNT_SAFE,
                          to: activeTab === 'bank' ? ACCOUNT_SAFE : ACCOUNT_BANK,
                          amount: ''
                        });
                        openTransferModal();
                      }}
                      className="col-span-2 ios-button-secondary flex items-center justify-center gap-2"
                    >
                      <ArrowRightLeft size={18} /> Transferir
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 ios-card flex flex-col">
              <div className="p-6 border-b border-gray-200 dark:border-surface-dark-200 flex justify-between items-center">
                <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Extrato de Movimentações - {accountLabelByTab[activeTab as 'bank' | 'safe' | 'debtors']}</h3>
                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-ios-lg hover:bg-gray-100 dark:hover:bg-surface-dark-200">
                  <Download size={20} />
                </button>
              </div>
              {renderTransactionTable(activeAccount, trxPage, setTrxPage)}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payable_debts' && (
        <div className="space-y-5" data-testid="finance-tab-payable_debts">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="ios-card p-5">
              <p className="text-ios-footnote text-gray-500 mb-1">Total a Pagar</p>
              <p className="text-ios-title-2 font-bold text-red-600">R$ {payableDebtSummary.openAmount.toLocaleString('pt-BR')}</p>
            </div>
            <div className="ios-card p-5">
              <p className="text-ios-footnote text-gray-500 mb-1">Vencidas</p>
              <p className="text-ios-title-2 font-bold text-red-700">R$ {payableDebtSummary.overdueAmount.toLocaleString('pt-BR')}</p>
            </div>
            <div className="ios-card p-5">
              <p className="text-ios-footnote text-gray-500 mb-1">Quitadas (Histórico)</p>
              <p className="text-ios-title-2 font-bold text-green-600">R$ {payableDebtSummary.settledAmount.toLocaleString('pt-BR')}</p>
            </div>
          </div>

          <div className="ios-card p-4 space-y-3">
            <div className="relative">
              <input
                type="text"
                className="ios-input pl-4"
                placeholder="Buscar por credor ou observação..."
                value={pdSearchTerm}
                onChange={(e) => setPdSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <select className="ios-input w-auto" value={pdStatusFilter} onChange={(e) => setPdStatusFilter(e.target.value as PayableDebtStatus | 'all')}>
                <option value="all">Todos os status</option>
                <option value="Aberta">Aberta</option>
                <option value="Parcial">Parcial</option>
                <option value="Quitada">Quitada</option>
              </select>
              <label className="flex items-center gap-2 text-ios-subhead text-gray-700 dark:text-surface-dark-700">
                <input type="checkbox" checked={pdOnlyOverdue} onChange={(e) => setPdOnlyOverdue(e.target.checked)} />
                Apenas vencidas
              </label>
            </div>
          </div>

          <div className="ios-card overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-surface-dark-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Dívidas Ativas</h3>
                <p className="text-xs text-gray-500">Somente leitura. Gerencie na tela dedicada.</p>
              </div>
              <Link to="/payable-debts" className="ios-button-secondary">
                Ir para Dívidas Ativas
              </Link>
            </div>
            {(() => {
              const pdTotalPages = Math.ceil(payableDebtRows.length / PAGE_SIZE_PD);
              const pdPaginated = payableDebtRows.slice(pdPage * PAGE_SIZE_PD, (pdPage + 1) * PAGE_SIZE_PD);
              return isMobile ? (
                <div>
                  <div className="p-4 space-y-3">
                    {pdPaginated.map((debt) => (
                      <div key={debt.id} className={`ios-card p-4 space-y-2 ${isPayableDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {creditorById.get(debt.creditorId) || debt.creditorName}
                          </p>
                          <p className="font-semibold text-red-600">R$ {debt.remainingAmount.toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`ios-badge ${debt.status === 'Quitada' ? 'ios-badge-green' : debt.status === 'Parcial' ? 'ios-badge-blue' : 'ios-badge-orange'}`}>{debt.status}</span>
                          <span className={`ios-badge ${getPayableDebtDeadlineBadge(debt) === 'Atrasado' ? 'ios-badge-red' : getPayableDebtDeadlineBadge(debt) === 'Em dias' ? 'ios-badge-green' : 'ios-badge-blue'}`}>
                            {getPayableDebtDeadlineBadge(debt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">1º Venc.: {debt.firstDueDate || debt.dueDate ? new Date(`${(debt.firstDueDate || debt.dueDate) as string}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</p>
                      </div>
                    ))}
                    {payableDebtRows.length === 0 && (
                      <div className="p-6 text-center text-gray-500">Nenhuma dívida ativa cadastrada.</div>
                    )}
                  </div>
                  <Pagination page={pdPage} totalPages={pdTotalPages} totalItems={payableDebtRows.length} pageSize={PAGE_SIZE_PD} onPageChange={setPdPage} />
                </div>
              ) : (
                <div>
                  <table className="w-full table-fixed text-left">
                    <colgroup>
                      <col className="w-[30%]" />
                      <col className="w-[13%]" />
                      <col className="w-[13%]" />
                      <col className="w-[18%]" />
                      <col className="w-[13%]" />
                      <col className="w-[13%]" />
                    </colgroup>
                    <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Credor</th>
                        <th className="px-4 py-3 font-semibold">Situação</th>
                        <th className="px-4 py-3 font-semibold">Prazo</th>
                        <th className="px-4 py-3 text-right font-semibold">Valor Orig.</th>
                        <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                        <th className="px-4 py-3 font-semibold">1º Venc.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
                      {pdPaginated.map((debt) => (
                        <tr key={debt.id} className={isPayableDebtOverdue(debt) ? 'bg-red-50/40 dark:bg-red-900/10' : ''}>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{creditorById.get(debt.creditorId) || debt.creditorName}</td>
                          <td className="px-4 py-3">
                            <span className={`ios-badge ${debt.status === 'Quitada' ? 'ios-badge-green' : debt.status === 'Parcial' ? 'ios-badge-blue' : 'ios-badge-orange'}`}>{debt.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`ios-badge ${getPayableDebtDeadlineBadge(debt) === 'Atrasado' ? 'ios-badge-red' : getPayableDebtDeadlineBadge(debt) === 'Em dias' ? 'ios-badge-green' : 'ios-badge-blue'}`}>
                              {getPayableDebtDeadlineBadge(debt)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-surface-dark-700">R$ {debt.originalAmount.toLocaleString('pt-BR')}</td>
                          <td className="px-4 py-3 text-right font-semibold text-red-600">R$ {debt.remainingAmount.toLocaleString('pt-BR')}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-surface-dark-700">
                            {debt.firstDueDate || debt.dueDate ? new Date(`${(getPayableDebtDueDate(debt)) as string}T00:00:00`).toLocaleDateString('pt-BR') : '-'}
                          </td>
                        </tr>
                      ))}
                      {payableDebtRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhuma dívida ativa cadastrada.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <Pagination page={pdPage} totalPages={pdTotalPages} totalItems={payableDebtRows.length} pageSize={PAGE_SIZE_PD} onPageChange={setPdPage} />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {activeTab === 'faturamento' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="ios-card p-6">
              <p className="text-ios-footnote text-gray-500 mb-1">Vendas Realizadas</p>
              <h3 className="text-ios-title-1 font-bold text-gray-900 dark:text-white">{salesReport.length}</h3>
            </div>
            <div className="ios-card p-6">
              <p className="text-ios-footnote text-gray-500 mb-1">Faturamento Total</p>
              <h3 className="text-ios-title-1 font-bold text-brand-500">R$ {salesReport.reduce((acc, s) => acc + s.total, 0).toLocaleString('pt-BR')}</h3>
            </div>
            <div className="ios-card p-6">
              <p className="text-ios-footnote text-gray-500 mb-1">Lucro Líquido</p>
              <h3 className="text-ios-title-1 font-bold text-green-600">R$ {salesReport.reduce((acc, s) => acc + toFiniteNumber(s.profit), 0).toLocaleString('pt-BR')}</h3>
            </div>
            <div className="ios-card p-6">
              <p className="text-ios-footnote text-gray-500 mb-1">Acréscimo Cartão</p>
              <h3 className="text-ios-title-1 font-bold text-orange-600">R$ {salesReport.reduce((acc, s) => acc + toFiniteNumber(s.cardSurcharge), 0).toLocaleString('pt-BR')}</h3>
            </div>
            <div className="ios-card p-6">
              <p className="text-ios-footnote text-gray-500 mb-1">Total Cobrado Cliente</p>
              <h3 className="text-ios-title-1 font-bold text-indigo-600">R$ {salesReport.reduce((acc, s) => acc + toFiniteNumber(s.customerChargedTotal), 0).toLocaleString('pt-BR')}</h3>
            </div>
          </div>

          <div className="ios-card overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-surface-dark-200">
              <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Relatório de Vendas</h3>
            </div>
            {(() => {
              const salesTotalPages = Math.ceil(salesReport.length / PAGE_SIZE_SALES);
              const salesPaginated = salesReport.slice(salesPage * PAGE_SIZE_SALES, (salesPage + 1) * PAGE_SIZE_SALES);
              return isMobile ? (
                <div>
                  <div className="p-4 md:p-6 space-y-3">
                    {salesPaginated.map((sale) => (
                      <div key={sale.id} className="ios-card p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-surface-dark-500">
                              {new Date(sale.date).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-brand-500 text-ios-footnote font-mono mt-1">#{sale.id.slice(-4).toUpperCase()}</p>
                          </div>
                          <p className="text-green-600 font-bold">R$ {sale.profit.toLocaleString('pt-BR')}</p>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {sale.items.length > 0 ? sale.items.map((i) => i.model).join(', ') : 'Sem itens'}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-surface-dark-700">
                          <p>Custo: R$ {sale.costOfGoods.toLocaleString('pt-BR')}</p>
                          <p>Venda: R$ {sale.total.toLocaleString('pt-BR')}</p>
                          <p>Acréscimo: R$ {toFiniteNumber(sale.cardSurcharge).toLocaleString('pt-BR')}</p>
                          <p>Cobrado: R$ {toFiniteNumber(sale.customerChargedTotal).toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Pagination page={salesPage} totalPages={salesTotalPages} totalItems={salesReport.length} pageSize={PAGE_SIZE_SALES} onPageChange={setSalesPage} />
                </div>
              ) : (
                <div>
                  <table className="w-full table-fixed text-left">
                    <colgroup>
                      <col className="w-[10%]" />
                      <col className="w-[9%]" />
                      <col className="w-[24%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead>
                      <tr className="text-ios-footnote text-gray-500 border-b border-gray-200 dark:border-surface-dark-200 bg-gray-50 dark:bg-surface-dark-200">
                        <th className="p-3 font-medium">Data</th>
                        <th className="p-3 font-medium">Venda</th>
                        <th className="p-3 font-medium">Aparelhos</th>
                        <th className="p-3 font-medium text-right">Custo</th>
                        <th className="p-3 font-medium text-right">Venda</th>
                        <th className="p-3 font-medium text-right">Cobrado</th>
                        <th className="p-3 font-medium text-right">Lucro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-200">
                      {salesPaginated.map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors">
                          <td className="p-3 text-xs text-gray-600">{new Date(sale.date).toLocaleDateString('pt-BR')}</td>
                          <td className="p-3 text-brand-500 text-xs font-mono">#{sale.id.slice(-4).toUpperCase()}</td>
                          <td className="p-3 text-gray-900 dark:text-white text-xs wrap-break-word">
                            {sale.items.length > 0 ? sale.items.map((i) => i.model).join(', ') : 'Sem itens'}
                          </td>
                          <td className="p-3 text-right text-gray-500 text-xs">R$ {sale.costOfGoods.toLocaleString('pt-BR')}</td>
                          <td className="p-3 text-right text-gray-900 dark:text-white text-xs font-medium">R$ {sale.total.toLocaleString('pt-BR')}</td>
                          <td className="p-3 text-right text-indigo-600 text-xs font-medium">R$ {toFiniteNumber(sale.customerChargedTotal).toLocaleString('pt-BR')}</td>
                          <td className="p-3 text-right font-bold text-green-600 text-xs">R$ {sale.profit.toLocaleString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination page={salesPage} totalPages={salesTotalPages} totalItems={salesReport.length} pageSize={PAGE_SIZE_SALES} onPageChange={setSalesPage} />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <Modal
        open={isTransModalOpen}
        onClose={closeTransactionModal}
        title={transactionModalTitle}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={closeTransactionModal} disabled={isSavingTransaction}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                console.log('[Finance] confirm button clicked');
                handleSaveTransaction().catch((err) => {
                  console.error('[Finance] unhandled error from handleSaveTransaction:', err);
                  toast.error(err?.message || 'Erro inesperado ao salvar.');
                  setIsSavingTransaction(false);
                });
              }}
              disabled={isSavingTransaction}
              className={`ios-button text-white ${isIncomingTransaction ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {isSavingTransaction ? 'Salvando...' : transactionModalConfirmLabel}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="ios-label">Tipo</label>
              <select
                className="ios-input"
                value={transFormData.type}
                onChange={(e) => {
                  const newType = e.target.value as 'IN' | 'OUT';
                  const defaultCat = financialCategories.find(c => c.type === newType && c.isDefault) || financialCategories.find(c => c.type === newType);
                  setTransFormData((prev) => ({
                    ...prev,
                    type: newType,
                    category: defaultCat ? defaultCat.name : ''
                  }));
                }}
              >
                <option value="IN">Entrada (+)</option>
                <option value="OUT">Saída (-)</option>
              </select>
            </div>
            <div>
              <label className="ios-label">Categoria</label>
              <select
                className="ios-input"
                value={transFormData.category}
                onChange={(e) => setTransFormData((prev) => ({ ...prev, category: e.target.value }))}
              >
                {financialCategories.filter(c => c.type === transFormData.type).map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="ios-label">Conta</label>
            <select
              className="ios-input"
              value={transFormData.account}
              onChange={(e) => setTransFormData((prev) => ({ ...prev, account: e.target.value as FinancialAccount }))}
            >
              {FINANCIAL_ACCOUNTS.map((account) => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ios-label">Valor (R$)</label>
            <input
              type="number"
              className="ios-input"
              value={transFormData.amount}
              onChange={(e) => setTransFormData((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="0,00"
            />
          </div>

          <div>
            <label className="ios-label">Descrição</label>
            <input
              type="text"
              className="ios-input"
              value={transFormData.description}
              onChange={(e) => setTransFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder={transactionDescriptionPlaceholder}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        title="Detalhes do lançamento"
        size="sm"
        footer={
          selectedTransaction ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="ios-button-secondary" onClick={() => setSelectedTransaction(null)}>
                Fechar
              </button>
              <button
                type="button"
                className="ios-button-secondary inline-flex items-center gap-2"
                onClick={() => openEditTransactionModal(selectedTransaction)}
              >
                <Pencil size={16} />
                Editar
              </button>
              <button
                type="button"
                className="ios-button-destructive inline-flex items-center gap-2"
                onClick={() => void handleCancelTransaction(selectedTransaction)}
              >
                <Trash2 size={16} />
                Cancelar lançamento
              </button>
            </div>
          ) : undefined
        }
      >
        {selectedTransaction && (
          <div className="space-y-3">
            <div className="ios-card p-4 space-y-2">
              <div className="flex justify-between gap-3">
                <p className="text-xs text-gray-500">Data</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {new Date(selectedTransaction.date).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex justify-between gap-3">
                <p className="text-xs text-gray-500">Conta</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedTransaction.account}</p>
              </div>
              <div className="flex justify-between gap-3">
                <p className="text-xs text-gray-500">Tipo</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {selectedTransaction.type === 'IN' ? 'Entrada' : 'Saída'}
                </p>
              </div>
              <div className="flex justify-between gap-3">
                <p className="text-xs text-gray-500">Categoria</p>
                <span className={`ios-badge ${selectedTransaction.type === 'IN' ? 'ios-badge-green' : 'ios-badge-orange'}`}>
                  {selectedTransaction.category}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <p className="text-xs text-gray-500">Valor</p>
                <p className={`text-base font-bold ${selectedTransaction.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedTransaction.type === 'IN' ? '+' : '-'} R$ {toFiniteNumber(selectedTransaction.amount).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Descrição</p>
              <p className="ios-card p-3 text-sm text-gray-900 dark:text-white">{selectedTransaction.description}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmação agora é via Promise no toast.confirm */}

      <Modal
        open={isTransferModalOpen}
        onClose={() => {
          if (!isTransferring) closeTransferModal();
        }}
        title="Transferência"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => closeTransferModal()} disabled={isTransferring}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={() => void handleTransfer()} disabled={isTransferring}>
              {isTransferring ? 'Transferindo...' : 'Confirmar Transferência'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="ios-label">De</label>
              <select
                className="ios-input"
                value={transferData.from}
                onChange={(e) => setTransferData((prev) => ({ ...prev, from: e.target.value as FinancialAccount }))}
              >
                {CASH_EQUIVALENT_ACCOUNTS.map((account) => (
                  <option key={account} value={account}>
                    {account}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ios-label">Para</label>
              <select
                className="ios-input"
                value={transferData.to}
                onChange={(e) => setTransferData((prev) => ({ ...prev, to: e.target.value as FinancialAccount }))}
              >
                {CASH_EQUIVALENT_ACCOUNTS.map((account) => (
                  <option key={account} value={account}>
                    {account}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="ios-label">Valor</label>
            <input
              type="number"
              className="ios-input text-center text-lg"
              value={transferData.amount}
              onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
              placeholder="R$ 0,00"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Finance;
