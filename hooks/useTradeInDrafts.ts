import { useCallback, useMemo, useState } from 'react';
import {
  buildTradeInLabel,
  compareTradeInDevicesByFamily,
  findTradeInValueRule,
  getApplicableTradeInAdjustments,
  parseSimulatorAmount,
  SIMULATOR_MAX_TRADE_INS,
  type SimulatorTradeInInput,
  type TradeInAdjustmentRule,
  type TradeInValueRule,
} from '../utils/simulator';

/**
 * Estado dos aparelhos que o cliente entrega na troca.
 *
 * O simulador aceita vários aparelhos e cada um pode vir da tabela de valores
 * (`catalog`) ou ser digitado na hora, fora da tabela (`custom`) — é como o
 * vendedor fecha uma troca com um aparelho que a loja ainda não precificou.
 *
 * O valor recebido é **derivado**, nunca copiado para o estado por efeito:
 * enquanto o vendedor não digita nada, o campo mostra tabela + ajustes; assim
 * que ele digita (`valueTouched`), o que ele escreveu manda. Isso evita que um
 * resync do DataProvider (novas referências de array ao voltar para o app)
 * apague uma edição manual.
 */

export type TradeInDraftMode = 'catalog' | 'custom';

export interface TradeInDraft {
  id: string;
  mode: TradeInDraftMode;
  model: string;
  capacity: string;
  color: string;
  /** Valor recebido exatamente como foi digitado (vazio = ainda derivado da tabela). */
  value: string;
  /** Trava a derivação automática depois de uma edição manual. */
  valueTouched: boolean;
  adjustmentIds: string[];
}

export interface TradeInDraftView extends TradeInDraft {
  index: number;
  /** Ajustes de condição compatíveis com o modelo/capacidade deste aparelho. */
  adjustments: TradeInAdjustmentRule[];
  /** Capacidades cadastradas para o modelo escolhido. */
  capacityOptions: string[];
  /** `null` quando o aparelho não está na tabela de valores. */
  baseValue: number | null;
  suggestedValue: number;
  /** O que o input de valor deve exibir. */
  valueInput: string;
  receivedValue: number;
  /** Nada preenchido ainda: não entra na conta nem gera erro. */
  isEmpty: boolean;
  label: string;
}

export interface UseTradeInDraftsOptions {
  valueRules: TradeInValueRule[];
  adjustmentRules: TradeInAdjustmentRule[];
  /** Quantos aparelhos já nascem na lista (padrão: 1 card vazio). */
  initialCount?: number;
  maxDrafts?: number;
}

let draftSequence = 0;
const nextDraftId = () => {
  draftSequence += 1;
  return `trade-in-${draftSequence}`;
};

export const createTradeInDraft = (mode: TradeInDraftMode = 'catalog'): TradeInDraft => ({
  id: nextDraftId(),
  mode,
  model: '',
  capacity: '',
  color: '',
  value: '',
  valueTouched: false,
  adjustmentIds: [],
});

const createInitialDrafts = (count: number) => Array.from({ length: Math.max(1, count) }, () => createTradeInDraft());

