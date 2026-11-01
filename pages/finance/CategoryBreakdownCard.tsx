import React, { useId, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, ChevronDown, X } from 'lucide-react';
import type { CategoryBreakdown, CategoryTotal } from '../../lib/finance/accountSummary';
import {
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_ALL_EXPENSE,
  CATEGORY_FILTER_ALL_INCOME
} from '../../lib/finance/accountSummary';
import { formatCurrencyBRL } from '../../utils/inputMasks';

const COLLAPSED_ROWS = 5;

type Side = 'IN' | 'OUT';

const SIDE_META: Record<Side, { title: string; groupFilter: string; amountClass: string; barClass: string; Icon: typeof ArrowUpCircle }> = {
  IN: {
    title: 'Receitas',
    groupFilter: CATEGORY_FILTER_ALL_INCOME,
    amountClass: 'text-green-700 dark:text-green-400',
    barClass: 'bg-green-500',
    Icon: ArrowUpCircle
  },
  OUT: {
    title: 'Despesas',
    groupFilter: CATEGORY_FILTER_ALL_EXPENSE,
    amountClass: 'text-red-600 dark:text-red-400',
    barClass: 'bg-red-500',
    Icon: ArrowDownCircle
  }
};

const formatShare = (share: number) => `${Math.round(share * 100)}%`;
const formatCount = (count: number) => (count === 1 ? '1 lançamento' : `${count} lançamentos`);

const CategoryRow: React.FC<{
  row: CategoryTotal;
  side: Side;
  isActive: boolean;
  onSelect: (category: string) => void;
}> = ({ row, side, isActive, onSelect }) => {
  const meta = SIDE_META[side];
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(row.category)}
        aria-pressed={isActive}
        className={`w-full min-h-11 text-left rounded-ios-lg px-3 py-2.5 transition-colors ${
          isActive
            ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-900/30'
            : 'hover:bg-gray-50 dark:hover:bg-surface-dark-200'
        }`}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-ios-subhead font-medium text-gray-900 dark:text-white">{row.category}</span>
          <span className={`shrink-0 whitespace-nowrap text-ios-subhead font-semibold tabular-nums ${meta.amountClass}`}>
            {formatCurrencyBRL(row.total)}
          </span>
        </span>
        <span className="mt-1.5 flex items-center gap-3">
          <span className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-surface-dark-200" aria-hidden="true">
            <span className={`block h-full rounded-full ${meta.barClass}`} style={{ width: `${Math.max(row.share * 100, 2)}%` }} />
          </span>
          <span className="shrink-0 text-ios-caption tabular-nums text-gray-500 dark:text-surface-dark-500">
            {formatShare(row.share)} · {formatCount(row.count)}
          </span>
        </span>
      </button>
    </li>
  );
};

