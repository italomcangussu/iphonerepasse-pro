import React, { useMemo } from 'react';
import { useData } from '../services/dataContext';
import { TrendingUp, Smartphone, Users, AlertCircle, DollarSign, Package, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { StockStatus, Condition } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';

const StatCard: React.FC<{ 
  title: string; 
  value: string; 
  icon: any; 
  trend?: { value: number; positive: boolean };
  subtext?: string;
  color: string;
}> = ({ title, value, icon: Icon, trend, subtext, color }) => (
  <div className="ios-card-hover p-6">
    <div className="flex justify-between items-start">
      <div className="flex-1">
        <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 uppercase tracking-wide font-medium mb-1">{title}</p>
        <h3 className="text-ios-title-1 font-bold text-gray-900 dark:text-white">{value}</h3>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-ios-footnote font-medium ${trend.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {trend.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{trend.value}%</span>
          </div>
        )}
        {subtext && <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500 mt-2">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-ios-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const { stock, sales, customers, transactions } = useData();

  const metrics = useMemo(() => {
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.total, 0);
    const availableStock = stock.filter(s => s.status === StockStatus.AVAILABLE);
    const stockValue = availableStock.reduce((acc, s) => acc + s.purchasePrice, 0);
    const potentialProfit = availableStock.reduce((acc, s) => acc + (s.sellPrice - s.purchasePrice - (s.costs?.reduce((c, cost) => c + cost.amount, 0) || 0)), 0);
    const lowStock = availableStock.length < 5;

    return { totalRevenue, stockCount: availableStock.length, stockValue, potentialProfit, lowStock };
  }, [stock, sales]);

  const chartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const result = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthIndex = d.getMonth();
      const monthName = months[monthIndex];
      const year = d.getFullYear();

      const monthlySales = sales.filter(s => {
        const sDate = new Date(s.date);
        return sDate.getMonth() === monthIndex && sDate.getFullYear() === year;
      });
      
      const totalVendas = monthlySales.reduce((acc, s) => acc + s.total, 0);
      
      const totalLucro = monthlySales.reduce((acc, s) => {
        const cost = s.items.reduce((c, item) => c + item.purchasePrice + (item.costs?.reduce((rc, cost) => rc + cost.amount, 0) || 0), 0);
        const revenue = s.total + (s.tradeInValue || 0);
        return acc + (revenue - cost);
      }, 0);

      result.push({
        name: monthName,
        vendas: totalVendas,
        lucro: totalLucro
      });
    }
    return result;
  }, [sales]);

  const stockByCondition = useMemo(() => {
    const newCount = stock.filter(s => s.condition === Condition.NEW && s.status === StockStatus.AVAILABLE).length;
    const usedCount = stock.filter(s => s.condition === Condition.USED && s.status === StockStatus.AVAILABLE).length;
    return [
      { name: 'Novos', value: newCount, color: '#3b82f6' },
      { name: 'Seminovos', value: usedCount, color: '#f97316' },
    ];
  }, [stock]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-ios-large font-bold text-gray-900 dark:text-white">Dashboard</h2>
          <p className="text-ios-body text-gray-500 dark:text-surface-dark-500 mt-1">Visão geral do seu negócio</p>
        </div>
        <div className="flex gap-3">
          <Link to="/pdv" className="ios-button-primary flex items-center gap-2">
            <DollarSign size={18} />
            Nova Venda
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Faturamento Total" 
          value={`R$ ${metrics.totalRevenue.toLocaleString('pt-BR')}`}
          icon={TrendingUp}
          color="bg-gradient-to-br from-brand-500 to-brand-600"
          subtext="Total acumulado"
        />
        <StatCard 
          title="Estoque Atual" 
          value={metrics.stockCount.toString()}
          icon={Package}
          color="bg-gradient-to-br from-accent-500 to-accent-600"
          subtext={`Valor Custo: R$ ${metrics.stockValue.toLocaleString('pt-BR')}`}
        />
        <StatCard 
          title="Lucro Potencial" 
          value={`R$ ${metrics.potentialProfit.toLocaleString('pt-BR')}`}
          icon={DollarSign}
          color="bg-gradient-to-br from-green-500 to-green-600"
          subtext="Se vender tudo hoje"
        />
        <StatCard 
          title="Clientes Ativos" 
          value={customers.length.toString()}
          icon={Users}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
          subtext="Cadastrados no sistema"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 ios-card p-6">
          <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-6">Performance de Vendas (Últimos 6 meses)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    borderColor: '#e5e7eb', 
                    borderRadius: '12px',
                    color: '#111827'
                  }}
                />
                <Bar dataKey="vendas" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Vendas" />
                <Bar dataKey="lucro" fill="#22c55e" radius={[8, 8, 0, 0]} name="Lucro" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Stock Distribution */}
          <div className="ios-card p-6">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4">Distribuição do Estoque</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockByCondition}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stockByCondition.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              {stockByCondition.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-ios-footnote text-gray-600 dark:text-surface-dark-600">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts & Quick Actions */}
          <div className="ios-card p-6">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4">Alertas e Ações</h3>
            <div className="space-y-4">
              {metrics.stockCount < 5 && metrics.stockCount > 0 && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-ios-lg flex gap-3 items-center text-red-700 dark:text-red-400">
                  <AlertCircle size={20} />
                  <div>
                    <p className="font-semibold text-ios-subhead">Estoque Baixo</p>
                    <p className="text-ios-footnote">Considere adquirir novos aparelhos.</p>
                  </div>
                </div>
              )}
              {metrics.stockCount === 0 && (
                <div className="p-4 bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 rounded-ios-lg flex gap-3 items-center text-accent-700 dark:text-accent-400">
                  <Smartphone size={20} />
                  <div>
                    <p className="font-semibold text-ios-subhead">Estoque Vazio</p>
                    <p className="text-ios-footnote">Cadastre seus primeiros aparelhos.</p>
                  </div>
                </div>
              )}
              
              <Link to="/inventory" className="w-full py-3 bg-gray-100 dark:bg-surface-dark-200 hover:bg-gray-200 dark:hover:bg-surface-dark-300 rounded-ios-lg text-gray-900 dark:text-white font-medium transition-colors text-center block">
                Adicionar Aparelho
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="ios-card p-6">
        <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-6">Últimas Vendas</h3>
        <div className="space-y-3">
          {sales.slice(-5).reverse().map(sale => (
            <div key={sale.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-surface-dark-200 rounded-ios-lg">
              <div>
                <p className="text-gray-900 dark:text-white font-medium">{sale.items[0].model}</p>
                <p className="text-ios-footnote text-gray-500 dark:text-surface-dark-500">{new Date(sale.date).toLocaleDateString('pt-BR')}</p>
              </div>
              <span className="text-green-600 dark:text-green-400 font-bold">
                R$ {sale.total.toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
          {sales.length === 0 && (
            <p className="text-ios-body text-gray-500 dark:text-surface-dark-500 text-center py-8">Nenhuma venda registrada.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
