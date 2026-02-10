import React, { useMemo } from 'react';
import { useData } from '../services/dataContext';
import { TrendingUp, Smartphone, Users, AlertCircle, DollarSign } from 'lucide-react';
import { StockStatus, Condition } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const StatCard: React.FC<{ title: string; value: string; icon: any; color: string; subtext?: string }> = ({ 
  title, value, icon: Icon, color, subtext 
}) => (
  <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 shadow-lg hover:shadow-xl transition-shadow">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-white">{value}</h3>
        {subtext && <p className="text-xs text-slate-500 mt-2">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-20`}>
        <Icon className={color.replace('bg-', 'text-')} size={24} />
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
    const potentialProfit = availableStock.reduce((acc, s) => acc + (s.sellPrice - s.purchasePrice), 0);
    const lowStock = availableStock.length < 5;

    return { totalRevenue, stockCount: availableStock.length, stockValue, potentialProfit, lowStock };
  }, [stock, sales]);

  const chartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    // Generate last 6 months keys based on current date
    const result = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthIndex = d.getMonth();
        const monthName = months[monthIndex];
        const year = d.getFullYear();

        // Aggregate sales for this month
        const monthlySales = sales.filter(s => {
            const sDate = new Date(s.date);
            return sDate.getMonth() === monthIndex && sDate.getFullYear() === year;
        });
        
        const totalVendas = monthlySales.reduce((acc, s) => acc + s.total, 0);
        
        // Simple profit calculation for chart
        const totalLucro = monthlySales.reduce((acc, s) => {
             // Cost = Purchase Price of items + Repair Costs
             const cost = s.items.reduce((c, item) => c + item.purchasePrice + (item.costs?.reduce((rc, cost) => rc + cost.amount, 0) || 0), 0);
             // Revenue = Sale Total + Trade In Value (if any)
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-slate-400">Visão geral do seu negócio hoje</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Faturamento Total" 
          value={`R$ ${metrics.totalRevenue.toLocaleString('pt-BR')}`}
          icon={TrendingUp}
          color="bg-primary-500"
          subtext="Total acumulado"
        />
        <StatCard 
          title="Estoque Atual" 
          value={metrics.stockCount.toString()}
          icon={Smartphone}
          color="bg-accent-500"
          subtext={`Valor Custo: R$ ${metrics.stockValue.toLocaleString('pt-BR')}`}
        />
        <StatCard 
          title="Lucro Potencial" 
          value={`R$ ${metrics.potentialProfit.toLocaleString('pt-BR')}`}
          icon={DollarSign}
          color="bg-green-500"
          subtext="Se vender tudo hoje"
        />
        <StatCard 
          title="Clientes Ativos" 
          value={customers.length.toString()}
          icon={Users}
          color="bg-purple-500"
          subtext="Cadastrados no sistema"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-dark-800 p-6 rounded-2xl border border-dark-700">
          <h3 className="text-lg font-bold text-white mb-6">Performance de Vendas (Últimos 6 meses)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                />
                <Bar dataKey="vendas" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Vendas" />
                <Bar dataKey="lucro" fill="#22c55e" radius={[4, 4, 0, 0]} name="Lucro" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions / Alerts */}
        <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700">
          <h3 className="text-lg font-bold text-white mb-4">Atalhos e Alertas</h3>
          <div className="space-y-4">
            {metrics.stockCount < 5 && metrics.stockCount > 0 && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 items-center text-red-400">
                <AlertCircle size={20} />
                <div>
                  <p className="font-semibold text-sm">Estoque Baixo</p>
                  <p className="text-xs">Considere adquirir novos aparelhos.</p>
                </div>
              </div>
            )}
             {metrics.stockCount === 0 && (
              <div className="p-4 bg-accent-500/10 border border-accent-500/20 rounded-xl flex gap-3 items-center text-accent-400">
                <Smartphone size={20} />
                <div>
                  <p className="font-semibold text-sm">Estoque Vazio</p>
                  <p className="text-xs">Cadastre seus primeiros aparelhos.</p>
                </div>
              </div>
            )}
            
            <button className="w-full py-3 bg-primary-600 hover:bg-primary-500 rounded-xl text-white font-medium transition-colors">
              Nova Venda (PDV)
            </button>
            <button className="w-full py-3 bg-dark-700 hover:bg-dark-600 rounded-xl text-white font-medium transition-colors">
              Adicionar Aparelho
            </button>
          </div>

          <div className="mt-8">
            <h4 className="text-sm font-semibold text-slate-400 mb-3">Últimas Vendas</h4>
            <div className="space-y-3">
              {sales.slice(-3).reverse().map(sale => (
                <div key={sale.id} className="flex justify-between items-center p-3 bg-dark-900 rounded-lg">
                  <div>
                    <p className="text-white text-sm font-medium">{sale.items[0].model}</p>
                    <p className="text-xs text-slate-500">{new Date(sale.date).toLocaleDateString()}</p>
                  </div>
                  <span className="text-green-400 font-bold text-sm">
                    R$ {sale.total.toLocaleString()}
                  </span>
                </div>
              ))}
              {sales.length === 0 && <p className="text-sm text-slate-600 text-center py-4">Nenhuma venda registrada.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;