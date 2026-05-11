import React, { useMemo } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { useData } from '../services/dataContext';
import { Users, AlertCircle, DollarSign, Package, ArrowUpRight, ArrowDownRight, Smartphone } from 'lucide-react';
import { StockStatus, Condition } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Link } from 'react-router-dom';
import StableResponsiveContainer from '../components/charts/StableResponsiveContainer';
import { AnimatedNumber, Stagger } from '../components/motion';
import { iosSpring } from '../components/motion/transitions';
import { useTheme } from '../contexts/ThemeContext';
import DevicesSoldAnalytics from '../components/DevicesSoldAnalytics';

const StatCard: React.FC<{
  title: string;
  /** Numeric value for animated count-up. When provided, takes priority over `value`. */
  numericValue?: number;
  /** Formatter used when `numericValue` is provided. */
  formatValue?: (n: number) => string;
  /** Fallback display when `numericValue` is not provided. */
  value?: string;
  icon: any;
  trend?: { value: number; positive: boolean };
  subtext?: string;
  color: string;
  to?: string;
}> = ({ title, numericValue, formatValue, value, icon: Icon, trend, subtext, color, to }) => {
  const reducedMotion = useReducedMotion();

  const content = (
    <m.div
      className="ios-card p-4 md:p-5 h-full will-change-transform"
      whileHover={reducedMotion ? undefined : { y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.06)' }}
      transition={iosSpring}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-ios-caption app-text-muted uppercase tracking-wide font-semibold">{title}</p>
        <div className={`p-2 md:p-2.5 rounded-ios ${color} shrink-0`}>
          <Icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
        </div>
      </div>
      <h3 className="mt-2 text-[22px] md:text-ios-title-1 leading-tight font-bold app-text-primary tabular-nums wrap-break-word">
        {typeof numericValue === 'number' ? (
          <AnimatedNumber value={numericValue} format={formatValue} />
        ) : (
          value
        )}
      </h3>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-ios-footnote font-semibold ${trend.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {trend.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <span>{trend.value}%</span>
        </div>
      )}
      {subtext && <p className="text-ios-caption app-text-muted mt-2 wrap-break-word">{subtext}</p>}
    </m.div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-ios-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-dark-50"
      >
        {content}
      </Link>
    );
  }

  return content;
};

