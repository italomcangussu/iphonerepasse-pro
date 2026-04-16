import React, { useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useData } from '../services/dataContext';
import { StockStatus, DeviceType, Transaction, Condition, FinancialAccount } from '../types';
import { ArrowDownCircle, ArrowRightLeft, ArrowUpCircle, Download, Filter, Pencil, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useToast } from '../components/ui/ToastProvider';
import Modal from '../components/ui/Modal';
import { newId } from '../utils/id';
import StableResponsiveContainer from '../components/charts/StableResponsiveContainer';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  ACCOUNT_BANK,
  ACCOUNT_DEBTORS,
  ACCOUNT_SAFE,
  CASH_EQUIVALENT_ACCOUNTS,
  FINANCIAL_ACCOUNTS
} from '../utils/financialAccounts';
import { isDebtOverdue } from '../utils/debts';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';

type TabType = 'dashboard' | 'bank' | 'safe' | 'debtors' | 'faturamento';

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

const TRANSACTION_CATEGORIES: Transaction['category'][] = ['Venda', 'Compra', 'Insumo', 'Aporte', 'Retirada', 'Serviço'];

const Finance: React.FC = () => {
  const { stock, transactions, sales, addTransaction, updateTransaction, removeTransaction, debts, customers } = useData();
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobileViewport();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [stockFilterType, setStockFilterType] = useState<string>('all');
  const [stockFilterCondition, setStockFilterCondition] = useState<string>('all');
  const [isTransModalOpen, setIsTransModalOpen] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionToCancel, setTransactionToCancel] = useState<Transaction | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
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
    category: 'Aporte',
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

  const salesReport = useMemo(() => {
    return sales
      .map((sale) => {
        const items = Array.isArray(sale.items) ? sale.items : [];
        const costOfGoods = items.reduce((acc, item) => {
          const repairs = (Array.isArray(item.costs) ? item.costs : []).reduce((r, c) => r + toFiniteNumber(c.amount), 0);
          return acc + toFiniteNumber(item.purchasePrice) + repairs;
        }, 0);

        const total = toFiniteNumber(sale.total);
        const revenue = total + toFiniteNumber(sale.tradeInValue);
        const profit = revenue - costOfGoods;
        const cardSurcharge = (sale.paymentMethods || []).reduce((acc, payment) => acc + toFiniteNumber(payment.feeAmount), 0);
        const customerChargedTotal = (sale.paymentMethods || []).reduce(
          (acc, payment) => acc + toFiniteNumber(payment.customerAmount ?? payment.amount),
          0
        );

        return { ...sale, items, total, costOfGoods, profit, cardSurcharge, customerChargedTotal };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales]);

  const closeTransactionModal = () => {
    setIsTransModalOpen(false);
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
    if (!transFormData.amount || !transFormData.description.trim()) {
      toast.error('Preencha valor e descricao.');
      return;
    }

    const amount = Number(transFormData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Informe um valor valido.');
      return;
    }

    const payload: Omit<Transaction, 'id'> = {
      type: transFormData.type,
      category: transFormData.category,
      amount,
      description: transFormData.description.trim(),
      date: transFormData.date || new Date().toISOString(),
      account: transFormData.account
    };

    setIsSavingTransaction(true);
    try {
      if (editingTransactionId) {
        await updateTransaction(editingTransactionId, payload);
        toast.success('Lancamento atualizado.');
      } else {
        await addTransaction({
          id: newId('trx'),
          ...payload
        });
        toast.success('Movimentacao registrada.');
      }
      closeTransactionModal();
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel salvar o lancamento.');
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

    setIsTransferring(true);
    try {
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

      setIsTransferModalOpen(false);
      setTransferData({ from: ACCOUNT_BANK, to: ACCOUNT_SAFE, amount: '' });
      toast.success('Transferencia realizada.');
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel realizar a transferencia.');
    } finally {
      setIsTransferring(false);
    }
  };

  const openTransactionModal = (type: 'IN' | 'OUT', account: FinancialAccount) => {
    setEditingTransactionId(null);
    setTransFormData({
      type,
      category: type === 'IN' ? 'Aporte' : 'Retirada',
      amount: '',
      description: '',
      date: new Date().toISOString(),
      account
    });
    setIsTransModalOpen(true);
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
    setIsTransModalOpen(true);
  };

  const handleCancelTransaction = async () => {
    if (!transactionToCancel) return;
    try {
      await removeTransaction(transactionToCancel.id);
      setSelectedTransaction((prev) => (prev?.id === transactionToCancel.id ? null : prev));
      toast.success('Lancamento cancelado.');
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel cancelar o lancamento.');
    } finally {
      setTransactionToCancel(null);
    }
  };

  const renderTransactionTable = (accountFilter: FinancialAccount) => {
    const filtered = transactions
      .filter((t) => t.account === accountFilter)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (isMobile) {
      if (filtered.length === 0) {
        return <div className="p-6 text-center text-gray-500">Nenhuma movimentação registrada.</div>;
      }

      return (
        <div className="p-4 md:p-6 space-y-3">
          {filtered.map((t) => (
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
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-ios-footnote text-gray-500 border-b border-gray-200 dark:border-surface-dark-200">
              <th className="p-4 font-medium">Data</th>
              <th className="p-4 font-medium">Descrição</th>
              <th className="p-4 font-medium">Categoria</th>
              <th className="p-4 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-200">
            {filtered.map((t) => (
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

      <div className="ios-segmented-control overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'bank', label: ACCOUNT_BANK },
          { id: 'safe', label: ACCOUNT_SAFE },
          { id: 'debtors', label: 'Devedores' },
          { id: 'faturamento', label: 'Faturamento' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`ios-segment whitespace-nowrap ${activeTab === tab.id ? 'ios-segment-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
              <h3 className="text-ios-title-1 font-bold text-gray-900 dark:text-white">R$ {stockStats.acquisitionCost.toLocaleString('pt-BR')}</h3>
              <p className="text-ios-footnote text-gray-500 mt-2">{stockStats.count} aparelhos</p>
            </div>

            <div className="ios-card p-6">
              <p className="text-ios-footnote text-gray-500 mb-1">Valor de Venda (Projetado)</p>
              <h3 className="text-ios-title-1 font-bold text-brand-500">R$ {stockStats.salesValue.toLocaleString('pt-BR')}</h3>
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
                {isMobile ? (
                  <div className="p-4 space-y-3">
                    {debtRows.slice(0, 10).map((debt) => (
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
                      </div>
                    ))}
                    {debtRows.length === 0 && (
                      <div className="p-6 text-center text-gray-500">
                        Nenhum devedor cadastrado.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                      <thead className="bg-gray-50 dark:bg-surface-dark-200 text-xs uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Cliente</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold text-right">Saldo</th>
                          <th className="px-4 py-3 font-semibold text-center">Parcelas</th>
                          <th className="px-4 py-3 font-semibold">1º Vencimento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-300">
                        {debtRows.slice(0, 10).map((debt) => (
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
                          </tr>
                        ))}
                        {debtRows.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                              Nenhum devedor cadastrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
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
                        setIsTransferModalOpen(true);
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
              {renderTransactionTable(activeAccount)}
            </div>
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
            {isMobile ? (
              <div className="p-4 md:p-6 space-y-3">
                {salesReport.map((sale) => (
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
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-ios-footnote text-gray-500 border-b border-gray-200 dark:border-surface-dark-200 bg-gray-50 dark:bg-surface-dark-200">
                      <th className="p-4 font-medium">Data</th>
                      <th className="p-4 font-medium">Venda</th>
                      <th className="p-4 font-medium">Aparelhos</th>
                      <th className="p-4 font-medium text-right">Custo</th>
                      <th className="p-4 font-medium text-right">Venda</th>
                      <th className="p-4 font-medium text-right">Acréscimo</th>
                      <th className="p-4 font-medium text-right">Cobrado</th>
                      <th className="p-4 font-medium text-right">Lucro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-surface-dark-200">
                    {salesReport.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors">
                        <td className="p-4 text-ios-subhead text-gray-600">{new Date(sale.date).toLocaleDateString('pt-BR')}</td>
                        <td className="p-4 text-brand-500 text-ios-footnote font-mono">#{sale.id.slice(-4).toUpperCase()}</td>
                        <td className="p-4 text-gray-900 dark:text-white text-ios-subhead">
                          {sale.items.length > 0 ? sale.items.map((i) => i.model).join(', ') : 'Sem itens'}
                        </td>
                        <td className="p-4 text-right text-gray-500 text-ios-subhead">R$ {sale.costOfGoods.toLocaleString('pt-BR')}</td>
                        <td className="p-4 text-right text-gray-900 dark:text-white font-medium">R$ {sale.total.toLocaleString('pt-BR')}</td>
                        <td className="p-4 text-right text-orange-600 font-medium">R$ {toFiniteNumber(sale.cardSurcharge).toLocaleString('pt-BR')}</td>
                        <td className="p-4 text-right text-indigo-600 font-medium">R$ {toFiniteNumber(sale.customerChargedTotal).toLocaleString('pt-BR')}</td>
                        <td className="p-4 text-right font-bold text-green-600">R$ {sale.profit.toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
              onClick={() => void handleSaveTransaction()}
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
                onChange={(e) =>
                  setTransFormData((prev) => ({
                    ...prev,
                    type: e.target.value as 'IN' | 'OUT',
                    category:
                      prev.category === 'Aporte' || prev.category === 'Retirada'
                        ? (e.target.value === 'IN' ? 'Aporte' : 'Retirada')
                        : prev.category
                  }))
                }
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
                onChange={(e) => setTransFormData((prev) => ({ ...prev, category: e.target.value as Transaction['category'] }))}
              >
                {TRANSACTION_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
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
                onClick={() => setTransactionToCancel(selectedTransaction)}
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

      <ConfirmDialog
        open={!!transactionToCancel}
        onClose={() => setTransactionToCancel(null)}
        title="Cancelar lançamento"
        description={
          transactionToCancel
            ? `Tem certeza que deseja cancelar o lançamento "${transactionToCancel.description}"?`
            : undefined
        }
        confirmLabel="Cancelar lançamento"
        variant="danger"
        onConfirm={() => {
          void handleCancelTransaction();
        }}
      />

      <Modal
        open={isTransferModalOpen}
        onClose={() => {
          if (!isTransferring) setIsTransferModalOpen(false);
        }}
        title="Transferência"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => setIsTransferModalOpen(false)} disabled={isTransferring}>
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
