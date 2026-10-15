import React from 'react';
import { Pencil, Plus } from 'lucide-react';
import IOSButton from '../../../components/ui/IOSButton';
import CareStatusBadge from '../../../components/care/CareStatusBadge';
import { conditionLabel } from '../../../lib/care/careLabels';
import type { CareBenefit, CareConditionRule, CareModelRule } from '../../../lib/care/careTypes';
import { formatCurrencyBRL, formatPercentBRL } from '../../../utils/inputMasks';
import { CareEmpty } from '../CareStates';

interface ModelRulesSectionProps {
  rules: CareModelRule[];
  conditionRules: CareConditionRule[];
  benefits: CareBenefit[];
  onEdit: (rule: CareModelRule | null) => void;
}

const percentText = (rule: CareModelRule, general?: CareConditionRule): string =>
  rule.recurring_percent_override != null
    ? `${formatPercentBRL(rule.recurring_percent_override)} (específico)`
    : general?.recurring_percent != null ? `${formatPercentBRL(general.recurring_percent)} (geral)` : 'sem percentual';

const deductibleText = (rule: CareModelRule, general?: CareConditionRule): string => {
  const modality = rule.deductible_modality ?? general?.deductible_modality;
  const value = rule.deductible_modality ? rule.deductible_value : general?.deductible_value;
  const origin = rule.deductible_modality ? 'específica' : 'geral';
  if (!modality || value == null) return 'sem franquia';
  return `${modality === 'PERCENTUAL' ? formatPercentBRL(value) : formatCurrencyBRL(value)} (${origin})`;
};

const RuleRow: React.FC<{ rule: CareModelRule; general?: CareConditionRule; benefits: CareBenefit[]; onEdit: () => void }> = ({ rule, general, benefits, onEdit }) => {
  const bonusNames = rule.bonuses.map((b) => benefits.find((x) => x.id === b.benefit_id)?.name).filter(Boolean);
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold app-text-primary">{rule.model} · {conditionLabel(rule.condition)}</p>
          {!rule.active && <CareStatusBadge tone="neutral" label="Inativa" />}
          <span className="text-xs app-text-muted">v{rule.version}</span>
        </div>
        <p className="text-xs app-text-muted">
          1ª {formatCurrencyBRL(rule.first_installment_amount)} + {rule.subsequent_installment_count}× {percentText(rule, general)} · franquia {deductibleText(rule, general)}
          {bonusNames.length > 0 ? ` · bônus: ${bonusNames.join(', ')}` : ''}
        </p>
      </div>
      <IOSButton variant="ghost" type="button" onClick={onEdit} aria-label={`Editar regra ${rule.model} ${conditionLabel(rule.condition)}`}>
        <span className="inline-flex items-center gap-2"><Pencil size={16} /> Editar</span>
      </IOSButton>
    </li>
  );
};

const ModelRulesSection: React.FC<ModelRulesSectionProps> = ({ rules, conditionRules, benefits, onEdit }) => (
  <section className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h3 className="text-base font-bold app-text-primary">Aparelhos (modelo + condição)</h3>
        <p className="text-sm app-text-muted">1ª parcela, bônus e quantidade de parcelas são por aparelho. Sem regra aqui, o aparelho não pode ser contratado.</p>
      </div>
      <IOSButton variant="primary" type="button" onClick={() => onEdit(null)}>
        <span className="inline-flex items-center gap-2"><Plus size={16} /> Configurar aparelho</span>
      </IOSButton>
    </div>
    {rules.length === 0 ? (
      <CareEmpty title="Nenhum aparelho configurado" message="Configure ao menos um modelo + condição para liberar contratações no PDV." />
    ) : (
      <ul className="ios-card overflow-hidden divide-y divide-gray-100 dark:divide-surface-dark-200">
        {rules.map((rule) => (
          <RuleRow key={rule.id} rule={rule} general={conditionRules.find((c) => c.condition === rule.condition)} benefits={benefits} onEdit={() => onEdit(rule)} />
        ))}
      </ul>
    )}
  </section>
);

export default ModelRulesSection;