const Dashboard: React.FC = () => {
  const { stock, sales, customers } = useData();
  const reducedMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Chart theme colors — adapt to current mode (B2)
  const chartGridColor  = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(15,23,42,0.07)';
  const chartAxisColor  = isDark ? '#64748b' : '#94a3b8';
  const chartTooltipBg  = isDark
    ? 'rgba(17,24,39,0.92)'
    : 'rgba(255,255,255,0.92)';
  const chartTooltipText = isDark ? '#f8fafc' : '#111827';

  const metrics = useMemo(() => {
    const availableStock = stock.filter(s => s.status === StockStatus.AVAILABLE);
    const stockValue = availableStock.reduce((acc, s) => acc + s.purchasePrice, 0);
    return { stockCount: availableStock.length, stockValue };
  }, [stock]);

  // Month-over-month trend for sales (A1)
  const salesTrend = useMemo(() => {
    const now = new Date();
    const thisMonth = { m: now.getMonth(), y: now.getFullYear() };
    const lastMonth = now.getMonth() === 0
      ? { m: 11, y: now.getFullYear() - 1 }
      : { m: now.getMonth() - 1, y: now.getFullYear() };

    const sum = (m: number, y: number) =>
      sales
        .filter(s => { const d = new Date(s.date); return d.getMonth() === m && d.getFullYear() === y; })
        .reduce((acc, s) => acc + s.total, 0);

    const current = sum(thisMonth.m, thisMonth.y);
    const previous = sum(lastMonth.m, lastMonth.y);
    if (previous === 0) return undefined;
    const pct = Math.round(((current - previous) / previous) * 100);
    return { value: Math.abs(pct), positive: pct >= 0 };
  }, [sales]);

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

      result.push({
        name: monthName,
        vendas: totalVendas
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="app-page-title">Dashboard</h2>
          <p className="app-page-subtitle">Visão geral do seu negócio</p>
        </div>
        <Link to="/pdv/nova-venda" className="ios-button-primary flex items-center gap-2 w-full md:w-auto justify-center">
          <DollarSign size={18} />
          Nova Venda
        </Link>
      </div>

      <Stagger className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        <Stagger.Item>
          <StatCard
            title="Estoque"
            numericValue={metrics.stockCount}
            icon={Package}
            color="bg-gradient-to-br from-accent-500 to-accent-600"
            subtext={`R$ ${metrics.stockValue.toLocaleString('pt-BR')}`}
            to="/inventory"
          />
        </Stagger.Item>
        <Stagger.Item>
          <StatCard
            title="Clientes"
            numericValue={customers.length}
            icon={Users}
            color="bg-gradient-to-br from-purple-500 to-purple-600"
            subtext="Cadastrados"
            to="/clients"
          />
        </Stagger.Item>
        <Stagger.Item>
          <StatCard
            title="Vendas este mês"
            numericValue={sales.filter(s => {
              const d = new Date(s.date);
              const n = new Date();
              return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
            }).length}
            icon={DollarSign}
            trend={salesTrend}
            color="bg-gradient-to-br from-green-500 to-green-600"
            subtext="vs. mês anterior"
          />
        </Stagger.Item>
      </Stagger>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 ios-card p-4 md:p-6 min-w-0">
          <h3 className="text-ios-title-3 font-bold app-text-primary mb-4 md:mb-6">Vendas (6 meses)</h3>
          {chartData.every((d) => d.vendas === 0) ? (
            <div className="h-56 md:h-80 w-full flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full app-surface-soft flex items-center justify-center mb-3">
                <Package size={24} className="app-text-muted" />
              </div>
              <p className="text-ios-body font-semibold app-text-primary">Sem dados ainda</p>
              <p className="text-ios-footnote app-text-muted mt-1">As vendas dos próximos 6 meses aparecerão aqui.</p>
            </div>
          ) : (
          <div className="h-56 md:h-80 w-full">
            <StableResponsiveContainer>
              <BarChart data={chartData}>
                <defs>
                  <linearGradient id="barVendasGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#007AFF" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                <XAxis dataKey="name" stroke={chartAxisColor} fontSize={12} tickMargin={8} axisLine={false} tickLine={false} />
                <YAxis stroke={chartAxisColor} fontSize={12} width={55} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} />
                <Tooltip
                  cursor={{ fill: 'rgba(59, 130, 246, 0.06)', radius: 8 }}
                  contentStyle={{
                    backgroundColor: chartTooltipBg,
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.06)'}`,
                    borderRadius: '14px',
                    color: chartTooltipText,
                    fontSize: '13px',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)',
                  }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Vendas']}
                />
                <Bar
                  dataKey="vendas"
                  fill="url(#barVendasGradient)"
                  radius={[8, 8, 0, 0]}
                  name="Vendas"
                  isAnimationActive={!reducedMotion}
                  animationDuration={650}
                  animationEasing="ease-out"
                />
              </BarChart>
            </StableResponsiveContainer>
          </div>
          )}
        </div>

        <div className="space-y-4 md:space-y-6 min-w-0">
          <div className="ios-card p-4 md:p-6 min-w-0">
            <h3 className="text-ios-title-3 font-bold app-text-primary mb-3 md:mb-4">Distribuição</h3>
            <div className="h-40 md:h-48 w-full">
              <StableResponsiveContainer>
                <PieChart>
                  <defs>
                    <linearGradient id="pieNovosGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#007AFF" />
                    </linearGradient>
                    <linearGradient id="pieUsadosGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#fb923c" />
                      <stop offset="100%" stopColor="#FF9500" />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={stockByCondition}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={4}
                    dataKey="value"
                    isAnimationActive={!reducedMotion}
                    animationDuration={650}
                    animationEasing="ease-out"
                  >
                    {stockByCondition.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? 'url(#pieNovosGradient)' : 'url(#pieUsadosGradient)'}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} un.`, name]}
                    contentStyle={{
                      backgroundColor: chartTooltipBg,
                      backdropFilter: 'blur(20px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                      border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.06)'}`,
                      borderRadius: '14px',
                      color: chartTooltipText,
                      fontSize: '13px',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)',
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => <span style={{ fontSize: '12px', color: chartAxisColor, fontWeight: 600 }}>{value}</span>}
                  />
                </PieChart>
              </StableResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-3">
              {stockByCondition.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-ios-footnote app-text-secondary">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ios-card p-4 md:p-6">
            <h3 className="text-ios-title-3 font-bold app-text-primary mb-3 md:mb-4">Alertas</h3>
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

      <DevicesSoldAnalytics />

      <div className="ios-card overflow-hidden">
        <div className="p-4 md:p-6 pb-0 md:pb-0">
          <h3 className="text-ios-title-3 font-bold app-text-primary mb-4">Últimas Vendas</h3>
        </div>
        <Stagger delay={0.04}>
          {sales.slice(-5).reverse().map((sale, idx, arr) => (
            <Stagger.Item key={sale.id}>
              <m.div
                className="flex justify-between items-center px-4 md:px-6 py-3.5 cursor-default"
                whileHover={reducedMotion ? undefined : { backgroundColor: 'rgba(59, 130, 246, 0.04)' }}
                transition={{ duration: 0.15 }}
              >
                <div className="min-w-0 flex-1">
                  <p className="app-text-primary font-medium text-[15px] truncate">{sale.items[0].model}</p>
                  <p className="text-ios-caption app-text-muted mt-0.5">{new Date(sale.date).toLocaleDateString('pt-BR')}</p>
                </div>
                <span className="text-green-600 dark:text-green-400 font-bold text-[15px] ml-3 shrink-0 tabular-nums">
                  R$ {(sale.total + (sale.tradeInValue || 0)).toLocaleString('pt-BR')}
                </span>
              </m.div>
              {idx < arr.length - 1 && <div className="ios-separator" />}
            </Stagger.Item>
          ))}
        </Stagger>
        {sales.length === 0 && (
          <m.div
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={iosSpring}
            className="flex flex-col items-center justify-center text-center py-12 px-4"
          >
            <div className="w-14 h-14 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-3">
              <DollarSign size={26} className="text-brand-500" />
            </div>
            <p className="text-ios-body font-semibold app-text-primary">Nenhuma venda registrada</p>
            <p className="text-ios-footnote app-text-muted mt-1">As vendas mais recentes aparecerão aqui.</p>
            <Link to="/pdv/nova-venda" className="ios-button-primary mt-4 inline-flex items-center gap-2">
              <DollarSign size={16} />
              Registrar venda
            </Link>
          </m.div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
