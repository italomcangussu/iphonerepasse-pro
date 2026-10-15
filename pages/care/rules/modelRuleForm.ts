import type { CareCondition, CareDeductibleModality, CareModelRule } from '../../../lib/care/careTypes';
import type { ModelRuleInput } from '../../../services/careApi';
import { fromField, toField } from '../CareFields';

// Estado do formulário "Configurar Repasse Care+" de um modelo + condição (texto cru dos campos).
export interface ModelRuleForm {
  id?: string;
  model: string;
  condition: CareCondition | '';
  active: boolean;
  firstAmount: string;
  subsequentCount: string;
  billingIntervalMonths: string;
  firstSubsequentDueMonths: string;
  percentMode: 'herdar' | 'especifico';
  percent: string;
  deductibleMode: 'herdar' | 'especifica';
  deductibleModality: CareDeductibleModality;
  deductibleValue: string;
  bonuses: Record<string, number>;
  servicesDescription: string;
  usageLimits: string;
  notes: string;
}

export type ModelRuleErrors = Partial<Record<keyof ModelRuleForm, string>>;

export const emptyModelRuleForm = (): ModelRuleForm => ({
  model: '',
  condition: '',
  active: true,
  firstAmount: '',
  subsequentCount: '',
  billingIntervalMonths: '',
  firstSubsequentDueMonths: '',
  percentMode: 'herdar',
  percent: '',
  deductibleMode: 'herdar',
  deductibleModality: 'PERCENTUAL',
  deductibleValue: '',
  bonuses: {},
  servicesDescription: '',
  usageLimits: '',
  notes: '',
});

export const formFromRule = (rule: CareModelRule): ModelRuleForm => ({
  id: rule.id,
  model: rule.model,
  condition: rule.condition,
  active: rule.active,
  firstAmount: toField(rule.first_installment_amount),
  subsequentCount: String(rule.subsequent_installment_count),
  billingIntervalMonths: String(rule.billing_interval_months),
  firstSubsequentDueMonths: String(rule.first_subsequent_due_months),
  percentMode: rule.recurring_percent_override === null ? 'herdar' : 'especifico',
  percent: toField(rule.recurring_percent_override, 4),
  deductibleMode: rule.deductible_modality ? 'especifica' : 'herdar',
  deductibleModality: rule.deductible_modality ?? 'PERCENTUAL',
  deductibleValue: toField(rule.deductible_value, 4),
  bonuses: Object.fromEntries(rule.bonuses.map((b) => [b.benefit_id, b.quantity])),
  servicesDescription: rule.services_description ?? '',
  usageLimits: rule.usage_limits ?? '',
  notes: rule.notes ?? '',
});

const integerIn = (value: string, min: number, max: number): boolean => {
  if (!/^\d+$/.test(value.trim())) return false;
  const n = Number(value);
  return n >= min && n <= max;
};

const percentError = (value: string): string | undefined => {
  const n = fromField(value);
  if (n === null) return 'Informe o percentual.';
  return n > 100 ? 'Máximo 100%.' : undefined;
};

const deductibleError = (form: ModelRuleForm): string | undefined => {
  if (form.deductibleMode === 'herdar') return undefined;
  if (form.deductibleModality === 'PERCENTUAL') return percentError(form.deductibleValue);
  return fromField(form.deductibleValue) === null ? 'Informe o valor da franquia.' : undefined;
};

// Nada é preenchido por padrão: regra sem um dado obrigatório não é salva (contexto de negócio, critério 10).
export function validateModelRule(form: ModelRuleForm): ModelRuleErrors {
  const errors: ModelRuleErrors = {
    model: form.model.trim() ? undefined : 'Escolha o modelo.',
    condition: form.condition ? undefined : 'Escolha Novo ou Seminovo.',
    firstAmount: fromField(form.firstAmount) === null ? 'Informe o valor da 1ª parcela.' : undefined,
    subsequentCount: integerIn(form.subsequentCount, 0, 120) ? undefined : 'Informe de 0 a 120 parcelas.',
    billingIntervalMonths: integerIn(form.billingIntervalMonths, 1, 12) ? undefined : 'De 1 a 12 meses.',
    firstSubsequentDueMonths: integerIn(form.firstSubsequentDueMonths, 0, 12) ? undefined : 'De 0 a 12 meses.',
    percent: form.percentMode === 'especifico' ? percentError(form.percent) : undefined,
    deductibleValue: deductibleError(form),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as ModelRuleErrors;
}

const nullIfBlank = (value: string): string | null => value.trim() || null;

export const toModelRuleInput = (form: ModelRuleForm): ModelRuleInput => ({
  id: form.id,
  model: form.model.trim(),
  condition: form.condition as CareCondition,
  active: form.active,
  first_installment_amount: fromField(form.firstAmount) ?? 0,
  subsequent_installment_count: Number(form.subsequentCount),
  billing_interval_months: Number(form.billingIntervalMonths),
  first_subsequent_due_months: Number(form.firstSubsequentDueMonths),
  recurring_percent_override: form.percentMode === 'especifico' ? fromField(form.percent) : null,
  deductible_modality: form.deductibleMode === 'especifica' ? form.deductibleModality : null,
  deductible_value: form.deductibleMode === 'especifica' ? fromField(form.deductibleValue) : null,
  services_description: nullIfBlank(form.servicesDescription),
  usage_limits: nullIfBlank(form.usageLimits),
  notes: nullIfBlank(form.notes),
  bonuses: Object.entries(form.bonuses).filter(([, qty]) => qty > 0).map(([benefit_id, quantity]) => ({ benefit_id, quantity })),
});
