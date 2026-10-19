import React, { useId, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import IOSButton from '../../../components/ui/IOSButton';
import { useToast } from '../../../components/ui/ToastProvider';
import { saveModelRule } from '../../../services/careApi';
import { conditionLabel } from '../../../lib/care/careLabels';
import type { CareBenefit, CareConditionRule, CareModelRule } from '../../../lib/care/careTypes';
import { formatCurrencyBRL, formatPercentBRL } from '../../../utils/inputMasks';
import { DecimalField, TextField } from '../CareFields';
import { emptyModelRuleForm, formFromRule, type ModelRuleErrors, type ModelRuleForm, toModelRuleInput, validateModelRule } from './modelRuleForm';

interface ModelRuleModalProps {
  rule: CareModelRule | null;
  conditionRules: CareConditionRule[];
  benefits: CareBenefit[];
  models: string[];
  onClose: () => void;
  onSaved: () => void;
}

type SetField = <K extends keyof ModelRuleForm>(key: K, value: ModelRuleForm[K]) => void;
interface PartProps {
  form: ModelRuleForm;
  set: SetField;
  errors: ModelRuleErrors;
}

const Choice: React.FC<{ name: string; checked: boolean; onChange: () => void; label: string; hint?: string }> = ({ name, checked, onChange, label, hint }) => (
  <label className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-ios-lg border px-3 py-2 ${checked ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/10' : 'app-border'}`}>
    <input type="radio" name={name} className="mt-1 accent-brand-500" checked={checked} onChange={onChange} />
    <span>
      <span className="block text-sm font-semibold app-text-primary">{label}</span>
      {hint && <span className="block text-xs app-text-muted">{hint}</span>}
    </span>
  </label>
);

const DevicePart: React.FC<PartProps & { models: string[] }> = ({ form, set, errors, models }) => {
  const listId = useId();
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold app-text-primary">Aparelho</legend>
      <div className="space-y-1">
        <label htmlFor={`${listId}-model`} className="block text-xs font-semibold app-text-secondary">Modelo</label>
        <input id={`${listId}-model`} list={listId} className={`ios-input w-full ${errors.model ? 'border-red-500' : ''}`} value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Ex.: iPhone 13" aria-invalid={!!errors.model} />
        <datalist id={listId}>{models.map((m) => <option key={m} value={m} />)}</datalist>
        {errors.model && <p className="text-xs text-red-600 dark:text-red-400">{errors.model}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Condição">
        {(['NOVO', 'SEMINOVO'] as const).map((c) => (
          <Choice key={c} name="care-condition" checked={form.condition === c} onChange={() => set('condition', c)} label={conditionLabel(c)} />
        ))}
      </div>
      {errors.condition && <p className="text-xs text-red-600 dark:text-red-400">{errors.condition}</p>}
      <label className="flex min-h-[44px] items-center gap-3 text-sm app-text-primary">
        <input type="checkbox" className="h-5 w-5 accent-brand-500" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
        Ativo para novas contratações <span className="app-text-muted">(desativar não afeta contratos existentes)</span>
      </label>
    </fieldset>
  );
};

const BillingPart: React.FC<PartProps> = ({ form, set, errors }) => (
  <fieldset className="space-y-3">
    <legend className="text-sm font-bold app-text-primary">Cobrança</legend>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <DecimalField label="Valor da 1ª parcela" prefix="R$" value={form.firstAmount} onChange={(v) => set('firstAmount', v)} error={errors.firstAmount} hint="Valor fixo; não há outra taxa de adesão." />
      <DecimalField
        label="Parcelas seguintes (além da 1ª)"
        maxDecimals={0}
        value={form.subsequentCount}
        onChange={(v) => set('subsequentCount', v)}
        error={errors.subsequentCount}
        hint={form.subsequentCount ? `Total de cobranças: 1 + ${form.subsequentCount} = ${1 + Number(form.subsequentCount)}` : 'Ex.: 12 → 1 inicial + 12 seguintes'}
      />
      <DecimalField label="Intervalo entre parcelas" suffix="mês(es)" maxDecimals={0} value={form.billingIntervalMonths} onChange={(v) => set('billingIntervalMonths', v)} error={errors.billingIntervalMonths} />
      <DecimalField label="1ª parcela seguinte vence após a ativação" suffix="mês(es)" maxDecimals={0} value={form.firstSubsequentDueMonths} onChange={(v) => set('firstSubsequentDueMonths', v)} error={errors.firstSubsequentDueMonths} />
    </div>
  </fieldset>
);

const inheritedPercent = (rule?: CareConditionRule): string =>
  rule?.recurring_percent != null ? `Usa ${formatPercentBRL(rule.recurring_percent)} da regra geral` : 'Atenção: a regra geral desta condição ainda não tem percentual';

const inheritedDeductible = (rule?: CareConditionRule): string => {
  if (!rule?.deductible_modality || rule.deductible_value == null) return 'Atenção: a regra geral desta condição ainda não tem franquia';
  return rule.deductible_modality === 'PERCENTUAL'
    ? `Usa ${formatPercentBRL(rule.deductible_value)} do preço de venda`
    : `Usa ${formatCurrencyBRL(rule.deductible_value)} fixo`;
};

const RatesPart: React.FC<PartProps & { general?: CareConditionRule }> = ({ form, set, errors, general }) => (
  <fieldset className="space-y-3">
    <legend className="text-sm font-bold app-text-primary">Percentual das parcelas seguintes</legend>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Choice name="care-percent" checked={form.percentMode === 'herdar'} onChange={() => set('percentMode', 'herdar')} label="Herdar da condição" hint={inheritedPercent(general)} />
      <Choice name="care-percent" checked={form.percentMode === 'especifico'} onChange={() => set('percentMode', 'especifico')} label="Definir para este modelo" hint="Substitui só a taxa; a franquia continua independente" />
    </div>
    {form.percentMode === 'especifico' && (
      <DecimalField label="Percentual específico" suffix="%" maxDecimals={4} value={form.percent} onChange={(v) => set('percent', v)} error={errors.percent} hint="Sobre o preço efetivo de venda do aparelho" />
    )}
    <p className="pt-2 text-sm font-bold app-text-primary">Franquia</p>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Choice name="care-deductible" checked={form.deductibleMode === 'herdar'} onChange={() => set('deductibleMode', 'herdar')} label="Herdar franquia por condição" hint={inheritedDeductible(general)} />
      <Choice name="care-deductible" checked={form.deductibleMode === 'especifica'} onChange={() => set('deductibleMode', 'especifica')} label="Definir franquia específica" hint="Substitui (não soma) a geral" />
    </div>
    {form.deductibleMode === 'especifica' && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select className="ios-input" aria-label="Modalidade da franquia" value={form.deductibleModality} onChange={(e) => set('deductibleModality', e.target.value as ModelRuleForm['deductibleModality'])}>
          <option value="PERCENTUAL">Percentual do preço de venda</option>
          <option value="VALOR_FIXO">Valor fixo em reais</option>
        </select>
        <DecimalField
          label={form.deductibleModality === 'PERCENTUAL' ? 'Percentual' : 'Valor'}
          prefix={form.deductibleModality === 'VALOR_FIXO' ? 'R$' : undefined}
          suffix={form.deductibleModality === 'PERCENTUAL' ? '%' : undefined}
          maxDecimals={form.deductibleModality === 'PERCENTUAL' ? 4 : 2}
          value={form.deductibleValue}
          onChange={(v) => set('deductibleValue', v)}
          error={errors.deductibleValue}
        />
      </div>
    )}
  </fieldset>
);

const BonusPart: React.FC<{ form: ModelRuleForm; set: SetField; benefits: CareBenefit[] }> = ({ form, set, benefits }) => {
  const toggle = (id: string, quantity: number) => set('bonuses', { ...form.bonuses, [id]: quantity });
  const offered = benefits.filter((b) => b.active || form.bonuses[b.id]);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-bold app-text-primary">Bônus da 1ª parcela</legend>
      {offered.length === 0 && <p className="text-sm app-text-muted">Cadastre itens no catálogo de bônus para vincular aqui.</p>}
      {offered.map((b) => {
        const qty = form.bonuses[b.id] ?? 0;
        return (
          <div key={b.id} className="flex min-h-[44px] items-center gap-3 rounded-ios-lg border app-border px-3 py-2">
            <input type="checkbox" className="h-5 w-5 accent-brand-500" checked={qty > 0} onChange={(e) => toggle(b.id, e.target.checked ? 1 : 0)} aria-label={`Incluir ${b.name}`} />
            <span className="flex-1 text-sm app-text-primary">{b.name}{b.reference_cost != null && <span className="app-text-muted"> · custo {formatCurrencyBRL(b.reference_cost)}</span>}</span>
            {qty > 0 && (
              <input type="number" min={1} max={20} className="ios-input w-20" aria-label={`Quantidade de ${b.name}`} value={qty} onChange={(e) => toggle(b.id, Math.max(1, Number(e.target.value) || 1))} />
            )}
          </div>
        );
      })}
    </fieldset>
  );
};

