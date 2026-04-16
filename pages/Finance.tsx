import React, { useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useData } from '../services/dataContext';
import { StockStatus, DeviceType, Transaction, Condition, FinancialAccount } from '../types';
import { ArrowDownCircle, ArrowRightLeft, ArrowUpCircle, Download, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useToast } from '../components/ui/ToastProvider';
import Modal from '../components/ui/Modal';
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

const Finance: React.FC = () => {
  const { stock, transactions, sales, addTransaction, debts, customers } = useData();
  const reducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [stockFilterType, setStockFilterType] = useState<string>('all');
  const [stockFilterCondition, setStockFilterCondition] = useState<string>('all');
  const [isTransModalOpen, setIsTransModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transFormData, setTransFormData] = useState<{
    type: 'IN' | 'OUT';
    category: Transaction['category'];
    amount: string;
    description: string;
    account: FinancialAccount;
  }>({
    type: 'IN',
    category: 'Aporte',
    amount: '',
    description: '',
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

  const handleAddTransaction = () => {
    if (!transFormData.amount || !transFormData.description) {
      toast.error('Preencha valor e descricao.');
      return;
    }

    const amount = Number(transFormData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Informe um valor valido.');
      return;
    }

    const newTrans: Transaction = {
      id: newId('trx'),
      type: transFormData.type,
      category: transFormData.category,
      amount,
      description: transFormData.description,
      date: new Date().toISOString(),
      account: transFormData.account
    };

    addTransaction(newTrans);
    setIsTransModalOpen(false);
    setTransFormData((prev) => ({
      ...prev,
      type: 'IN',
      category: 'Aporte',
      amount: '',
      description: ''
    }));
    toast.success('Movimentacao registrada.');
  };

  const handleTransfer = () => {
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

    addTransaction({
      id: newId('trx-tr-out'),
      type: 'OUT',
      category: 'Serviço',
      amount,
      description: `Transferência para ${transferData.to}`,
      date: new Date().toISOString(),
      account: transferData.from
    });

    addTransaction({
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
  };

  const renderTransactionTable = (accountFilter: FinancialAccount) => {
    const filtered = transactions
      .filter((t) => t.account === accountFilter)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors">
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
                      setTransFormData((prev) => ({
                        ...prev,
                        account: activeAccount,
                        type: 'IN',
                        category: 'Aporte',
                        amount: '',
                        description: ''
                      }));
                      setIsTransModalOpen(true);
                    }}
                    className="ios-button bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2"
                  >
                    <ArrowUpCircle size={18} /> Aporte
                  </button>
                  <button
                    onClick={() => {
                      setTransFormData((prev) => ({
                        ...prev,
                        account: activeAccount,
                        type: 'OUT',
                        category: 'Retirada',
                        amount: '',
                        description: ''
                      }));
                      setIsTransModalOpen(true);
                    }}
                    className="ios-button bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2"
                  >
                    <ArrowDownCircle size={18} /> Retirada
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
          </div>
        </div>
      )}

      <Modal
        open={isTransModalOpen}
        onClose={() => setIsTransModalOpen(false)}
        title="Nova Movimentação"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => setIsTransModalOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddTransaction}
              className={`ios-button text-white ${transFormData.type === 'IN' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              Confirmar {transFormData.type === 'IN' ? 'Entrada' : 'Saída'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="ios-label">Tipo</label>
            <div className="flex bg-gray-100 dark:bg-surface-dark-200 rounded-ios-lg p-1">
              <button
                type="button"
                onClick={() => setTransFormData({ ...transFormData, type: 'IN', category: 'Aporte' })}
                className={`flex-1 py-2 rounded-ios text-ios-subhead font-bold transition-colors ${
                  transFormData.type === 'IN' ? 'bg-green-500 text-white' : 'text-gray-500'
                }`}
              >
                Entrada (+)
              </button>
              <button
                type="button"
                onClick={() => setTransFormData({ ...transFormData, type: 'OUT', category: 'Retirada' })}
                className={`flex-1 py-2 rounded-ios text-ios-subhead font-bold transition-colors ${
                  transFormData.type === 'OUT' ? 'bg-red-500 text-white' : 'text-gray-500'
                }`}
              >
                Saída (-)
              </button>
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
              onChange={(e) => setTransFormData({ ...transFormData, amount: e.target.value })}
              placeholder="0,00"
            />
          </div>

          <div>
            <label className="ios-label">Descrição</label>
            <input
              type="text"
              className="ios-input"
              value={transFormData.description}
              onChange={(e) => setTransFormData({ ...transFormData, description: e.target.value })}
              placeholder="Ex: Pagamento de conta"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Transferência"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="ios-button-secondary" onClick={() => setIsTransferModalOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="ios-button-primary" onClick={handleTransfer}>
              Confirmar Transferência
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