const CategorySide: React.FC<{
  side: Side;
  rows: CategoryTotal[];
  total: number;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}> = ({ side, rows, total, activeFilter, onFilterChange }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = SIDE_META[side];
  const visibleRows = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
  const hiddenCount = rows.length - visibleRows.length;
  const isGroupActive = activeFilter === meta.groupFilter;

  return (
    <section aria-label={`${meta.title} por tipo`} className="min-w-0">
      <button
        type="button"
        onClick={() => onFilterChange(isGroupActive ? CATEGORY_FILTER_ALL : meta.groupFilter)}
        aria-pressed={isGroupActive}
        aria-label={`Todas as ${meta.title.toLowerCase()}: ${formatCurrencyBRL(total)}`}
        className={`w-full min-h-11 flex items-center justify-between gap-3 rounded-ios-lg px-3 py-2 text-left transition-colors ${
          isGroupActive ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-900/30' : 'hover:bg-gray-50 dark:hover:bg-surface-dark-200'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <meta.Icon size={18} className={`shrink-0 ${meta.amountClass}`} aria-hidden="true" />
          <span className="truncate text-ios-subhead font-semibold text-gray-900 dark:text-white">
            <span className="sm:hidden">{meta.title}</span>
            <span className="hidden sm:inline">Todas as {meta.title.toLowerCase()}</span>
          </span>
        </span>
        <span className={`shrink-0 whitespace-nowrap text-ios-headline font-bold tabular-nums ${meta.amountClass}`}>{formatCurrencyBRL(total)}</span>
      </button>

      {rows.length === 0 ? (
        <p className="px-3 py-3 text-ios-footnote text-gray-500 dark:text-surface-dark-500">
          Nenhuma {side === 'IN' ? 'receita' : 'despesa'} no período.
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {visibleRows.map((row) => (
            <CategoryRow
              key={row.category}
              row={row}
              side={side}
              isActive={activeFilter === row.category}
              onSelect={(category) => onFilterChange(activeFilter === category ? CATEGORY_FILTER_ALL : category)}
            />
          ))}
        </ul>
      )}

      {(hiddenCount > 0 || expanded) && rows.length > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 min-h-11 px-3 text-ios-subhead font-medium text-brand-600 dark:text-brand-400"
        >
          {expanded ? 'Mostrar menos' : `Ver mais ${hiddenCount} ${hiddenCount === 1 ? 'tipo' : 'tipos'}`}
        </button>
      )}
    </section>
  );
};

// Prévia com o cartão recolhido: quantos tipos há e qual pesa mais em cada lado.
// Os totais já estão no resumo logo acima, então aqui não se repetem.
const SidePreview: React.FC<{ side: Side; rows: CategoryTotal[] }> = ({ side, rows }) => {
  const meta = SIDE_META[side];
  const top = rows[0];
  const typeCount = rows.length === 1 ? '1 tipo' : `${rows.length} tipos`;
  return (
    <span className="flex min-w-0 items-start gap-1.5">
      <meta.Icon size={14} className={`mt-0.5 shrink-0 ${meta.amountClass}`} aria-hidden="true" />
      <span className="min-w-0 text-ios-footnote text-gray-600 dark:text-surface-dark-600">
        {top ? (
          <>
            {meta.title}: {typeCount} · maior <span className="font-semibold text-gray-900 dark:text-white">{top.category}</span>{' '}
            <span className="tabular-nums">{formatShare(top.share)}</span>
          </>
        ) : (
          `Nenhuma ${side === 'IN' ? 'receita' : 'despesa'} no período`
        )}
      </span>
    </span>
  );
};

// Cabeçalho que abre e fecha a lista; recolhido, mostra a prévia de cada lado.
const BreakdownToggle: React.FC<{
  open: boolean;
  panelId: string;
  onToggle: () => void;
  breakdown: CategoryBreakdown;
  showIncome: boolean;
  showExpense: boolean;
}> = ({ open, panelId, onToggle, breakdown, showIncome, showExpense }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    aria-controls={open ? panelId : undefined}
    className="min-h-11 min-w-0 flex-1 basis-64 rounded-ios-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-surface-dark-200"
  >
    <span className="flex items-center justify-between gap-3">
      <span className="text-ios-title-3 font-bold text-gray-900 dark:text-white">Por tipo</span>
      <span className="inline-flex shrink-0 items-center gap-1 text-ios-footnote font-medium text-brand-600 dark:text-brand-400">
        {open ? 'Recolher' : 'Ver tipos'}
        <ChevronDown size={18} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </span>
    </span>
    {open ? (
      <span className="mt-0.5 block text-ios-footnote text-gray-500 dark:text-surface-dark-500">Toque num tipo para filtrar o extrato.</span>
    ) : (
      <span className="mt-1.5 block space-y-1">
        {showIncome && <SidePreview side="IN" rows={breakdown.IN} />}
        {showExpense && <SidePreview side="OUT" rows={breakdown.OUT} />}
      </span>
    )}
  </button>
);

const ClearFilterChip: React.FC<{ label: string; onClear: () => void }> = ({ label, onClear }) => (
  <button
    type="button"
    onClick={onClear}
    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-ios-subhead font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
    aria-label={`Limpar filtro: ${label}`}
  >
    {label}
    <X size={16} aria-hidden="true" />
  </button>
);

interface CategoryBreakdownCardProps {
  breakdown: CategoryBreakdown;
  totalIn: number;
  totalOut: number;
  activeFilter: string;
  activeFilterLabel: string | null;
  onFilterChange: (filter: string) => void;
}

// Receitas e despesas do período agrupadas por tipo, com o total de cada lado.
// Começa recolhido (só os totais); tocar no cabeçalho abre a lista por tipo.
// Tocar num tipo (ou no total do lado) filtra o extrato logo abaixo; tocar de novo limpa.
const CategoryBreakdownCard: React.FC<CategoryBreakdownCardProps> = ({
  breakdown,
  totalIn,
  totalOut,
  activeFilter,
  activeFilterLabel,
  onFilterChange
}) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const showIncome = activeFilter !== CATEGORY_FILTER_ALL_EXPENSE;
  const showExpense = activeFilter !== CATEGORY_FILTER_ALL_INCOME;

  return (
    <div className="ios-card px-1 py-3 md:p-5" data-testid="category-breakdown">
      <div className="flex flex-wrap items-start justify-between gap-2 px-1">
        <BreakdownToggle
          open={open}
          panelId={panelId}
          onToggle={() => setOpen((value) => !value)}
          breakdown={breakdown}
          showIncome={showIncome}
          showExpense={showExpense}
        />
        {activeFilterLabel && <ClearFilterChip label={activeFilterLabel} onClear={() => onFilterChange(CATEGORY_FILTER_ALL)} />}
      </div>
      {open && (
        <div id={panelId} className={`mt-2 grid gap-4 ${showIncome && showExpense ? 'md:grid-cols-2 md:gap-6' : ''}`}>
          {showIncome && (
            <CategorySide side="IN" rows={breakdown.IN} total={totalIn} activeFilter={activeFilter} onFilterChange={onFilterChange} />
          )}
          {showExpense && (
            <CategorySide side="OUT" rows={breakdown.OUT} total={totalOut} activeFilter={activeFilter} onFilterChange={onFilterChange} />
          )}
        </div>
      )}
    </div>
  );
};

export default CategoryBreakdownCard;
