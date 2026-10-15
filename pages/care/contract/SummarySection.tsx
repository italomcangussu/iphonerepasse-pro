import React from 'react';
import type { CareContract } from '../../../lib/care/careTypes';
import { conditionLabel, deductibleModalityLabel, ruleSourceLabel } from '../../../lib/care/careLabels';
import { formatCurrencyBRL, formatDateTimeBRL, formatPercentBRL, formatPhone } from '../../../utils/inputMasks';
import { Field, Section } from './Section';

// Snapshot congelado na contratação: mostra valores e de onde cada regra veio.
const SummarySection: React.FC<{ contract: CareContract }> = ({ contract: c }) => (
  <Section title="Condições contratadas">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Field label="Cliente" value={c.customer_name} hint={`WhatsApp ${formatPhone(c.customer_phone)}${c.customer_cpf ? ` · CPF ${c.customer_cpf}` : ''}`} />
      <Field
        label="Aparelho"
        value={[c.device_model, c.device_capacity, c.device_color].filter(Boolean).join(' · ')}
        hint={`${conditionLabel(c.condition)}${c.device_imei ? ` · IMEI ${c.device_imei}` : ''}`}
      />
      <Field label="Preço efetivo de venda (base)" value={formatCurrencyBRL(c.sale_price)} />
      <Field label="1ª parcela" value={formatCurrencyBRL(c.first_amount)} hint={`Regra do modelo v${c.model_rule_version}`} />
      <Field
        label={`Parcelas seguintes: ${c.subsequent_count}×`}
        value={formatCurrencyBRL(c.recurring_amount)}
        hint={`${formatPercentBRL(c.recurring_percent)} · ${ruleSourceLabel(c.recurring_percent_source)}`}
      />
      <Field label="Total programado" value={formatCurrencyBRL(c.total_programmed)} hint={`1 inicial + ${c.subsequent_count} seguinte(s)`} />
      <Field
        label="Franquia por atendimento"
        value={formatCurrencyBRL(c.deductible_amount)}
        hint={`${deductibleModalityLabel(c.deductible_modality)}${c.deductible_modality === 'PERCENTUAL' ? ` ${formatPercentBRL(c.deductible_rate)}` : ''} · ${ruleSourceLabel(c.deductible_source)}`}
      />
      <Field label="Cláusulas" value={c.clauses_version} hint={`Regra da condição v${c.condition_rule_version}`} />
      <Field label="Assinado em" value={formatDateTimeBRL(c.signed_at)} />
      <Field label="Ativado em" value={formatDateTimeBRL(c.activated_at)} />
    </div>
    {c.cancel_reason && <p className="text-sm text-red-700 dark:text-red-300">Cancelado: {c.cancel_reason}</p>}
  </Section>
);

export default SummarySection;
