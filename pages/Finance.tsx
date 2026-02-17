import React, { useState, useMemo } from 'react';
import { useData } from '../services/dataContext';
import { StockStatus, DeviceType, Transaction, Condition } from '../types';
import { DollarSign, TrendingUp, Wallet, ArrowRightLeft, ArrowUpCircle, ArrowDownCircle, Filter, Search, Calendar, PieChart, Download, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';
import { useToast } from '../components/ui/ToastProvider';
import Modal from '../components/ui/Modal';
import { newId } from '../utils/id';
import StableResponsiveContainer from '../components/charts/StableResponsiveContainer';

type TabType = 'dashboard' | 'caixa' | 'cofre' | 'faturamento';

const toFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const Finance: React.FC = () => {
  const { stock, transactions, sales, addTransaction } = useData();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [stockFilterType, setStockFilterType] = useState<string>('all');
  const [stockFilterCondition, setStockFilterCondition] = useState<string>('all');
  const [isTransModalOpen, setIsTransModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transFormData, setTransFormData] = useState({
    type: 'IN' as 'IN' | 'OUT',
    category: 'Aporte',
    amount: '',
    description: '',
    account: 'Caixa' as 'Caixa' | 'Cofre'
  });
  const [transferData, setTransferData] = useState({
    from: 'Caixa' as 'Caixa' | 'Cofre',
    to: 'Cofre' as 'Caixa' | 'Cofre',
    amount: ''
  });
  const toast = useToast();

  const stockStats = useMemo(() => {
    let filtered = stock.filter(s => s.status === StockStatus.AVAILABLE || s.status === StockStatus.PREPARATION);
    
    if (stockFilterType !== 'all') {
      filtered = filtered.filter(s => s.type === stockFilterType);
    }
    if (stockFilterCondition !== 'all') {
      filtered = filtered.filter(s => s.condition === stockFilterCondition);
    }

    const acquisitionCost = filtered.reduce((acc, item) => {
      const repairCosts = (Array.isArray(item.costs) ? item.costs : []).reduce((cAcc, c) => cAcc + toFiniteNumber(c.amount), 0);
      return acc + toFiniteNumber(item.purchasePrice) + repairCosts;
    }, 0);

    const salesValue = filtered.reduce((acc, item) => acc + toFiniteNumber(item.sellPrice), 0);
    const projectedProfit = salesValue - acquisitionCost;

    return { count: filtered.length, acquisitionCost, salesValue, projectedProfit };
  }, [stock, stockFilterType, stockFilterCondition]);

  const getBalance = (account: 'Caixa' | 'Cofre') => {
    return transactions
      .filter(t => t.account === account)
      .reduce((acc, t) => t.type === 'IN' ? acc + toFiniteNumber(t.amount) : acc - toFiniteNumber(t.amount), 0);
  };

  const caixaBalance = getBalance('Caixa');
  const cofreBalance = getBalance('Cofre');

  const salesReport = useMemo(() => {
    return sales.map(sale => {
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
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
      category: transFormData.category as any,
      amount,
      description: transFormData.description,
      date: new Date().toISOString(),
      account: transFormData.account
    };

    addTransaction(newTrans);
    setIsTransModalOpen(false);
    setTransFormData({ type: 'IN', category: 'Aporte', amount: '', description: '', account: activeTab === 'cofre' ? 'Cofre' : 'Caixa' });
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

    addTransaction({
      id: newId('trx-tr-out'),
      type: 'OUT',
      category: 'Serviço',
      amount: amount,
      description: `Transferência para ${transferData.to}`,
      date: new Date().toISOString(),
      account: transferData.from
    });

    addTransaction({
      id: newId('trx-tr-in'),
      type: 'IN',
      category: 'Aporte',
      amount: amount,
      description: `Transferência de ${transferData.from}`,
      date: new Date().toISOString(),
      account: transferData.to
    });

    setIsTransferModalOpen(false);
    setTransferData({ from: 'Caixa', to: 'Cofre', amount: '' });
    toast.success('Transferencia realizada.');
  };

  const renderTransactionTable = (accountFilter: 'Caixa' | 'Cofre') => {
    const filtered = transactions
      .filter(t => t.account === accountFilter)
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
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors">
                <td className="p-4 text-ios-subhead text-gray-600 dark:text-surface-dark-600">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                <td className="p-4 text-gray-900 dark:text-white font-medium">{t.description}</td>
                <td className="p-4">
                  <span className={`ios-badge ${t.type === 'IN' ? 'ios-badge-green' : 'ios-badge-orange'}`}>
                    {t.category}
                  </span>
                </td>
                <td className={`p-4 text-right font-bold ${t.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === 'IN' ? '+' : '-'} R$ {toFiniteNumber(t.amount).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">Nenhuma movimentação registrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Financeiro</h2>
        <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Caixa, investimentos e resultados</p>
      </div>

      {/* HIG: Segmented Control for tab navigation */}
      <div className="ios-segmented-control overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'caixa', label: 'Caixa' },
          { id: 'cofre', label: 'Cofre' },
          { id: 'faturamento', label: 'Faturamento' },
        ].map(tab => (
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
            <select 
              value={stockFilterType}
              onChange={(e) => setStockFilterType(e.target.value)}
              className="ios-input w-auto py-2"
            >
              <option value="all">Todos os Tipos</option>
              {Object.values(DeviceType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select 
              value={stockFilterCondition}
              onChange={(e) => setStockFilterCondition(e.target.value)}
              className="ios-input w-auto py-2"
            >
              <option value="all">Todas as Condições</option>
              {Object.values(Condition).map(c => <option key={c} value={c}>{c}</option>)}
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
                <div className="h-full bg-green-500" style={{ width: `${stockStats.salesValue > 0 ? Math.min(100, (stockStats.projectedProfit / stockStats.salesValue) * 100) : 0}%` }} />
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
                <BarChart data={[
                  { name: 'Custo', value: stockStats.acquisitionCost },
                  { name: 'Venda', value: stockStats.salesValue },
                  { name: 'Lucro', value: stockStats.projectedProfit },
                ]} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" width={80} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: '1px solid #e5e7eb' }}
                    cursor={{fill: 'transparent'}}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={40} />
                </BarChart>
              </StableResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'caixa' || activeTab === 'cofre') && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div className={`ios-card p-8 ${activeTab === 'caixa' ? 'border-brand-200 dark:border-brand-800' : 'border-accent-200 dark:border-accent-800'}`}>
                <p className="text-ios-footnote text-gray-500 mb-2">Saldo Disponível</p>
                <h3 className="text-ios-large font-bold text-gray-900 dark:text-white mb-8">
                  R$ {(activeTab === 'caixa' ? caixaBalance : cofreBalance).toLocaleString('pt-BR')}
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => {
                      setTransFormData(prev => ({ ...prev, account: activeTab === 'caixa' ? 'Caixa' : 'Cofre', type: 'IN', category: 'Aporte' }));
                      setIsTransModalOpen(true);
                    }}
                    className="ios-button bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2"
                  >
                    <ArrowUpCircle size={18} /> Aporte
                  </button>
                  <button 
                    onClick={() => {
                      setTransFormData(prev => ({ ...prev, account: activeTab === 'caixa' ? 'Caixa' : 'Cofre', type: 'OUT', category: 'Retirada' }));
                      setIsTransModalOpen(true);
                    }}
                    className="ios-button bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2"
                  >
                    <ArrowDownCircle size={18} /> Retirada
                  </button>
                  <button 
                    onClick={() => {
                      setTransferData({ 
                        from: activeTab === 'caixa' ? 'Caixa' : 'Cofre', 
                        to: activeTab === 'caixa' ? 'Cofre' : 'Caixa', 
                        amount: '' 
                      });
                      setIsTransferModalOpen(true);
                    }}
                    className="col-span-2 ios-button-secondary flex items-center justify-center gap-2"
                  >
                    <ArrowRightLeft size={18} /> Transferir
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 ios-card flex flex-col">
              <div className="p-6 border-b border-gray-200 dark:border-surface-dark-200 flex justify-between items-center">
                <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Extrato de Movimentações</h3>
                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-ios-lg hover:bg-gray-100 dark:hover:bg-surface-dark-200">
                  <Download size={20} />
                </button>
              </div>
              {renderTransactionTable(activeTab === 'caixa' ? 'Caixa' : 'Cofre')}
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
                  {salesReport.map(sale => (
                    <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-surface-dark-200 transition-colors">
                      <td className="p-4 text-ios-subhead text-gray-600">{new Date(sale.date).toLocaleDateString('pt-BR')}</td>
                      <td className="p-4 text-brand-500 text-ios-footnote font-mono">#{sale.id.slice(-4).toUpperCase()}</td>
                      <td className="p-4 text-gray-900 dark:text-white text-ios-subhead">
                        {sale.items.length > 0 ? sale.items.map(i => i.model).join(', ') : 'Sem itens'}
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
                onClick={() => setTransFormData({ ...transFormData, type: 'IN' })}
                className={`flex-1 py-2 rounded-ios text-ios-subhead font-bold transition-colors ${
                  transFormData.type === 'IN' ? 'bg-green-500 text-white' : 'text-gray-500'
                }`}
              >
                Entrada (+)
              </button>
              <button
                type="button"
                onClick={() => setTransFormData({ ...transFormData, type: 'OUT' })}
                className={`flex-1 py-2 rounded-ios text-ios-subhead font-bold transition-colors ${
                  transFormData.type === 'OUT' ? 'bg-red-500 text-white' : 'text-gray-500'
                }`}
              >
                Saída (-)
              </button>
            </div>
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
          <div className="flex items-center justify-between ios-card p-4">
            <div className="text-center">
              <p className="text-ios-footnote text-gray-500 mb-1">De</p>
              <p className="font-bold text-gray-900 dark:text-white">{transferData.from}</p>
            </div>
            <ArrowRightLeft size={20} className="text-brand-500" />
            <div className="text-center">
              <p className="text-ios-footnote text-gray-500 mb-1">Para</p>
              <p className="font-bold text-gray-900 dark:text-white">{transferData.to}</p>
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

const LockIcon = ({ size, className }: { size?: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);

export default Finance;
