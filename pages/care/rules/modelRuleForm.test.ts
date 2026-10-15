import { describe, expect, it } from 'vitest';
import { emptyModelRuleForm, toModelRuleInput, validateModelRule, type ModelRuleForm } from './modelRuleForm';
import { fromField, toField } from '../CareFields';

const filled = (patch: Partial<ModelRuleForm> = {}): ModelRuleForm => ({
  ...emptyModelRuleForm(),
  model: 'iPhone 13', condition: 'SEMINOVO', firstAmount: '199', subsequentCount: '12',
  billingIntervalMonths: '1', firstSubsequentDueMonths: '1', ...patch,
});

describe('modelRuleForm', () => {
  it('formulário vazio não tem valores padrão e acusa cada campo obrigatório', () => {
    const errors = validateModelRule(emptyModelRuleForm());
    expect(Object.keys(errors).sort()).toEqual(
      ['billingIntervalMonths', 'condition', 'firstAmount', 'firstSubsequentDueMonths', 'model', 'subsequentCount'].sort(),
    );
  });

  it('herdar percentual e franquia salva nulo (vale a regra geral da condição)', () => {
    const input = toModelRuleInput(filled({ bonuses: { b1: 1, b2: 0 } }));
    expect(validateModelRule(filled())).toEqual({});
    expect(input.recurring_percent_override).toBeNull();
    expect(input.deductible_modality).toBeNull();
    expect(input.deductible_value).toBeNull();
    expect(input.bonuses).toEqual([{ benefit_id: 'b1', quantity: 1 }]);
  });

  it('específicos exigem valor; percentual limitado a 100', () => {
    expect(validateModelRule(filled({ percentMode: 'especifico', percent: '' })).percent).toBe('Informe o percentual.');
    expect(validateModelRule(filled({ percentMode: 'especifico', percent: '120' })).percent).toBe('Máximo 100%.');
    expect(validateModelRule(filled({ deductibleMode: 'especifica', deductibleModality: 'VALOR_FIXO', deductibleValue: '' })).deductibleValue).toBe('Informe o valor da franquia.');
    const input = toModelRuleInput(filled({ percentMode: 'especifico', percent: '3,5', deductibleMode: 'especifica', deductibleModality: 'VALOR_FIXO', deductibleValue: '300' }));
    expect(input.recurring_percent_override).toBe(3.5);
    expect(input).toMatchObject({ deductible_modality: 'VALOR_FIXO', deductible_value: 300 });
  });

  it('quantidade de parcelas seguintes aceita 0 mas não negativo nem fração', () => {
    expect(validateModelRule(filled({ subsequentCount: '0' })).subsequentCount).toBeUndefined();
    expect(validateModelRule(filled({ subsequentCount: '-1' })).subsequentCount).toBeDefined();
    expect(validateModelRule(filled({ subsequentCount: '1,5' })).subsequentCount).toBeDefined();
  });

  it('conversão de campo decimal pt-BR', () => {
    expect(fromField('1.234,56')).toBe(1234.56);
    expect(fromField('')).toBeNull();
    expect(toField(3.5, 4)).toBe('3,5');
    expect(toField(199)).toBe('199');
    expect(toField(null)).toBe('');
  });
});
