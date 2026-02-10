import React, { useState, useMemo } from 'react';
import { useData } from '../services/dataContext';
import { StockStatus, DeviceType, Transaction, Condition } from '../types';
import { 
  DollarSign, TrendingUp, Wallet, ArrowRightLeft, 
  ArrowUpCircle, ArrowDownCircle, Filter, Search, 
  Calendar, PieChart, Download, Plus, X 
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';

type TabType = 'dashboard' | 'caixa' | 'cofre' | 'faturamento';

const Finance: React.FC = () => {
  const { stock, transactions, sales, addTransaction } = useData();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // States for Filters
  const [stockFilterType, setStockFilterType] = useState<string>('all');
  const [stockFilterCondition, setStockFilterCondition] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // States for Modals
  const [isTransModalOpen, setIsTransModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transFormData, setTransFormData] = useState({
    type: 'IN',
    category: 'Aporte',
    amount: '',
    description: '',
    account: 'Caixa' // Default
  });
  const [transferData, setTransferData] = useState({
    from: 'Caixa',
    to: 'Cofre',
    amount: ''
  });

  // --- CALCULATIONS ---

  // 1. Stock Dashboard Calculations
  const stockStats = useMemo(() => {
    let filtered = stock.filter(s => s.status === StockStatus.AVAILABLE || s.status === StockStatus.PREPARATION);
    
    if (stockFilterType !== 'all') {
      filtered = filtered.filter(s => s.type === stockFilterType);
    }
    if (stockFilterCondition !== 'all') {
      filtered = filtered.filter(s => s.condition === stockFilterCondition);
    }

    const acquisitionCost = filtered.reduce((acc, item) => {
      const repairCosts = item.costs.reduce((cAcc, c) => cAcc + c.amount, 0);
      return acc + item.purchasePrice + repairCosts;
    }, 0);

    const salesValue = filtered.reduce((acc, item) => acc + item.sellPrice, 0);
    const projectedProfit = salesValue - acquisitionCost;

    return { count: filtered.length, acquisitionCost, salesValue, projectedProfit };
  }, [stock, stockFilterType, stockFilterCondition]);

  // 2. Accounts Balance
  const getBalance = (account: 'Caixa' | 'Cofre') => {
    return transactions
      .filter(t => t.account === account)
      .reduce((acc, t) => t.type === 'IN' ? acc + t.amount : acc - t.amount, 0);
  };

  const caixaBalance = getBalance('Caixa');
  const cofreBalance = getBalance('Cofre');

  // 3. Sales & Profit Reports
  const salesReport = useMemo(() => {
    return sales.map(sale => {
      // Calculate Total Cost of items sold (Purchase Price + Repairs)
      const costOfGoods = sale.items.reduce((acc, item) => {
        const repairs = item.costs.reduce((r, c) => r + c.amount, 0);
        return acc + item.purchasePrice + repairs;
      }, 0);

      // Adjusted Revenue (Sale Total + TradeIn Asset Value)
      // If there's a trade in, we received Cash + Device. 
      // Profit = (Cash + Device Value) - Cost of Original Device.
      const revenue = sale.total + (sale.tradeInValue || 0);
      
      const profit = revenue - costOfGoods;

      return {
        ...sale,
        costOfGoods,
        profit
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales]);

  // --- ACTIONS ---

  const handleAddTransaction = () => {
    if (!transFormData.amount || !transFormData.description) return;
    
    const newTrans: Transaction = {
      id: `trx-${Date.now()}`,
      type: transFormData.type as 'IN' | 'OUT',
      category: transFormData.category as any,
      amount: parseFloat(transFormData.amount),
      description: transFormData.description,
      date: new Date().toISOString(),
      account: transFormData.account as 'Caixa' | 'Cofre'
    };

    addTransaction(newTrans);
    setIsTransModalOpen(false);
    setTransFormData({ type: 'IN', category: 'Aporte', amount: '', description: '', account: activeTab === 'cofre' ? 'Cofre' : 'Caixa' });
  };

  const handleTransfer = () => {
    if (!transferData.amount) return;
    const amount = parseFloat(transferData.amount);

    // 1. Remove from Source
    addTransaction({
      id: `trx-tr-out-${Date.now()}`,
      type: 'OUT',
      category: 'Serviço', // Internal Transfer
      amount: amount,
      description: `Transferência para ${transferData.to}`,
      date: new Date().toISOString(),
      account: transferData.from as 'Caixa' | 'Cofre'
    });

    // 2. Add to Destination
    addTransaction({
      id: `trx-tr-in-${Date.now()}`,
      type: 'IN',
      category: 'Aporte',
      amount: amount,
      description: `Transferência de ${transferData.from}`,
      date: new Date().toISOString(),
      account: transferData.to as 'Caixa' | 'Cofre'
    });

    setIsTransferModalOpen(false);
    setTransferData({ from: 'Caixa', to: 'Cofre', amount: '' });
  };

  const renderTransactionTable = (accountFilter: 'Caixa' | 'Cofre') => {
    const filtered = transactions
      .filter(t => t.account === accountFilter)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-slate-400 text-sm border-b border-dark-700">
              <th className="p-4 font-medium">Data</th>
              <th className="p-4 font-medium">Descrição</th>
              <th className="p-4 font-medium">Categoria</th>
              <th className="p-4 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-dark-800/50 transition-colors">
                <td className="p-4 text-slate-300 text-sm">{new Date(t.date).toLocaleDateString()}</td>
                <td className="p-4 text-white font-medium">{t.description}</td>
                <td className="p-4 text-slate-400 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${
                    t.type === 'IN' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {t.category}
                  </span>
                </td>
                <td className={`p-4 text-right font-bold ${t.type === 'IN' ? 'text-green-500' : 'text-red-500'}`}>
                  {t.type === 'IN' ? '+' : '-'} R$ {t.amount.toLocaleString()}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">Nenhuma movimentação registrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // --- RENDER COMPONENT ---

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestão Financeira</h2>
          <p className="text-slate-400">Controle de caixa, investimentos e resultados</p>
        </div>
        
        <div className="flex bg-dark-800 p-1 rounded-xl border border-dark-700 overflow-x-auto max-w-full">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: PieChart },
            { id: 'caixa', label: 'Caixa', icon: Wallet },
            { id: 'cofre', label: 'Cofre', icon: LockIcon },
            { id: 'faturamento', label: 'Faturamento', icon: TrendingUp },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- DASHBOARD TAB --- */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 bg-dark-800 p-4 rounded-xl border border-dark-700">
             <div className="flex items-center gap-2 text-slate-400 border-r border-dark-600 pr-4">
               <Filter size={18} />
               <span className="text-sm font-medium">Filtros de Estoque</span>
             </div>
             <select 
               value={stockFilterType}
               onChange={(e) => setStockFilterType(e.target.value)}
               className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-1.5 text-sm text-white focus:border-primary-500 outline-none"
             >
               <option value="all">Todos os Tipos</option>
               {Object.values(DeviceType).map(t => <option key={t} value={t}>{t}</option>)}
             </select>
             <select 
               value={stockFilterCondition}
               onChange={(e) => setStockFilterCondition(e.target.value)}
               className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-1.5 text-sm text-white focus:border-primary-500 outline-none"
             >
               <option value="all">Todas as Condições</option>
               {Object.values(Condition).map(c => <option key={c} value={c}>{c}</option>)}
             </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 relative overflow-hidden group">
              <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <DollarSign size={80} className="text-slate-300" />
              </div>
              <p className="text-slate-400 font-medium mb-1">Custo do Estoque</p>
              <h3 className="text-3xl font-bold text-white mb-2">R$ {stockStats.acquisitionCost.toLocaleString()}</h3>
              <p className="text-xs text-slate-500">Valor investido em {stockStats.count} aparelhos</p>
            </div>

            <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 relative overflow-hidden group">
              <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={80} className="text-primary-500" />
              </div>
              <p className="text-slate-400 font-medium mb-1">Valor de Venda (Projetado)</p>
              <h3 className="text-3xl font-bold text-primary-400 mb-2">R$ {stockStats.salesValue.toLocaleString()}</h3>
              <p className="text-xs text-slate-500">Se todo o estoque for vendido hoje</p>
            </div>

            <div className="bg-gradient-to-br from-green-900/50 to-dark-800 p-6 rounded-2xl border border-green-500/30 relative overflow-hidden">
              <p className="text-green-400 font-medium mb-1">Lucro Projetado</p>
              <h3 className="text-3xl font-bold text-white mb-2">R$ {stockStats.projectedProfit.toLocaleString()}</h3>
              <div className="w-full bg-dark-900/50 h-2 rounded-full mt-2 overflow-hidden">
                 <div 
                   className="h-full bg-green-500" 
                   style={{ width: `${(stockStats.projectedProfit / stockStats.salesValue) * 100}%` }}
                 />
              </div>
              <p className="text-xs text-green-300/70 mt-2">Margem aprox. {((stockStats.projectedProfit / stockStats.salesValue) * 100).toFixed(1)}%</p>
            </div>
          </div>
          
          {/* Simple Chart Placeholder */}
          <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700">
            <h3 className="text-lg font-bold text-white mb-6">Comparativo Financeiro</h3>
            <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={[
                   { name: 'Custo', value: stockStats.acquisitionCost },
                   { name: 'Venda', value: stockStats.salesValue },
                   { name: 'Lucro', value: stockStats.projectedProfit },
                 ]} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" width={80} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} cursor={{fill: 'transparent'}} />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={40} />
                 </BarChart>
               </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* --- CAIXA & COFRE TABS --- */}
      {(activeTab === 'caixa' || activeTab === 'cofre') && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Balance Card */}
            <div className="lg:col-span-1 space-y-4">
              <div className={`p-8 rounded-3xl border ${
                activeTab === 'caixa' 
                  ? 'bg-gradient-to-br from-blue-900/20 to-dark-800 border-blue-500/30' 
                  : 'bg-gradient-to-br from-amber-900/20 to-dark-800 border-amber-500/30'
              }`}>
                <p className="text-slate-400 font-medium mb-2">Saldo Disponível</p>
                <h3 className="text-4xl font-bold text-white mb-8">
                  R$ {(activeTab === 'caixa' ? caixaBalance : cofreBalance).toLocaleString()}
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => {
                      setTransFormData(prev => ({ ...prev, account: activeTab === 'caixa' ? 'Caixa' : 'Cofre', type: 'IN', category: 'Aporte' }));
                      setIsTransModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 py-3 rounded-xl font-medium transition-colors border border-green-600/30"
                  >
                    <ArrowUpCircle size={18} /> Aporte
                  </button>
                  <button 
                     onClick={() => {
                      setTransFormData(prev => ({ ...prev, account: activeTab === 'caixa' ? 'Caixa' : 'Cofre', type: 'OUT', category: 'Retirada' }));
                      setIsTransModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 py-3 rounded-xl font-medium transition-colors border border-red-600/30"
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
                    className="col-span-2 flex items-center justify-center gap-2 bg-dark-700 hover:bg-dark-600 text-white py-3 rounded-xl font-medium transition-colors"
                  >
                    <ArrowRightLeft size={18} /> Transferir para {activeTab === 'caixa' ? 'Cofre' : 'Caixa'}
                  </button>
                </div>
              </div>
              
              <div className="bg-dark-800 p-4 rounded-xl border border-dark-700">
                <h4 className="text-slate-400 text-sm font-bold mb-2 uppercase tracking-wider">Resumo Rápido</h4>
                <div className="space-y-2">
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Entradas (Mês)</span>
                      <span className="text-green-500">+ R$ 0,00</span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Saídas (Mês)</span>
                      <span className="text-red-500">- R$ 0,00</span>
                   </div>
                </div>
              </div>
            </div>

            {/* Transactions List */}
            <div className="lg:col-span-2 bg-dark-800 rounded-2xl border border-dark-700 flex flex-col">
              <div className="p-6 border-b border-dark-700 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Extrato de Movimentações</h3>
                <button className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-dark-700">
                  <Download size={20} />
                </button>
              </div>
              {renderTransactionTable(activeTab === 'caixa' ? 'Caixa' : 'Cofre')}
            </div>
          </div>
        </div>
      )}

      {/* --- FATURAMENTO TAB --- */}
      {activeTab === 'faturamento' && (
        <div className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700">
                 <p className="text-slate-400 text-sm font-medium">Vendas Realizadas</p>
                 <h3 className="text-2xl font-bold text-white mt-1">{salesReport.length}</h3>
              </div>
              <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700">
                 <p className="text-slate-400 text-sm font-medium">Faturamento Total</p>
                 <h3 className="text-2xl font-bold text-primary-400 mt-1">
                   R$ {salesReport.reduce((acc, s) => acc + s.total, 0).toLocaleString()}
                 </h3>
              </div>
              <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700">
                 <p className="text-slate-400 text-sm font-medium">Lucro Líquido</p>
                 <h3 className="text-2xl font-bold text-green-500 mt-1">
                   R$ {salesReport.reduce((acc, s) => acc + s.profit, 0).toLocaleString()}
                 </h3>
              </div>
           </div>

           <div className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden">
              <div className="p-6 border-b border-dark-700 flex flex-col md:flex-row justify-between gap-4">
                 <h3 className="text-lg font-bold text-white">Relatório de Vendas</h3>
                 <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        type="text" 
                        placeholder="Buscar venda..." 
                        className="bg-dark-900 border border-dark-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-primary-500 outline-none"
                      />
                    </div>
                    <button className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                       <Calendar size={16} /> Este Mês
                    </button>
                 </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-slate-400 text-sm border-b border-dark-700 bg-dark-800/50">
                      <th className="p-4 font-medium">Data</th>
                      <th className="p-4 font-medium">Venda ID</th>
                      <th className="p-4 font-medium">Aparelhos</th>
                      <th className="p-4 font-medium text-right">Custo Total</th>
                      <th className="p-4 font-medium text-right">Venda Total</th>
                      <th className="p-4 font-medium text-right">Lucro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {salesReport.map(sale => (
                      <tr key={sale.id} className="hover:bg-dark-700/50 transition-colors">
                        <td className="p-4 text-slate-300 text-sm">{new Date(sale.date).toLocaleDateString()}</td>
                        <td className="p-4 text-primary-400 text-sm font-mono">#{sale.id.slice(-4).toUpperCase()}</td>
                        <td className="p-4 text-white text-sm">
                           {sale.items.map(i => i.model).join(', ')}
                           {sale.tradeIn && <span className="text-xs text-orange-400 block">+ Entrada: {sale.tradeIn.model}</span>}
                        </td>
                        <td className="p-4 text-right text-slate-400 text-sm">R$ {sale.costOfGoods.toLocaleString()}</td>
                        <td className="p-4 text-right text-white font-medium">R$ {sale.total.toLocaleString()}</td>
                        <td className="p-4 text-right font-bold text-green-500">R$ {sale.profit.toLocaleString()}</td>
                      </tr>
                    ))}
                    {salesReport.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nenhuma venda registrada.</td></tr>
                    )}
                  </tbody>
                  <tfoot className="bg-dark-900/50 border-t border-dark-700">
                    <tr>
                      <td colSpan={3} className="p-4 text-right text-slate-400 font-medium">Totais</td>
                      <td className="p-4 text-right text-slate-400 font-bold">R$ {salesReport.reduce((acc,s) => acc + s.costOfGoods, 0).toLocaleString()}</td>
                      <td className="p-4 text-right text-white font-bold">R$ {salesReport.reduce((acc,s) => acc + s.total, 0).toLocaleString()}</td>
                      <td className="p-4 text-right text-green-500 font-bold">R$ {salesReport.reduce((acc,s) => acc + s.profit, 0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL: TRANSACTION --- */}
      {isTransModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-dark-900 w-full max-w-md rounded-2xl border border-dark-700 shadow-2xl">
            <div className="p-6 border-b border-dark-700 flex justify-between items-center bg-dark-800 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">Nova Movimentação</h3>
              <button onClick={() => setIsTransModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
               <div>
                 <label className="block text-sm font-medium text-slate-400 mb-2">Tipo de Movimento</label>
                 <div className="flex bg-dark-800 rounded-lg p-1 border border-dark-600">
                    <button 
                      onClick={() => setTransFormData({...transFormData, type: 'IN'})}
                      className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${transFormData.type === 'IN' ? 'bg-green-600 text-white' : 'text-slate-400'}`}
                    >
                      Entrada (+)
                    </button>
                    <button 
                      onClick={() => setTransFormData({...transFormData, type: 'OUT'})}
                      className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${transFormData.type === 'OUT' ? 'bg-red-600 text-white' : 'text-slate-400'}`}
                    >
                      Saída (-)
                    </button>
                 </div>
               </div>

               <div>
                 <label className="block text-sm font-medium text-slate-400 mb-2">Categoria</label>
                 <select 
                   className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                   value={transFormData.category}
                   onChange={e => setTransFormData({...transFormData, category: e.target.value})}
                 >
                   {transFormData.type === 'IN' ? (
                     <>
                       <option value="Aporte">Aporte / Investimento</option>
                       <option value="Serviço">Serviço</option>
                       <option value="Venda">Outras Vendas</option>
                     </>
                   ) : (
                     <>
                       <option value="Retirada">Retirada de Lucro</option>
                       <option value="Insumo">Insumos / Peças</option>
                       <option value="Compra">Compra de Aparelho</option>
                       <option value="Serviço">Pagamento de Serviço</option>
                     </>
                   )}
                 </select>
               </div>

               <div>
                 <label className="block text-sm font-medium text-slate-400 mb-2">Valor (R$)</label>
                 <input 
                   type="number"
                   className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                   value={transFormData.amount}
                   onChange={e => setTransFormData({...transFormData, amount: e.target.value})}
                   placeholder="0,00"
                 />
               </div>

               <div>
                 <label className="block text-sm font-medium text-slate-400 mb-2">Descrição</label>
                 <input 
                   type="text"
                   className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                   value={transFormData.description}
                   onChange={e => setTransFormData({...transFormData, description: e.target.value})}
                   placeholder="Ex: Pagamento de conta de luz"
                 />
               </div>

               <div className="pt-2">
                 <button 
                   onClick={handleAddTransaction}
                   className={`w-full font-bold py-3 rounded-xl transition-all text-white ${
                     transFormData.type === 'IN' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
                   }`}
                 >
                   Confirmar {transFormData.type === 'IN' ? 'Entrada' : 'Saída'}
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: TRANSFER --- */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-dark-900 w-full max-w-sm rounded-2xl border border-dark-700 shadow-2xl">
             <div className="p-6 border-b border-dark-700 flex justify-between items-center bg-dark-800 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <ArrowRightLeft size={20} /> Transferência
              </h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between bg-dark-800 p-4 rounded-xl border border-dark-600">
                 <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">De</p>
                    <p className="font-bold text-white">{transferData.from}</p>
                 </div>
                 <ArrowRightLeft size={20} className="text-primary-500" />
                 <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">Para</p>
                    <p className="font-bold text-white">{transferData.to}</p>
                 </div>
              </div>

              <div>
                 <label className="block text-sm font-medium text-slate-400 mb-2">Valor da Transferência</label>
                 <input 
                   type="number"
                   className="w-full bg-dark-800 border border-dark-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none text-lg font-bold text-center"
                   value={transferData.amount}
                   onChange={e => setTransferData({...transferData, amount: e.target.value})}
                   placeholder="R$ 0,00"
                   autoFocus
                 />
              </div>

              <button 
                onClick={handleTransfer}
                className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 rounded-xl mt-2 transition-all"
              >
                Confirmar Transferência
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper icon for Cofre
const LockIcon = ({ size, className }: { size?: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);

export default Finance;