export const useTradeInDrafts = ({
  valueRules,
  adjustmentRules,
  initialCount = 1,
  maxDrafts = SIMULATOR_MAX_TRADE_INS,
}: UseTradeInDraftsOptions) => {
  const [drafts, setDrafts] = useState<TradeInDraft[]>(() => createInitialDrafts(initialCount));

  const activeValueRules = useMemo(
    () => valueRules.filter((rule) => rule.isActive !== false).slice().sort(compareTradeInDevicesByFamily),
    [valueRules],
  );

  const modelOptions = useMemo(
    () => Array.from(new Set(activeValueRules.map((rule) => rule.model))),
    [activeValueRules],
  );

  const views = useMemo<TradeInDraftView[]>(() => drafts.map((draft, index) => {
    const model = draft.model.trim();
    const capacity = draft.capacity.trim();
    const capacityOptions = Array.from(new Set(
      activeValueRules.filter((rule) => rule.model === draft.model).map((rule) => rule.capacity),
    ));
    const baseRule = model && capacity ? findTradeInValueRule(valueRules, model, capacity) : null;
    const adjustments = draft.mode === 'custom' || !model
      ? []
      : getApplicableTradeInAdjustments(adjustmentRules, model, capacity);
    const adjustmentsTotal = adjustments
      .filter((rule) => draft.adjustmentIds.includes(rule.id))
      .reduce((sum, rule) => sum + (Number(rule.amountDelta) || 0), 0);
    const suggestedValue = baseRule ? Math.max(0, baseRule.baseValue + adjustmentsTotal) : 0;
    // Fora da tabela o valor é sempre o digitado; na tabela, só depois de editar.
    const usesTypedValue = draft.mode === 'custom' || draft.valueTouched;
    const valueInput = usesTypedValue
      ? draft.value
      : (baseRule ? String(suggestedValue) : '');
    const receivedValue = usesTypedValue
      ? Math.max(0, parseSimulatorAmount(draft.value))
      : suggestedValue;

    return {
      ...draft,
      index,
      adjustments,
      capacityOptions,
      baseValue: baseRule ? baseRule.baseValue : null,
      suggestedValue,
      valueInput,
      receivedValue,
      isEmpty: !model && !capacity && !draft.color.trim() && !draft.value.trim() && draft.adjustmentIds.length === 0,
      label: buildTradeInLabel({ model, capacity, color: draft.color.trim() }),
    };
  }), [activeValueRules, adjustmentRules, drafts, valueRules]);

  const patchDraft = useCallback((id: string, patch: Partial<TradeInDraft>) => {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }, []);

  const setMode = useCallback((id: string, mode: TradeInDraftMode) => {
    // Trocar de origem zera o aparelho: modelo da tabela e modelo digitado não
    // se misturam, e os ajustes só existem no modo tabela.
    patchDraft(id, { mode, model: '', capacity: '', value: '', valueTouched: false, adjustmentIds: [] });
  }, [patchDraft]);

  const setModel = useCallback((id: string, model: string) => {
    patchDraft(id, { model, capacity: '', valueTouched: false, adjustmentIds: [] });
  }, [patchDraft]);

  const setCapacity = useCallback((id: string, capacity: string) => {
    patchDraft(id, { capacity, valueTouched: false });
  }, [patchDraft]);

  const setColor = useCallback((id: string, color: string) => {
    patchDraft(id, { color });
  }, [patchDraft]);

  const setValue = useCallback((id: string, value: string) => {
    patchDraft(id, { value, valueTouched: true });
  }, [patchDraft]);

  const toggleAdjustment = useCallback((id: string, adjustmentId: string) => {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== id) return draft;
      const adjustmentIds = draft.adjustmentIds.includes(adjustmentId)
        ? draft.adjustmentIds.filter((item) => item !== adjustmentId)
        : [...draft.adjustmentIds, adjustmentId];
      // Mudar de ajuste é uma decisão sobre o aparelho, então o valor volta a derivar.
      return { ...draft, adjustmentIds, valueTouched: false };
    }));
  }, []);

  const canAddDraft = drafts.length < maxDrafts;

  const addDraft = useCallback((mode: TradeInDraftMode = 'catalog') => {
    const draft = createTradeInDraft(mode);
    setDrafts((current) => (current.length >= maxDrafts ? current : [...current, draft]));
    return draft.id;
  }, [maxDrafts]);

  const removeDraft = useCallback((id: string) => {
    // A lista nunca fica sem card: o último vira um card em branco.
    setDrafts((current) => (
      current.length <= 1 ? [createTradeInDraft(current[0]?.mode ?? 'catalog')] : current.filter((draft) => draft.id !== id)
    ));
  }, []);

  const resetDrafts = useCallback(() => {
    setDrafts(createInitialDrafts(initialCount));
  }, [initialCount]);

  const filledViews = useMemo(() => views.filter((view) => !view.isEmpty), [views]);

  const tradeInInputs = useMemo<SimulatorTradeInInput[]>(() => filledViews.map((view) => ({
    model: view.model.trim(),
    capacity: view.capacity.trim(),
    color: view.color.trim(),
    selectedAdjustmentIds: view.adjustmentIds,
    manualReceivedValue: view.valueInput.trim() ? parseSimulatorAmount(view.valueInput) : null,
  })), [filledViews]);

  const receivedTotal = useMemo(
    () => filledViews.reduce((sum, view) => sum + view.receivedValue, 0),
    [filledViews],
  );

  return {
    drafts,
    views,
    filledViews,
    modelOptions,
    tradeInInputs,
    receivedTotal,
    canAddDraft,
    maxDrafts,
    addDraft,
    removeDraft,
    resetDrafts,
    setMode,
    setModel,
    setCapacity,
    setColor,
    setValue,
    toggleAdjustment,
  };
};

export type UseTradeInDraftsResult = ReturnType<typeof useTradeInDrafts>;
