import React from 'react';
import { FileText } from 'lucide-react';
import { formatCurrencyBRL } from '../../../utils/inputMasks';
import { longestInstallment, type QuoteDraftIssue, type QuotePresentation, type QuoteTotals } from './quoteModel';

interface QuoteSummaryCardProps {
  totals: QuoteTotals;
  presentation: QuotePresentation;
  itemNames: string[];
  issues: QuoteDraftIssue[];
  onSave: () => void;
}

function SumSummary({ totals }: { totals: QuoteTotals }) {
  const longest = longestInstallment(totals.payment);
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] app-text-muted">Total à vista</p>
      <p className="mt-1 text-[34px] font-bold leading-tight tracking-tight tabular-nums app-text-primary">{formatCurrencyBRL(totals.total)}</p>
      {longest && (
        <p className="text-sm app-text-secondary">
          ou até <span className="font-semibold text-brand-600 dark:text-brand-300">{longest.installments}x de {formatCurrencyBRL(longest.installmentAmount)}</span>
        </p>
      )}
      {totals.discount > 0 && <p className="mt-2 text-sm text-green-700 dark:text-green-400">Desconto de {formatCurrencyBRL(totals.discount)} aplicado</p>}
      <InstallmentList totals={totals} />
    </>
  );
}

function InstallmentList({ totals }: { totals: QuoteTotals }) {
  const { debit, installments } = totals.payment;
  if (!debit && installments.length === 0) return null;
  return (
    <dl className="mt-4 max-h-64 overflow-y-auto divide-y app-table-divider rounded-2xl app-surface-soft px-3">
      {debit && (
        <div className="flex justify-between py-2 text-sm"><dt className="app-text-secondary">Débito</dt><dd className="font-semibold tabular-nums app-text-primary">{formatCurrencyBRL(debit.customerAmount)}</dd></div>
      )}
      {installments.map((row) => (
        <div key={row.installments} className="flex justify-between gap-3 py-2 text-sm">
          <dt className="app-text-secondary tabular-nums">{row.installments}x de {formatCurrencyBRL(row.installmentAmount)}</dt>
          <dd className="tabular-nums app-text-muted">{formatCurrencyBRL(row.customerAmount)}</dd>
        </div>
      ))}
    </dl>
  );
}

function CompareSummary({ totals, itemNames }: { totals: QuoteTotals; itemNames: string[] }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] app-text-muted">{itemNames.length} opções</p>
      <ul className="mt-2 space-y-2">
        {totals.itemPayments.map((payment, index) => {
          const longest = longestInstallment(payment);
          return (
            <li key={itemNames[index] + index} className="rounded-2xl app-surface-soft p-3">
              <p className="truncate text-sm font-semibold app-text-primary">{itemNames[index] || 'Produto sem nome'}</p>
              <p className="text-lg font-bold tabular-nums app-text-primary">{formatCurrencyBRL(payment.cash)}</p>
              {longest && <p className="text-xs app-text-muted">ou até {longest.installments}x de {formatCurrencyBRL(longest.installmentAmount)}</p>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function QuoteSummaryCard({ totals, presentation, itemNames, issues, onSave }: QuoteSummaryCardProps) {
  const blocked = issues.length > 0;
  return (
    <section aria-labelledby="quote-summary-title" className="ios-card p-4 md:p-5">
      <h2 id="quote-summary-title" className="sr-only">Resumo do orçamento</h2>
      {presentation === 'compare' ? <CompareSummary totals={totals} itemNames={itemNames} /> : <SumSummary totals={totals} />}
      <button type="button" onClick={onSave} aria-describedby={blocked ? 'quote-save-reason' : undefined}
        className={`ios-button-primary mt-5 inline-flex w-full items-center justify-center gap-2 ${blocked ? 'opacity-60' : ''}`}>
        <FileText size={18} aria-hidden="true" />
        Salvar orçamento
      </button>
      {blocked && <p id="quote-save-reason" className="mt-2 text-center text-xs app-text-muted">{issues[0].message}</p>}
    </section>
  );
}
