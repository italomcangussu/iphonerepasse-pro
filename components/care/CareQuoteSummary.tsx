import React from 'react';
import { AlertTriangle, Gift } from 'lucide-react';
import type { CareQuote } from '../../lib/care/careTypes';
import { conditionLabel, deductibleModalityLabel, ruleSourceLabel } from '../../lib/care/careLabels';
import { formatCurrencyBRL, formatPercentBRL } from '../../utils/inputMasks';

const Row: React.FC<{ label: string; value: React.ReactNode; hint?: string; strong?: boolean }> = ({ label, value, hint, strong }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <div className="min-w-0">
      <p className="text-sm app-text-secondary">{label}</p>
      {hint && <p className="text-xs app-text-muted mt-0.5">{hint}</p>}
    </div>
    <p className={`text-right tabular-nums ${strong ? 'text-base font-bold app-text-primary' : 'text-sm font-semibold app-text-primary'}`}>{value}</p>
  </div>
);

export const CarePendencies: React.FC<{ items: string[] }> = ({ items }) => (
  <div role="alert" className="rounded-ios-lg border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
    <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
      <AlertTriangle size={16} aria-hidden /> Não dá para contratar ainda
    </p>
    <ul className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-100 list-disc pl-5">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  </div>
);

const subsequentHint = (quote: CareQuote): string =>
  `${formatPercentBRL(quote.recurringPercent ?? 0)} do preço efetivo · ${ruleSourceLabel(quote.recurringPercentSource)}`;

const deductibleHint = (quote: CareQuote): string =>
  quote.deductibleModality === 'PERCENTUAL'
    ? `${formatPercentBRL(quote.deductibleRate ?? 0)} de ${formatCurrencyBRL(quote.deductibleBase)} · ${ruleSourceLabel(quote.deductibleSource)}`
    : `${deductibleModalityLabel(quote.deductibleModality)} · ${ruleSourceLabel(quote.deductibleSource)}`;

// Proposta separada por item, como o contexto de negócio exige: 1ª parcela, bônus, seguintes, total, franquia.
const CareQuoteSummary: React.FC<{ quote: CareQuote }> = ({ quote }) => {
  const count = quote.subsequentCount ?? 0;
  return (
    <div className="space-y-3">
      <div className="rounded-ios-lg app-surface-soft px-4 py-1 divide-y divide-gray-200/70 dark:divide-surface-dark-200">
        <Row
          label="Preço efetivo do aparelho"
          hint={`Base de cálculo · ${conditionLabel(quote.condition)}${quote.saleDiscountShare ? ` · desconto rateado ${formatCurrencyBRL(quote.saleDiscountShare)}` : ''}`}
          value={formatCurrencyBRL(quote.salePrice)}
        />
        <Row label="1ª parcela (inicial)" hint="Valor fixo da regra do aparelho" value={formatCurrencyBRL(quote.firstAmount)} />
        <Row
          label={`Parcelas seguintes: ${count}×`}
          hint={count > 0 ? subsequentHint(quote) : 'Sem parcelas seguintes'}
          value={count > 0 ? formatCurrencyBRL(quote.recurringAmount) : '—'}
        />
        <Row
          label="Total programado"
          hint={`1 inicial + ${count} seguinte(s) = ${1 + count} cobrança(s)`}
          value={formatCurrencyBRL(quote.totalProgrammed)}
          strong
        />
        <Row label="Franquia por atendimento" hint={deductibleHint(quote)} value={formatCurrencyBRL(quote.deductibleAmount)} />
      </div>
      <div className="flex items-start gap-2 text-sm app-text-secondary">
        <Gift size={16} className="mt-0.5 shrink-0 text-accent-500" aria-hidden />
        {quote.bonuses.length > 0 ? (
          <p>
            <span className="font-semibold app-text-primary">Bônus da 1ª parcela: </span>
            {quote.bonuses.map((b) => `${b.quantity}× ${b.name}`).join(', ')}
            <span className="app-text-muted"> — liberado após a 1ª parcela paga.</span>
          </p>
        ) : (
          <p>Sem bônus de adesão nesta regra.</p>
        )}
      </div>
    </div>
  );
};

export default CareQuoteSummary;
