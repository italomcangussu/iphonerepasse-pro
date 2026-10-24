import React from 'react';
import { CARD_INSTALLMENTS_MAX } from '../../../utils/cardFees';
import { Segmented } from './QuoteControls';
import {
  normalizeInstallments,
  QUOTE_INSTALLMENT_PRESETS,
  type QuoteCardBrand,
  type QuotePaymentPlan,
  type QuotePresentation,
} from './quoteModel';

interface QuotePaymentCardProps {
  plan: QuotePaymentPlan;
  presentation: QuotePresentation;
  itemCount: number;
  onPlanChange: (plan: QuotePaymentPlan) => void;
  onPresentationChange: (presentation: QuotePresentation) => void;
}

const ALL_INSTALLMENTS = Array.from({ length: CARD_INSTALLMENTS_MAX }, (_, index) => index + 1);

const PRESETS: { label: string; values: readonly number[] }[] = [
  { label: 'Principais', values: QUOTE_INSTALLMENT_PRESETS.principais },
  { label: 'Até 12x', values: QUOTE_INSTALLMENT_PRESETS.ate12 },
  { label: 'Todas', values: QUOTE_INSTALLMENT_PRESETS.todas },
];

const sameSet = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, index) => value === b[index]);

export function QuotePaymentCard({ plan, presentation, itemCount, onPlanChange, onPresentationChange }: QuotePaymentCardProps) {
  const update = (patch: Partial<QuotePaymentPlan>) => onPlanChange({ ...plan, ...patch });
  const toggleInstallment = (count: number) => {
    const next = plan.installments.includes(count) ? plan.installments.filter((value) => value !== count) : [...plan.installments, count];
    update({ installments: normalizeInstallments(next) });
  };

  return (
    <section aria-labelledby="quote-payment-title" className="ios-card p-4 md:p-5 space-y-5">
      <h2 id="quote-payment-title" className="text-[17px] font-bold app-text-primary">Pagamento</h2>

      {itemCount > 1 && (
        <div>
          <span className="ios-label">Como mostrar os produtos</span>
          <Segmented<QuotePresentation>
            label="Como mostrar os produtos"
            value={presentation}
            onChange={onPresentationChange}
            options={[{ value: 'sum', label: 'Compra conjunta' }, { value: 'compare', label: 'Opções para comparar' }]}
          />
          <p className="mt-1.5 text-xs app-text-muted">
            {presentation === 'sum' ? 'Um total para tudo, com desconto opcional.' : 'Cada produto com seu preço e parcelas, para o cliente escolher.'}
          </p>
        </div>
      )}

      <div>
        <span className="ios-label">Condições</span>
        <Segmented<'cash' | 'card'>
          label="Condições de pagamento"
          value={plan.cashOnly ? 'cash' : 'card'}
          onChange={(value) => update({ cashOnly: value === 'cash' })}
          options={[{ value: 'cash', label: 'Só à vista' }, { value: 'card', label: 'À vista + cartão' }]}
        />
      </div>

      {!plan.cashOnly && (
        <>
          <div>
            <span className="ios-label">Bandeira do cartão</span>
            <Segmented<QuoteCardBrand>
              label="Bandeira do cartão"
              value={plan.cardBrand}
              onChange={(cardBrand) => update({ cardBrand })}
              options={[{ value: 'visa_master', label: 'Visa / Master' }, { value: 'outras', label: 'Elo, Amex e outras' }]}
            />
          </div>

          <fieldset>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="ios-label mb-0">Parcelas no orçamento</legend>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => (
                  <button key={preset.label} type="button" onClick={() => update({ installments: [...preset.values] })}
                    aria-pressed={sameSet(plan.installments, preset.values)}
                    className="min-h-9 rounded-full px-3 text-xs font-semibold app-surface-soft app-text-secondary aria-pressed:bg-brand-600 aria-pressed:text-white">
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-9">
              {ALL_INSTALLMENTS.map((count) => {
                const active = plan.installments.includes(count);
                return (
                  <button key={count} type="button" aria-pressed={active} aria-label={`${count} vezes`} onClick={() => toggleInstallment(count)}
                    className={`min-h-11 rounded-xl text-sm font-semibold tabular-nums transition-colors ${active ? 'bg-brand-600 text-white shadow-ios-sm' : 'app-surface-soft app-text-secondary'}`}>
                    {count}x
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs app-text-muted">
              {plan.installments.length === 0 ? 'Nenhuma parcela marcada: o orçamento mostra só o valor à vista.' : 'Toque para incluir ou tirar. As taxas vêm de Configurações › Taxas de cartão.'}
            </p>
          </fieldset>

          <label className="flex min-h-11 items-center gap-3 text-sm app-text-primary">
            <input type="checkbox" checked={plan.includeDebit} onChange={(event) => update({ includeDebit: event.target.checked })} className="h-5 w-5 rounded accent-brand-600" />
            Incluir débito
          </label>
        </>
      )}
    </section>
  );
}
