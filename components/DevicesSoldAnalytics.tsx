import React, { useState, useMemo } from 'react';
import { useData } from '../services/dataContext';
import { Condition } from '../types';
import { CalendarDays, Filter, Smartphone, X } from 'lucide-react';
import { m, useReducedMotion } from 'framer-motion';

type PeriodPreset = '7d' | '30d' | '90d' | 'all' | 'custom';

const parseDateInput = (value: string, boundary: 'start' | 'end'): Date | null => {
  if (!value) return null;
  const suffix = boundary === 'start' ? 'T00:00:00' : 'T23:59:59.999';
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getPresetStartDate = (period: PeriodPreset): Date | null => {
  const now = new Date();
  if (period === '7d') {
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - 7);
    return cutoff;
  }
  if (period === '30d') {
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - 30);
    return cutoff;
  }
  if (period === '90d') {
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - 90);
    return cutoff;
  }
  return null;
};

const DevicesSoldAnalytics: React.FC = () => {
  const { sales } = useData();
  const reducedMotion = useReducedMotion();
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const uniqueModels = useMemo(() => {
    const models = new Set<string>();
    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (item.model) models.add(item.model);
      });
    });
    return Array.from(models).sort();
  }, [sales]);

  const dateRange = useMemo(() => {
    const customStart = parseDateInput(startDate, 'start');
    const customEnd = parseDateInput(endDate, 'end');
    const presetStart = selectedPeriod === 'custom' ? null : getPresetStartDate(selectedPeriod);

    return {
      from: customStart || presetStart,
      to: customEnd,
      isInvalid: Boolean(customStart && customEnd && customStart > customEnd),
      hasCustomRange: Boolean(startDate || endDate),
    };
  }, [endDate, selectedPeriod, startDate]);

  const filteredCount = useMemo(() => {
    if (dateRange.isInvalid) return 0;

    let count = 0;
    sales.forEach(sale => {
      const saleDate = new Date(sale.date);
      if (Number.isNaN(saleDate.getTime())) return;
      if (dateRange.from && saleDate < dateRange.from) return;
      if (dateRange.to && saleDate > dateRange.to) return;

      sale.items.forEach(item => {
        const matchModel = selectedModel === 'all' || item.model === selectedModel;
        const matchCondition = selectedCondition === 'all' || item.condition === selectedCondition;
        if (matchModel && matchCondition) {
          count++;
        }
      });
    });
    return count;
  }, [dateRange, sales, selectedModel, selectedCondition]);

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    if (field === 'start') setStartDate(value);
    if (field === 'end') setEndDate(value);
    setSelectedPeriod(value || (field === 'start' ? endDate : startDate) ? 'custom' : '30d');
  };

  const resetFilters = () => {
    setSelectedPeriod('30d');
    setStartDate('');
    setEndDate('');
    setSelectedCondition('all');
    setSelectedModel('all');
  };

  return (
    <div className="ios-card p-4 md:p-6 min-w-0">
      <div className="mb-4 flex flex-col gap-3 md:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Smartphone size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-ios-title-3 font-bold app-text-primary">Aparelhos Vendidos</h3>
            <p className="mt-0.5 text-ios-caption app-text-muted">Filtre por período, condição e modelo.</p>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-ios-caption font-semibold text-brand-700 dark:bg-brand-900/20 dark:text-brand-300 sm:inline-flex">
          <Filter size={13} />
          Filtros ativos
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(180px,1.2fr)_auto] xl:items-end">
        <div className="flex-1 min-w-0">
          <label htmlFor="devices-sold-period" className="block text-ios-caption app-text-secondary font-medium mb-1.5">
            Período
          </label>
          <select
            id="devices-sold-period"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as PeriodPreset)}
            className="w-full ios-input bg-surface-50 dark:bg-surface-dark-200"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
            <option value="all">Todo o período</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        <div className="flex-1 min-w-0">
          <label htmlFor="devices-sold-start-date" className="block text-ios-caption app-text-secondary font-medium mb-1.5">
            Data inicial
          </label>
          <div className="relative">
            <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 app-text-muted" />
            <input
              id="devices-sold-start-date"
              type="date"
              value={startDate}
              onChange={(e) => handleDateChange('start', e.target.value)}
              max={endDate || undefined}
              className="w-full ios-input bg-surface-50 pl-9 dark:bg-surface-dark-200"
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <label htmlFor="devices-sold-end-date" className="block text-ios-caption app-text-secondary font-medium mb-1.5">
            Data final
          </label>
          <div className="relative">
            <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 app-text-muted" />
            <input
              id="devices-sold-end-date"
              type="date"
              value={endDate}
              onChange={(e) => handleDateChange('end', e.target.value)}
              min={startDate || undefined}
              className="w-full ios-input bg-surface-50 pl-9 dark:bg-surface-dark-200"
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <label htmlFor="devices-sold-condition" className="block text-ios-caption app-text-secondary font-medium mb-1.5">
            Condição
          </label>
          <select
            id="devices-sold-condition"
            value={selectedCondition}
            onChange={(e) => setSelectedCondition(e.target.value)}
            className="w-full ios-input bg-surface-50 dark:bg-surface-dark-200"
          >
            <option value="all">Todas</option>
            <option value={Condition.NEW}>Novos</option>
            <option value={Condition.USED}>Seminovos</option>
          </select>
        </div>

        <div className="flex-1 min-w-0">
          <label htmlFor="devices-sold-model" className="block text-ios-caption app-text-secondary font-medium mb-1.5">
            Modelo
          </label>
          <select
            id="devices-sold-model"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full ios-input bg-surface-50 dark:bg-surface-dark-200"
          >
            <option value="all">Todos os modelos</option>
            {uniqueModels.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={resetFilters}
          className="ios-button-secondary inline-flex w-full items-center justify-center gap-2 px-3 sm:col-span-2 xl:col-span-1 xl:w-auto"
        >
          <X size={15} />
          Limpar
        </button>
      </div>

      {dateRange.isInvalid ? (
        <p className="-mt-3 mb-4 rounded-ios bg-red-50 px-3 py-2 text-ios-caption font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">
          A data inicial precisa ser anterior à data final.
        </p>
      ) : null}

      <m.div
        key={filteredCount}
        initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-brand-50 dark:bg-brand-900/20 rounded-ios-lg p-6 text-center border border-brand-100 dark:border-brand-800/50"
      >
        <span className="block text-5xl font-extrabold text-brand-600 dark:text-brand-400 tabular-nums tracking-tight">
          {filteredCount}
        </span>
        <span className="block mt-2 text-ios-subhead font-medium text-brand-700 dark:text-brand-300">
          {filteredCount === 1 ? 'Aparelho vendido' : 'Aparelhos vendidos'}
        </span>
      </m.div>
    </div>
  );
};

export default DevicesSoldAnalytics;
