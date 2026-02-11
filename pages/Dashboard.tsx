import React, { useMemo } from 'react';
import { useData } from '../services/dataContext';
import { TrendingUp, Users, AlertCircle, DollarSign, Package, ArrowUpRight, ArrowDownRight, Smartphone } from 'lucide-react';
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
  <div className="ios-card-hover p-5">
    <div className="flex justify-between items-start">
      <div className="flex-1 min-w-0">
        <p className="text-ios-caption text-gray-500 dark:text-surface-dark-500 uppercase tracking-wide font-semibold mb-1.5">{title}</p>
        <h3 className="text-[24px] md:text-ios-title-1 font-bold text-gray-900 dark:text-white truncate">{value}</h3>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-ios-footnote font-semibold ${trend.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {trend.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{trend.value}%</span>
          </div>
        )}
        {subtext && <p className="text-ios-caption text-gray-500 dark:text-surface-dark-500 mt-2">{subtext}</p>}
      </div>
      <div className={`p-2.5 rounded-ios ${color} shrink-0 ml-3`}>
        <Icon className="w-5 h-5 text-white" />
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
      { name: 'Novos', value: newCount, color: '#007AFF' },
      { name: 'Seminovos', value: usedCount, color: '#FF9500' },
    ];
  }, [stock]);

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto">
      {/* Header — HIG: Large Title style on mobile */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="text-[28px] md:text-ios-large font-bold text-gray-900 dark:text-white tracking-tight">Dashboard</h2>
          <p className="text-ios-subhead text-gray-500 dark:text-surface-dark-500 mt-0.5">Visao geral do seu negocio</p>
        </div>
        <Link to="/pdv" className="ios-button-primary flex items-center gap-2 w-full md:w-auto justify-center">
          <DollarSign size={18} />
          Nova Venda
        </Link>
      </div>

      {/* Stats Grid — HIG: 2 columns on mobile for better touch targets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard
          title="Faturamento"
          value={`R$ ${metrics.totalRevenue.toLocaleString('pt-BR')}`}
          icon={TrendingUp}
          color="bg-gradient-to-br from-brand-500 to-brand-600"
          subtext="Total acumulado"
        />
        <StatCard
          title="Estoque"
          value={metrics.stockCount.toString()}
          icon={Package}
          color="bg-gradient-to-br from-accent-500 to-accent-600"
          subtext={`R$ ${metrics.stockValue.toLocaleString('pt-BR')}`}
        />
        <StatCard
          title="Lucro Pot."
          value={`R$ ${metrics.potentialProfit.toLocaleString('pt-BR')}`}
          icon={DollarSign}
          color="bg-gradient-to-br from-green-500 to-green-600"
          subtext="Se vender tudo"
        />
        <StatCard
          title="Clientes"
          value={customers.length.toString()}
          icon={Users}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
          subtext="Cadastrados"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 ios-card p-4 md:p-6">
          <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4 md:mb-6">Vendas (6 meses)</h3>
          <div className="h-56 md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickMargin={8} />
                <YAxis stroke="#9ca3af" fontSize={12} width={45} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderColor: '#e5e7eb',
                    borderRadius: '12px',
                    color: '#111827',
                    fontSize: '13px'
                  }}
                />
                <Bar dataKey="vendas" fill="#007AFF" radius={[6, 6, 0, 0]} name="Vendas" />
                <Bar dataKey="lucro" fill="#34C759" radius={[6, 6, 0, 0]} name="Lucro" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-4 md:space-y-6">
          {/* Stock Distribution */}
          <div className="ios-card p-4 md:p-6">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Distribuicao</h3>
            <div className="h-40 md:h-48 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={stockByCondition}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
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
            <div className="flex justify-center gap-6 mt-3">
              {stockByCondition.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-ios-footnote text-gray-600 dark:text-surface-dark-600">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts & Quick Actions */}
          <div className="ios-card p-4 md:p-6">
            <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Alertas</h3>
            <div className="space-y-3">
              {metrics.stockCount < 5 && metrics.stockCount > 0 && (
                <div className="p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-ios-lg flex gap-3 items-center text-red-700 dark:text-red-400">
                  <AlertCircle size={20} className="shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-ios-subhead">Estoque Baixo</p>
                    <p className="text-ios-caption">Considere adquirir novos aparelhos.</p>
                  </div>
                </div>
              )}
              {metrics.stockCount === 0 && (
                <div className="p-3.5 bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 rounded-ios-lg flex gap-3 items-center text-accent-700 dark:text-accent-400">
                  <Smartphone size={20} className="shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-ios-subhead">Estoque Vazio</p>
                    <p className="text-ios-caption">Cadastre seus primeiros aparelhos.</p>
                  </div>
                </div>
              )}

              <Link to="/inventory" className="ios-button-tinted w-full justify-center">
                Adicionar Aparelho
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sales — HIG: Inset grouped list style */}
      <div className="ios-card overflow-hidden">
        <div className="p-4 md:p-6 pb-0 md:pb-0">
          <h3 className="text-ios-title-3 font-bold text-gray-900 dark:text-white mb-4">Ultimas Vendas</h3>
        </div>
        <div>
          {sales.slice(-5).reverse().map((sale, idx, arr) => (
            <div key={sale.id}>
              <div className="flex justify-between items-center px-4 md:px-6 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900 dark:text-white font-medium text-[15px] truncate">{sale.items[0].model}</p>
                  <p className="text-ios-caption text-gray-500 dark:text-surface-dark-500 mt-0.5">{new Date(sale.date).toLocaleDateString('pt-BR')}</p>
                </div>
                <span className="text-green-600 dark:text-green-400 font-bold text-[15px] ml-3 shrink-0">
                  R$ {sale.total.toLocaleString('pt-BR')}
                </span>
              </div>
              {idx < arr.length - 1 && <div className="ios-separator" />}
            </div>
          ))}
          {sales.length === 0 && (
            <p className="text-ios-body text-gray-500 dark:text-surface-dark-500 text-center py-10 px-4">Nenhuma venda registrada.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
