import React from 'react';
import { CalendarDays } from 'lucide-react';
import { CATEGORY_FILTER_ALL, CATEGORY_FILTER_ALL_EXPENSE, CATEGORY_FILTER_ALL_INCOME } from '../../lib/finance/accountSummary';
import type { DatePreset } from './periodRange';

interface PeriodFilterCardProps {
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  customDateFrom: string;
  onCustomDateFromChange: (value: string) => void;
  customDateTo: string;
  onCustomDateToChange: (value: string) => void;
  // Só as contas reais (Conta Bancária e Cofre) têm filtro por tipo de lançamento.
  categoryFilter: { value: string; onChange: (value: string) => void; options: Record<'IN' | 'OUT', string[]> } | null;
}

const PeriodFilterCard: React.FC<PeriodFilterCardProps> = ({
  datePreset,
  onDatePresetChange,
  customDateFrom,
  onCustomDateFromChange,
  customDateTo,
  onCustomDateToChange,
  categoryFilter
}) => (
  <div className="ios-card p-4 space-y-3">
    {/* `items-start` + offset: com os filtros quebrando em 2 linhas, o
        ícone centralizado ficava órfão entre elas. */}
    <div className="flex items-start gap-3">
      <CalendarDays size={18} className="text-gray-400 dark:text-surface-dark-500 shrink-0 mt-3" />
      {/*
        Era `overflow-x-auto scrollbar-hide`: em tablet 37px de filtros
        ficavam escondidos ("Período" aparecia cortado) sem nenhuma pista
        de que havia mais. Com wrap nada fica oculto — em telas largas
        continua numa linha só.
      */}
      <div className="flex flex-wrap gap-2 flex-1">
        {(
          [
            { id: 'all', label: 'Todos' },
            { id: 'today', label: 'Hoje' },
            { id: 'yesterday', label: 'Ontem' },
            { id: 'current_month', label: 'Mês Atual' },
            { id: 'last_month', label: 'Último Mês' },
            { id: 'year', label: 'Este Ano' },
            { id: 'custom', label: 'Período' },
          ] as { id: DatePreset; label: string }[]
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onDatePresetChange(id)}
            className={`shrink-0 inline-flex items-center justify-center hit-target-44 px-4 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              datePreset === id
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-surface-dark-200 text-gray-600 dark:text-surface-dark-600 hover:bg-gray-200 dark:hover:bg-surface-dark-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
    {categoryFilter && (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:pl-7">
        <label htmlFor="transaction-category-filter" className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-surface-dark-500">
          Tipo de aporte/despesa
        </label>
        <select
          id="transaction-category-filter"
          aria-label="Tipo de aporte/despesa"
          className="ios-input py-2 text-base md:text-sm sm:w-auto min-w-[220px]"
          value={categoryFilter.value}
          onChange={(e) => categoryFilter.onChange(e.target.value)}
        >
          <option value={CATEGORY_FILTER_ALL}>Todos os tipos</option>
          <option value={CATEGORY_FILTER_ALL_INCOME}>Todas as receitas</option>
          <option value={CATEGORY_FILTER_ALL_EXPENSE}>Todas as despesas</option>
          {categoryFilter.options.IN.length > 0 && (
            <optgroup label="Aportes / Receitas">
              {categoryFilter.options.IN.map((category) => (
                <option key={`in-${category}`} value={category}>
                  {category}
                </option>
              ))}
            </optgroup>
          )}
          {categoryFilter.options.OUT.length > 0 && (
            <optgroup label="Despesas / Pagamentos">
              {categoryFilter.options.OUT.map((category) => (
                <option key={`out-${category}`} value={category}>
                  {category}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
    )}
    {datePreset === 'custom' && (
      <div className="flex flex-wrap gap-3 items-center pl-7">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-surface-dark-500 shrink-0">De</span>
          <input
            type="date"
            aria-label="Data inicial"
            className="ios-input py-1.5 text-base md:text-sm"
            value={customDateFrom}
            onChange={(e) => onCustomDateFromChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-surface-dark-500 shrink-0">Até</span>
          <input
            type="date"
            aria-label="Data final"
            className="ios-input py-1.5 text-base md:text-sm"
            value={customDateTo}
            onChange={(e) => onCustomDateToChange(e.target.value)}
          />
        </div>
      </div>
    )}
  </div>
);

export default PeriodFilterCard;