const ContractTextPart: React.FC<{ form: ModelRuleForm; set: SetField }> = ({ form, set }) => (
  <fieldset className="space-y-3">
    <legend className="text-sm font-bold app-text-primary">No contrato</legend>
    <TextField multiline label="Serviços contemplados" value={form.servicesDescription} onChange={(v) => set('servicesDescription', v)} hint="Lista fechada do que é feito (ex.: troca de bateria abaixo de 80%, troca de tela). Vazio = texto padrão das configurações; sem nenhum dos dois, a contratação fica bloqueada." />
    <TextField label="Limites de utilização" value={form.usageLimits} onChange={(v) => set('usageLimits', v)} placeholder="Ex.: 1 troca de bateria e 1 de tela por vigência" hint="Vazio = limite padrão das configurações; sem nenhum dos dois, a contratação fica bloqueada." />
    <TextField label="Observações internas" value={form.notes} onChange={(v) => set('notes', v)} hint="Não aparecem no contrato." />
  </fieldset>
);

const ModelRuleModal: React.FC<ModelRuleModalProps> = ({ rule, conditionRules, benefits, models, onClose, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState<ModelRuleForm>(() => (rule ? formFromRule(rule) : emptyModelRuleForm()));
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const errors = showErrors ? validateModelRule(form) : {};
  const set: SetField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const general = conditionRules.find((c) => c.condition === form.condition);

  const save = async () => {
    if (Object.keys(validateModelRule(form)).length > 0) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    try {
      await saveModelRule(toModelRuleInput(form));
      toast.success(`Regra de ${form.model} ${conditionLabel(form.condition || null).toLowerCase()} salva. Contratos já firmados não mudam.`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error && /care_model_rules_key/.test(e.message) ? 'Já existe uma regra para este modelo e condição.' : e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={rule ? `Configurar Repasse Care+ · ${rule.model}` : 'Configurar Repasse Care+'}
      footer={(
        <div className="flex justify-end gap-2">
          <IOSButton variant="secondary" type="button" onClick={onClose}>Cancelar</IOSButton>
          <IOSButton variant="primary" type="button" loading={busy} onClick={save}>Salvar regra</IOSButton>
        </div>
      )}
    >
      <div className="space-y-6">
        <DevicePart form={form} set={set} errors={errors} models={models} />
        <BillingPart form={form} set={set} errors={errors} />
        <RatesPart form={form} set={set} errors={errors} general={general} />
        <BonusPart form={form} set={set} benefits={benefits} />
        <ContractTextPart form={form} set={set} />
      </div>
    </Modal>
  );
};

export default ModelRuleModal;
