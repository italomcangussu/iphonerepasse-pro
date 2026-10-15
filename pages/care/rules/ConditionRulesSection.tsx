import React, { useState } from 'react';
import IOSButton from '../../../components/ui/IOSButton';
import { useToast } from '../../../components/ui/ToastProvider';
import { updateConditionRule } from '../../../services/careApi';
import { conditionLabel } from '../../../lib/care/careLabels';
import type { CareConditionRule, CareDeductibleModality } from '../../../lib/care/careTypes';
import { formatDateTimeBRL } from '../../../utils/inputMasks';
import { DecimalField, fromField, toField } from '../CareFields';

type DeductibleChoice = CareDeductibleModality | '';

interface DeductibleFieldsProps {
  condition: string;
  modality: DeductibleChoice;
  value: string;
  onModality: (m: DeductibleChoice) => void;
  onValue: (v: string) => void;
}

const DeductibleFields: React.FC<DeductibleFieldsProps> = ({ condition, modality, value, onModality, onValue }) => {
  const percent = modality === 'PERCENTUAL';
  return (
    <>
      <div className="space-y-1">
        <label htmlFor={`ded-${condition}`} className="block text-xs font-semibold app-text-secondary">Franquia geral por atendimento</label>
        <select id={`ded-${condition}`} className="ios-input w-full" value={modality} onChange={(e) => onModality(e.target.value as DeductibleChoice)}>
          <option value="">Não configurada</option>
          <option value="PERCENTUAL">Percentual do preço de venda</option>
          <option value="VALOR_FIXO">Valor fixo em reais</option>
        </select>
      </div>
      {modality && (
        <DecimalField
          label={percent ? 'Percentual da franquia' : 'Valor da franquia'}
          prefix={percent ? undefined : 'R$'}
          suffix={percent ? '%' : undefined}
          maxDecimals={percent ? 4 : 2}
          value={value}
          onChange={onValue}
          error={fromField(value) === null ? 'Informe o valor.' : null}
        />
      )}
    </>
  );
};

// Erro que impede salvar a regra geral (null = pode salvar).
export function conditionRuleProblem(percent: string, modality: DeductibleChoice, deductible: string): string | null {
  if (modality && fromField(deductible) === null) return 'Informe o valor da franquia.';
  const overHundred = (fromField(percent) ?? 0) > 100 || (modality === 'PERCENTUAL' && (fromField(deductible) ?? 0) > 100);
  return overHundred ? 'Percentuais vão até 100%.' : null;
}

const ConditionCard: React.FC<{ rule: CareConditionRule; onSaved: () => void }> = ({ rule, onSaved }) => {
  const toast = useToast();
  const [percent, setPercent] = useState(toField(rule.recurring_percent, 4));
  const [modality, setModality] = useState<DeductibleChoice>(rule.deductible_modality ?? '');
  const [deductible, setDeductible] = useState(toField(rule.deductible_value, 4));
  const [busy, setBusy] = useState(false);
  const problem = conditionRuleProblem(percent, modality, deductible);
  const label = conditionLabel(rule.condition).toLowerCase();

  const save = async () => {
    setBusy(true);
    try {
      await updateConditionRule(rule.condition, {
        recurring_percent: fromField(percent),
        deductible_modality: modality || null,
        deductible_value: modality ? fromField(deductible) : null,
      });
      toast.success(`Regra geral de ${label}s salva. Contratos já firmados não mudam.`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ios-card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-base font-bold app-text-primary">Todos os {label}s</p>
        <p className="text-xs app-text-muted">v{rule.version} · {formatDateTimeBRL(rule.updated_at)}</p>
      </div>
      <DecimalField
        label="Percentual de cada parcela seguinte"
        suffix="%"
        maxDecimals={4}
        value={percent}
        onChange={setPercent}
        hint={percent ? 'Aplicado sobre o preço efetivo de venda de cada aparelho.' : 'Vazio = sem regra geral; modelos sem taxa própria ficam bloqueados.'}
      />
      <DeductibleFields condition={rule.condition} modality={modality} value={deductible} onModality={setModality} onValue={setDeductible} />
      <IOSButton variant="primary" type="button" className="w-full" loading={busy} disabled={!!problem} onClick={save}>
        Salvar regra de {label}s
      </IOSButton>
      {problem && <p className="text-xs text-red-600 dark:text-red-400">{problem}</p>}
    </div>
  );
};

const ConditionRulesSection: React.FC<{ rules: CareConditionRule[]; onSaved: () => void }> = ({ rules, onSaved }) => (
  <section className="space-y-3">
    <div>
      <h3 className="text-base font-bold app-text-primary">Regras gerais por condição</h3>
      <p className="text-sm app-text-muted">Valem para todo aparelho da condição que não tenha taxa ou franquia específica do modelo. Novos e seminovos são independentes.</p>
    </div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {rules.map((rule) => <ConditionCard key={`${rule.condition}-${rule.version}`} rule={rule} onSaved={onSaved} />)}
    </div>
  </section>
);

export default ConditionRulesSection;
