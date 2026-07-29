import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  Sparkles,
  BarChart2,
  Plus,
  X,
  Award,
  Flame,
  PieChart,
  CalendarX,
  Check,
} from 'lucide-react';
import { Sale, Seller, StoreLocation } from '../types';
import StableResponsiveContainer from './charts/StableResponsiveContainer';
import { useChartTheme } from '../hooks/useChartTheme';
import { iosSpring } from './motion/transitions';

/** Máximo de séries simultâneas — acima disso o gráfico vira espaguete. */
const MAX_SERIES = 6;

/** Sufixo da chave que carrega as unidades até o tooltip (não é plotada). */
const UNITS_SUFFIX = '__units';

function formatUnits(count: number): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? 'aparelho' : 'aparelhos'}`;
}

const PALETTE = [
  { name: 'Azul Apple', main: '#007AFF', border: 'border-blue-500', bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', lightBg: 'bg-blue-500/10' },
  { name: 'Laranja Vibrante', main: '#FF9500', border: 'border-amber-500', bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', lightBg: 'bg-amber-500/10' },
  { name: 'Verde Esmeralda', main: '#34C759', border: 'border-emerald-500', bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', lightBg: 'bg-emerald-500/10' },
  { name: 'Roxo Elétrico', main: '#AF52DE', border: 'border-purple-500', bg: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300', lightBg: 'bg-purple-500/10' },
  { name: 'Vermelho Coral', main: '#FF3B30', border: 'border-rose-500', bg: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', lightBg: 'bg-rose-500/10' },
  { name: 'Ciano Neve', main: '#5AC8FA', border: 'border-cyan-500', bg: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-300', lightBg: 'bg-cyan-500/10' },
];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export interface MonthlyRevenueComparisonChartProps {
  sales: Sale[];
  /** Para o filtro de funcionário — opcional: sem eles o filtro não aparece. */
  sellers?: Seller[];
  /** Para o filtro de loja — só aparece quando há mais de uma. */
  stores?: StoreLocation[];
}

const ALL = 'all';

function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  return `${MONTH_NAMES[monthIdx] || monthStr} ${yearStr}`;
}

function formatShortMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  return `${MONTH_NAMES_SHORT[monthIdx] || monthStr}/${yearStr.slice(2)}`;
}

function getDaysInMonth(year: number, monthOneBased: number): number {
  return new Date(year, monthOneBased, 0).getDate();
}

/** Moeda em pt-BR sem centavos — valores de faturamento não precisam deles. */
function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

/**
 * Eixo Y: compacta milhares (R$ 400k). "mil" por extenso quebra o tick em duas
 * linhas na largura de eixo que cabe no mobile.
 */
function formatAxisBRL(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `R$ ${Math.round(value / 1000).toLocaleString('pt-BR')}k`;
  }
  return formatBRL(value);
}

export const MonthlyRevenueComparisonChart: React.FC<MonthlyRevenueComparisonChartProps> = ({
  sales,
  sellers = [],
  stores = [],
}) => {
  const chart = useChartTheme();
  const reducedMotion = useReducedMotion();

  const [storeFilter, setStoreFilter] = useState<string>(ALL);
  const [sellerFilter, setSellerFilter] = useState<string>(ALL);

  // Um funcionário pertence a uma loja: ao escolher a loja, a lista de
  // funcionários encolhe para os dela (evita combinação que não retorna nada).
  const sellersForStore = useMemo(() => {
    const list = storeFilter === ALL
      ? sellers
      : sellers.filter(s => s.storeId === storeFilter);
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [sellers, storeFilter]);

  // Trocar de loja pode deixar o funcionário selecionado fora da lista — o
  // select ficaria mostrando um nome que não filtra mais nada.
  useEffect(() => {
    if (sellerFilter !== ALL && !sellersForStore.some(s => s.id === sellerFilter)) {
      setSellerFilter(ALL);
    }
  }, [sellersForStore, sellerFilter]);

  const hasActiveFilter = storeFilter !== ALL || sellerFilter !== ALL;

  const filteredSales = useMemo(() => {
    if (!hasActiveFilter) return sales;
    return sales.filter(sale => {
      if (storeFilter !== ALL && sale.storeId !== storeFilter) return false;
      if (sellerFilter !== ALL && sale.sellerId !== sellerFilter) return false;
      return true;
    });
  }, [sales, storeFilter, sellerFilter, hasActiveFilter]);

  // `new Date()` a cada render invalidaria todos os useMemo abaixo; congelamos a
  // referência e derivamos só primitivos estáveis a partir dela.
  const [today] = useState(() => new Date());
  const currentYear = today.getFullYear();
  const currentDayOfMonth = today.getDate();
  const currentMonthKey = `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const lastMonthDate = new Date(currentYear, today.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // Meses disponíveis vêm das vendas SEM filtro: a lista do seletor não pode
  // encolher enquanto o usuário troca de loja/funcionário.
  const availableMonthKeys = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthKey);
    set.add(lastMonthKey);

    sales.forEach(sale => {
      if (!sale.date) return;
      const d = new Date(sale.date);
      if (isNaN(d.getTime())) return;
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      set.add(mKey);
    });

    return Array.from(set).sort().reverse();
  }, [sales, currentMonthKey, lastMonthKey]);

  // Selected months state (default: current month and last month if available)
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => {
    const initial = [currentMonthKey];
    if (lastMonthKey !== currentMonthKey) {
      initial.push(lastMonthKey);
    }
    return initial;
  });

  // Display mode: cumulative vs daily
  const [mode, setMode] = useState<'cumulative' | 'daily'>('cumulative');

  // Multi-select dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const atSeriesLimit = selectedMonths.length >= MAX_SERIES;

  // Esc fecha o dropdown e devolve o foco ao gatilho (convenção de menu).
  useEffect(() => {
    if (!isDropdownOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        dropdownRef.current?.querySelector<HTMLButtonElement>('[data-dropdown-trigger]')?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isDropdownOpen]);

  // Quick Preset Handlers
  const handlePresetCurrentVsLast = () => {
    const res = [currentMonthKey];
    if (lastMonthKey !== currentMonthKey) {
      res.push(lastMonthKey);
    }
    setSelectedMonths(res);
  };

  const handlePresetYearOverYear = () => {
    const lastYearDate = new Date(currentYear - 1, today.getMonth(), 1);
    const lastYearKey = `${lastYearDate.getFullYear()}-${String(lastYearDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonths([currentMonthKey, lastYearKey]);
  };

  const handlePresetLast3Months = () => {
    setSelectedMonths(availableMonthKeys.slice(0, 3));
  };

  const toggleMonthSelection = useCallback((mKey: string) => {
    setSelectedMonths(prev => {
      if (prev.includes(mKey)) {
        if (prev.length === 1) return prev; // keep at least 1 month
        return prev.filter(k => k !== mKey);
      }
      if (prev.length >= MAX_SERIES) return prev;
      return [...prev, mKey];
    });
  }, []);

  // Map of color for each selected month
  const monthColorMap = useMemo(() => {
    const map = new Map<string, typeof PALETTE[0]>();
    selectedMonths.forEach((mKey, idx) => {
      map.set(mKey, PALETTE[idx % PALETTE.length]);
    });
    return map;
  }, [selectedMonths]);

  // Aggregate Sales by Month -> Day, em duas grandezas paralelas:
  // faturamento (R$) e unidades (aparelhos). Um mês pode faturar mais vendendo
  // menos aparelhos mais caros — as duas séries juntas contam essa história.
  // Structure: revenue[mKey][dayNumber] / units[mKey][dayNumber]
  const { revenue: monthSalesMap, units: monthUnitsMap } = useMemo(() => {
    const revenue: Record<string, Record<number, number>> = {};
    const units: Record<string, Record<number, number>> = {};

    selectedMonths.forEach(mKey => {
      revenue[mKey] = {};
      units[mKey] = {};
      for (let day = 1; day <= 31; day++) {
        revenue[mKey][day] = 0;
        units[mKey][day] = 0;
      }
    });

    filteredSales.forEach(sale => {
      if (!sale.date) return;
      const d = new Date(sale.date);
      if (isNaN(d.getTime())) return;

      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (revenue[mKey]) {
        const day = d.getDate();
        revenue[mKey][day] = (revenue[mKey][day] || 0) + (sale.total || 0);
        // Uma linha de `items` = um aparelho (mesma regra de DevicesSoldAnalytics).
        units[mKey][day] = (units[mKey][day] || 0) + (sale.items?.length || 0);
      }
    });

    return { revenue, units };
  }, [filteredSales, selectedMonths]);

  /** Último dia com dado real de cada mês (hoje, no mês em curso). */
  const getLastRealDay = useCallback((mKey: string) => {
    const [yearStr, monthStr] = mKey.split('-');
    const maxDays = getDaysInMonth(parseInt(yearStr, 10), parseInt(monthStr, 10));
    return mKey === currentMonthKey ? Math.min(currentDayOfMonth, maxDays) : maxDays;
  }, [currentMonthKey, currentDayOfMonth]);

  // Generate chart dataset (Days 1 to 31)
  const chartData = useMemo(() => {
    const result = [];

    // Cumulative tracking object for each month
    const runningTotals: Record<string, number> = {};
    const runningUnits: Record<string, number> = {};
    selectedMonths.forEach(mKey => {
      runningTotals[mKey] = 0;
      runningUnits[mKey] = 0;
    });

    for (let day = 1; day <= 31; day++) {
      const row: Record<string, number | string | null> = {
        day,
        dayLabel: `Dia ${day}`,
      };

      selectedMonths.forEach(mKey => {
        const lastRealDay = getLastRealDay(mKey);
        const dailyValue = monthSalesMap[mKey]?.[day] || 0;
        const dailyUnits = monthUnitsMap[mKey]?.[day] || 0;
        runningTotals[mKey] += dailyValue;
        runningUnits[mKey] += dailyUnits;

        // Depois do último dia com dado (fim do mês, ou hoje no mês em curso) a
        // série termina. Antes, o acumulado do mês em curso era achatado até o
        // dia 31 e parecia uma estagnação de vendas que nunca existiu.
        const beyond = day > lastRealDay;
        row[mKey] = beyond
          ? null
          : (mode === 'cumulative' ? runningTotals[mKey] : dailyValue);
        // Só o tooltip lê esta chave; nenhuma <Line> a plota.
        row[`${mKey}${UNITS_SUFFIX}`] = beyond
          ? null
          : (mode === 'cumulative' ? runningUnits[mKey] : dailyUnits);
      });

      result.push(row);
    }

    return result;
  }, [selectedMonths, monthSalesMap, monthUnitsMap, mode, getLastRealDay]);

  // Compute Nerd Comparison Stats
  const nerdStats = useMemo(() => {
    // Comparar um mês em curso (parcial) com meses fechados pelo total bruto
    // premia quem teve mais dias. O "campeão" é decidido no MESMO recorte de
    // dias — o menor último-dia-real entre os meses selecionados.
    const comparisonCutoffDay = selectedMonths.reduce(
      (min, mKey) => Math.min(min, getLastRealDay(mKey)),
      31
    );

    const monthStats = selectedMonths.map(mKey => {
      const [yearStr, monthStr] = mKey.split('-');
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      const maxDays = getDaysInMonth(year, monthNum);

      const isCurrentMonth = mKey === currentMonthKey;
      const activeDaysCount = getLastRealDay(mKey);

      let totalRevenue = 0;
      let totalUnits = 0;
      let comparableRevenue = 0;
      let peakDay: { day: number; val: number; units: number } | null = null;

      let phase1 = 0; // days 1-10
      let phase2 = 0; // days 11-20
      let phase3 = 0; // days 21-31

      for (let d = 1; d <= maxDays; d++) {
        const val = monthSalesMap[mKey]?.[d] || 0;
        const dayUnits = monthUnitsMap[mKey]?.[d] || 0;
        totalRevenue += val;
        totalUnits += dayUnits;
        if (d <= comparisonCutoffDay) comparableRevenue += val;

        if (val > 0 && (!peakDay || val > peakDay.val)) {
          peakDay = { day: d, val, units: dayUnits };
        }

        if (d <= 10) phase1 += val;
        else if (d <= 20) phase2 += val;
        else phase3 += val;
      }

      const dailyAvg = activeDaysCount > 0 ? totalRevenue / activeDaysCount : 0;
      const projectedTotal = isCurrentMonth && activeDaysCount < maxDays
        ? dailyAvg * maxDays
        : totalRevenue;

      // As duas primeiras fases arredondam e a última absorve o resto, para as
      // três somarem exatamente 100% (evita a barra com 1% de sobra/falta).
      const p1Pct = totalRevenue > 0 ? Math.round((phase1 / totalRevenue) * 100) : 0;
      const p2Pct = totalRevenue > 0 ? Math.round((phase2 / totalRevenue) * 100) : 0;
      const p3Pct = totalRevenue > 0 ? 100 - p1Pct - p2Pct : 0;

      return {
        mKey,
        label: formatShortMonthLabel(mKey),
        fullLabel: formatMonthLabel(mKey),
        totalRevenue,
        totalUnits,
        comparableRevenue,
        dailyAvg,
        projectedTotal,
        peakDay,
        activeDaysCount,
        maxDays,
        isCurrentMonth,
        phases: {
          p1: { val: phase1, pct: p1Pct },
          p2: { val: phase2, pct: p2Pct },
          p3: { val: phase3, pct: p3Pct },
        },
        color: monthColorMap.get(mKey) || PALETTE[0],
      };
    });

    const sorted = [...monthStats].sort((a, b) => b.comparableRevenue - a.comparableRevenue);
    const winner = sorted[0];
    const runnerUp = sorted[1];

    let winnerDiffPct = 0;
    let winnerDiffVal = 0;
    if (winner && runnerUp && runnerUp.comparableRevenue > 0) {
      winnerDiffVal = winner.comparableRevenue - runnerUp.comparableRevenue;
      winnerDiffPct = Math.round((winnerDiffVal / runnerUp.comparableRevenue) * 100);
    }

    const hasRevenue = monthStats.some(s => s.totalRevenue > 0);

    return {
      monthStats,
      winner,
      runnerUp,
      winnerDiffPct,
      winnerDiffVal,
      comparisonCutoffDay,
      /** O recorte comum é menor que os meses fechados → precisa dizer isso. */
      isPartialComparison: comparisonCutoffDay < 31 && selectedMonths.length > 1,
      hasRevenue,
    };
  }, [selectedMonths, monthSalesMap, monthUnitsMap, currentMonthKey, monthColorMap, getLastRealDay]);

  const segmentButtonClass = (active: boolean) =>
    `flex min-h-[44px] items-center gap-1.5 px-3 py-1.5 rounded-ios text-ios-caption font-semibold transition-all ${
      active
        ? 'bg-white dark:bg-surface-dark-100 text-brand-600 dark:text-brand-400 shadow-sm'
        : 'app-text-muted hover:app-text-primary'
    }`;

  const presetButtonClass =
    'min-h-[44px] px-3 py-1.5 text-ios-caption font-medium rounded-ios app-surface-soft hover:bg-surface-light-200 dark:hover:bg-surface-dark-300 transition-colors app-text-secondary whitespace-nowrap';

  return (
    <div className="ios-card p-4 md:p-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-ios bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm">
              <TrendingUp size={18} />
            </div>
            <h3 className="text-ios-title-3 font-bold app-text-primary">
              Comparativo de Faturamento Mensal
            </h3>
          </div>
          <p className="text-ios-caption app-text-muted mt-1 max-w-prose">
            Compare o ritmo de vendas entre meses, dia a dia.
          </p>
        </div>

        {/* Mode & Preset Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div
            role="group"
            aria-label="Modo de exibição do gráfico"
            className="inline-flex p-1 rounded-ios-lg bg-surface-light-100 dark:bg-surface-dark-200 border border-surface-light-200 dark:border-surface-dark-300"
          >
            <button
              type="button"
              onClick={() => setMode('cumulative')}
              aria-pressed={mode === 'cumulative'}
              className={segmentButtonClass(mode === 'cumulative')}
            >
              <TrendingUp size={14} />
              Acumulado
            </button>
            <button
              type="button"
              onClick={() => setMode('daily')}
              aria-pressed={mode === 'daily'}
              className={segmentButtonClass(mode === 'daily')}
            >
              <BarChart2 size={14} />
              Diário
            </button>
          </div>

          {/* Presets — roláveis no mobile em vez de escondidos (o atalho é o
              caminho feliz; esconder obriga a montar a seleção na mão). */}
          <div className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
            <button type="button" onClick={handlePresetCurrentVsLast} className={presetButtonClass}>
              Mês vs Anterior
            </button>
            <button type="button" onClick={handlePresetYearOverYear} className={presetButtonClass}>
              Ano vs Ano
            </button>
            <button type="button" onClick={handlePresetLast3Months} className={presetButtonClass}>
              Últimos 3
            </button>
          </div>
        </div>
      </div>

      {/* Filtros de escopo — recortam QUAIS vendas entram na comparação, ao
          contrário dos meses, que definem QUAIS períodos são comparados. */}
      {(stores.length > 1 || sellers.length > 0) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {stores.length > 1 && (
            <div className="min-w-0 flex-1 sm:max-w-[220px]">
              <label
                htmlFor="revenue-comparison-store"
                className="block text-ios-caption font-medium app-text-secondary mb-1.5"
              >
                Loja
              </label>
              <select
                id="revenue-comparison-store"
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="w-full ios-input bg-surface-50 dark:bg-surface-dark-200"
              >
                <option value={ALL}>Todas as lojas</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
          )}

          {sellers.length > 0 && (
            <div className="min-w-0 flex-1 sm:max-w-[220px]">
              <label
                htmlFor="revenue-comparison-seller"
                className="block text-ios-caption font-medium app-text-secondary mb-1.5"
              >
                Funcionário
              </label>
              <select
                id="revenue-comparison-seller"
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="w-full ios-input bg-surface-50 dark:bg-surface-dark-200"
              >
                <option value={ALL}>Todos os funcionários</option>
                {sellersForStore.map(seller => (
                  <option key={seller.id} value={seller.id}>{seller.name}</option>
                ))}
              </select>
            </div>
          )}

          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => { setStoreFilter(ALL); setSellerFilter(ALL); }}
              className="ios-button-secondary inline-flex min-h-[44px] w-full items-center justify-center gap-2 px-3 sm:w-auto"
            >
              <X size={15} aria-hidden="true" />
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Selected Months Pills & Selector — este é o legend do gráfico */}
      <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-surface-light-200 dark:border-surface-dark-300">
        <span className="text-ios-caption font-semibold uppercase tracking-wide app-text-muted mr-1">
          Meses ativos
        </span>

        <AnimatePresence initial={false}>
          {selectedMonths.map(mKey => {
            const colorInfo = monthColorMap.get(mKey) || PALETTE[0];
            return (
              <m.div
                key={mKey}
                layout={!reducedMotion}
                initial={reducedMotion ? false : { scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
                transition={iosSpring}
                className={`inline-flex items-center gap-1.5 py-1 pl-3 ${selectedMonths.length > 1 ? 'pr-1' : 'pr-3'} rounded-full text-ios-footnote font-semibold border ${colorInfo.border} ${colorInfo.lightBg} ${colorInfo.text}`}
              >
                <span className={`w-2 h-2 rounded-full ${colorInfo.bg}`} aria-hidden="true" />
                <span>{formatMonthLabel(mKey)}</span>
                {selectedMonths.length > 1 && (
                  <button
                    type="button"
                    onClick={() => toggleMonthSelection(mKey)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                    aria-label={`Remover ${formatMonthLabel(mKey)} da comparação`}
                  >
                    <X size={14} />
                  </button>
                )}
              </m.div>
            );
          })}
        </AnimatePresence>

        {/* Dropdown to add more months */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            data-dropdown-trigger
            onClick={() => setIsDropdownOpen(open => !open)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="listbox"
            className="inline-flex min-h-[44px] items-center gap-1 px-3 py-1 rounded-full text-ios-footnote font-medium border border-dashed border-surface-light-300 dark:border-surface-dark-300 hover:bg-surface-light-100 dark:hover:bg-surface-dark-200 transition-colors app-text-secondary"
          >
            <Plus size={14} />
            <span>Adicionar mês</span>
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsDropdownOpen(false)}
                  aria-hidden="true"
                />
                <m.div
                  role="listbox"
                  aria-label="Meses disponíveis para comparação"
                  aria-multiselectable="true"
                  initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  // Ancorado à direita no mobile: o gatilho fica colado na borda
                  // e um painel `left-0` de 256px vazava para fora da tela.
                  className="absolute right-0 sm:right-auto sm:left-0 mt-2 z-30 w-64 max-w-[calc(100vw-3rem)] max-h-60 overflow-y-auto rounded-ios-lg bg-elevation-3 shadow-ios26-lg border border-surface-light-200 dark:border-surface-dark-300 p-2 space-y-1"
                >
                  <p className="text-ios-caption font-semibold uppercase tracking-wide app-text-muted px-2 py-1">
                    {selectedMonths.length} de {MAX_SERIES} selecionados
                  </p>
                  {availableMonthKeys.map(mKey => {
                    const isSelected = selectedMonths.includes(mKey);
                    const isLastSelected = isSelected && selectedMonths.length === 1;
                    const isBlockedByLimit = !isSelected && atSeriesLimit;
                    const disabled = isLastSelected || isBlockedByLimit;

                    return (
                      <button
                        key={mKey}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={disabled}
                        onClick={() => toggleMonthSelection(mKey)}
                        title={
                          isLastSelected
                            ? 'Ao menos um mês precisa ficar selecionado'
                            : isBlockedByLimit
                              ? `Limite de ${MAX_SERIES} meses atingido — remova um para adicionar outro`
                              : undefined
                        }
                        className={`w-full min-h-[44px] text-left px-3 py-1.5 rounded-ios text-ios-subhead font-medium flex items-center justify-between transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          isSelected
                            ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-semibold'
                            : 'hover:bg-surface-light-100 dark:hover:bg-surface-dark-200 app-text-primary'
                        }`}
                      >
                        <span>{formatMonthLabel(mKey)}</span>
                        {isSelected && <Check size={16} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </m.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {!nerdStats.hasRevenue ? (
        /* Estado vazio desenhado — antes o gráfico mostrava linhas retas no zero
           e cards de R$ 0, o que parece dado carregando/quebrado. */
        <div className="flex flex-col items-center justify-center gap-3 rounded-ios-lg app-surface-soft border border-dashed border-surface-light-300 dark:border-surface-dark-300 px-6 py-12 text-center">
          <div className="rounded-full bg-surface-light-200 p-3 app-text-muted dark:bg-surface-dark-300">
            <CalendarX size={22} />
          </div>
          <div className="space-y-1">
            <p className="text-ios-headline font-semibold app-text-primary">
              {hasActiveFilter
                ? 'Nenhuma venda para este filtro'
                : 'Nenhuma venda nos meses selecionados'}
            </p>
            <p className="text-ios-caption app-text-muted max-w-prose">
              {hasActiveFilter
                ? 'Nenhuma venda combina os meses com a loja/funcionário escolhidos. Limpe os filtros ou escolha outros meses.'
                : 'Escolha outros meses em “Adicionar mês” ou use um atalho como “Últimos 3”.'}
            </p>
          </div>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => { setStoreFilter(ALL); setSellerFilter(ALL); }}
              className="ios-button-secondary inline-flex min-h-[44px] items-center justify-center gap-2 px-4"
            >
              <X size={15} aria-hidden="true" />
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Main Chart */}
          <div className="h-72 md:h-96 w-full pt-2">
            <StableResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke={chart.axisColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: 'Dia do mês',
                    position: 'insideBottom',
                    offset: -8,
                    fill: chart.axisColor,
                    fontSize: 12,
                  }}
                />
                <YAxis
                  stroke={chart.axisColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={formatAxisBRL}
                />
                <Tooltip
                  contentStyle={chart.tooltipContentStyle}
                  formatter={(value, name, item) => {
                    const row = (item?.payload ?? {}) as Record<string, number | null>;
                    const unitsForDay = row[`${String(name)}${UNITS_SUFFIX}`];
                    const money = formatBRL(Number(value) || 0);
                    return [
                      typeof unitsForDay === 'number'
                        ? `${money} · ${formatUnits(unitsForDay)}`
                        : money,
                      formatMonthLabel(String(name)),
                    ];
                  }}
                  labelFormatter={(label) => `Dia ${label}`}
                />
                {selectedMonths.map(mKey => {
                  const colorInfo = monthColorMap.get(mKey) || PALETTE[0];
                  return (
                    <Line
                      key={mKey}
                      type="monotone"
                      dataKey={mKey}
                      name={mKey}
                      stroke={colorInfo.main}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 6, strokeWidth: 2, fill: chart.isDark ? '#0b1220' : '#fff' }}
                      isAnimationActive={!reducedMotion}
                      animationDuration={600}
                    />
                  );
                })}
              </LineChart>
            </StableResponsiveContainer>
          </div>

          {/* Estatísticas Nerds de Comparação */}
          <div className="pt-4 border-t border-surface-light-200 dark:border-surface-dark-300 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" aria-hidden="true" />
              <h4 className="text-ios-subhead font-bold uppercase tracking-wide app-text-muted">
                Estatísticas Nerds de Comparação
              </h4>
            </div>

            {/* Highlight Winner Card if > 1 month */}
            {nerdStats.winner && nerdStats.runnerUp && nerdStats.winnerDiffVal > 0 && (
              <div className="p-4 rounded-ios-lg bg-gradient-to-r from-amber-500/10 via-brand-500/10 to-transparent border border-amber-500/20 flex items-start gap-3">
                <div className="p-2 rounded-full bg-amber-500 text-white shrink-0">
                  <Award size={20} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-ios-subhead font-bold app-text-primary">
                    {nerdStats.winner.fullLabel} é o Campeão de Faturamento
                  </p>
                  <p className="text-ios-caption app-text-secondary">
                    Superou {nerdStats.runnerUp.fullLabel} por{' '}
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      +{formatBRL(nerdStats.winnerDiffVal)} ({nerdStats.winnerDiffPct}%)
                    </span>.
                  </p>
                  {nerdStats.isPartialComparison && (
                    <p className="text-ios-caption app-text-muted mt-1">
                      Comparação justa: apenas os dias 1 a {nerdStats.comparisonCutoffDay} de cada mês.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Grid of stats for each month */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {nerdStats.monthStats.map(stat => (
                <div
                  key={stat.mKey}
                  className="p-4 rounded-ios-lg app-surface-soft border border-surface-light-200 dark:border-surface-dark-300 space-y-4"
                >
                  {/* Month Header Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`w-3 h-3 shrink-0 rounded-full ${stat.color.bg}`} aria-hidden="true" />
                      <h5 className="truncate text-ios-subhead font-bold app-text-primary">
                        {stat.fullLabel}
                      </h5>
                    </div>
                    {stat.isCurrentMonth && (
                      <span className="shrink-0 px-2 py-0.5 text-ios-caption font-bold uppercase tracking-wide rounded-full bg-brand-500 text-white">
                        Em curso
                      </span>
                    )}
                  </div>

                  {/* Total Revenue & Daily Avg */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-ios-caption font-medium app-text-muted">Total do mês</p>
                      <p className="text-ios-title-3 font-bold app-text-primary tabular-nums">
                        {formatBRL(stat.totalRevenue)}
                      </p>
                      <p className="text-ios-caption app-text-muted tabular-nums">
                        {formatUnits(stat.totalUnits)}
                      </p>
                    </div>
                    <div>
                      <p className="text-ios-caption font-medium app-text-muted">Média por dia</p>
                      <p className="text-ios-title-3 font-semibold app-text-secondary tabular-nums">
                        {formatBRL(Math.round(stat.dailyAvg))}
                      </p>
                      <p className="text-ios-caption app-text-muted tabular-nums">
                        {formatUnits(Math.round(stat.totalUnits / (stat.activeDaysCount || 1)))} / dia
                      </p>
                    </div>
                  </div>

                  {/* Peak Day (Dia de Ouro) */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-ios bg-surface-light-50 dark:bg-surface-dark-100 border border-surface-light-200 dark:border-surface-dark-300">
                    <span className="flex items-center gap-2 text-ios-caption font-semibold app-text-secondary">
                      <Flame size={15} className="text-amber-500" aria-hidden="true" />
                      Pico de vendas
                    </span>
                    <span className="text-ios-caption font-bold app-text-primary tabular-nums">
                      {stat.peakDay
                        ? `Dia ${stat.peakDay.day} · ${formatBRL(stat.peakDay.val)} · ${stat.peakDay.units} un.`
                        : 'Sem vendas'}
                    </span>
                  </div>

                  {/* Phases Distribution (Início 1-10, Meio 11-20, Fim 21-31) */}
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1 text-ios-caption font-semibold app-text-muted">
                      <PieChart size={12} aria-hidden="true" />
                      Fases do mês
                    </p>

                    {/* Progress bar representing 3 phases */}
                    <div
                      role="img"
                      aria-label={`Distribuição do faturamento: início ${stat.phases.p1.pct}%, meio ${stat.phases.p2.pct}%, fim ${stat.phases.p3.pct}%.`}
                      className="h-2 w-full rounded-full bg-surface-light-200 dark:bg-surface-dark-300 overflow-hidden flex"
                    >
                      <div style={{ width: `${stat.phases.p1.pct}%` }} className="h-full bg-brand-500" />
                      <div style={{ width: `${stat.phases.p2.pct}%` }} className="h-full bg-amber-500" />
                      <div style={{ width: `${stat.phases.p3.pct}%` }} className="h-full bg-emerald-500" />
                    </div>

                    {/* Legenda: o número é o dado, o intervalo de dias é o rótulo */}
                    <div className="flex justify-between gap-2 text-ios-caption tabular-nums">
                      <span className="text-brand-700 dark:text-brand-300">
                        <span className="font-bold">{stat.phases.p1.pct}%</span>{' '}
                        <span className="app-text-muted font-medium">dias 1–10</span>
                      </span>
                      <span className="text-amber-700 dark:text-amber-400">
                        <span className="font-bold">{stat.phases.p2.pct}%</span>{' '}
                        <span className="app-text-muted font-medium">11–20</span>
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-400">
                        <span className="font-bold">{stat.phases.p3.pct}%</span>{' '}
                        <span className="app-text-muted font-medium">21–31</span>
                      </span>
                    </div>
                  </div>

                  {/* Current Month Projection */}
                  {stat.isCurrentMonth && stat.activeDaysCount < stat.maxDays && (
                    <div className="pt-3 border-t border-surface-light-200 dark:border-surface-dark-300 flex items-center justify-between gap-2 text-ios-caption">
                      <span className="app-text-muted font-medium">
                        Projeção p/ fim do mês
                      </span>
                      <span className="font-bold text-brand-700 dark:text-brand-300 tabular-nums">
                        ~ {formatBRL(Math.round(stat.projectedTotal))}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MonthlyRevenueComparisonChart;
