import {
  calculateCardCharge,
  CARD_INSTALLMENTS_MAX,
  DEFAULT_CARD_FEE_SETTINGS,
  getCardRate,
  type CardChargeBreakdown,
} from './cardFees';
import type { CardFeeSettings } from '../types';

export const SIMULATOR_RESERVATION_HINT_AMOUNT = 250;

/** Teto de aparelhos aceitos numa mesma troca — mantém a lista legível no mobile. */
export const SIMULATOR_MAX_TRADE_INS = 4;

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeLookup = (value?: string | null) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export type SimulatorCardBrand = 'visa_master' | 'outras';

export interface TradeInValueRule {
  id?: string;
  model: string;
  capacity: string;
  baseValue: number;
  isActive?: boolean;
}

export interface TradeInAdjustmentRule {
  id: string;
  label: string;
  model?: string | null;
  capacity?: string | null;
  amountDelta: number;
  isActive?: boolean;
}

export interface SimulatorEntry {
  type: string;
  amount: number;
}

export interface SimulatorDesiredDeviceInput {
  label: string;
  price: number;
  color?: string;
  /** `manual` = aparelho fictício, digitado pelo vendedor e sem lastro no estoque. */
  source?: 'stock' | 'manual';
}

export interface SimulatorTradeInInput {
  model: string;
  capacity: string;
  color?: string;
  selectedAdjustmentIds?: string[];
  manualReceivedValue?: number | null;
}

export interface SimulatorQuoteInput {
  desiredDevice: SimulatorDesiredDeviceInput;
  /** Aparelho único da troca. Mantido por compatibilidade; prefira `tradeIns`. */
  tradeIn?: SimulatorTradeInInput;
  /** Vários aparelhos na troca. Quando preenchido, tem precedência sobre `tradeIn`. */
  tradeIns?: SimulatorTradeInInput[];
  entries: SimulatorEntry[];
  cardBrand: SimulatorCardBrand;
  valueRules?: TradeInValueRule[];
  adjustmentRules?: TradeInAdjustmentRule[];
  cardFeeSettings?: CardFeeSettings;
  generatedAt?: Date;
}

export interface SimulatorQuoteError {
  code:
    | 'desired_device_invalid'
    | 'trade_in_invalid'
    | 'trade_in_value_not_found'
    | 'trade_in_limit_exceeded'
    | 'adjustment_invalid'
    | 'entry_invalid'
    | 'entries_exceed_balance'
    | 'card_brand_invalid';
  message: string;
  /** Posição (0-based) do aparelho da troca que gerou o erro, quando aplicável. */
  tradeInIndex?: number;
}

/** Resultado por aparelho da troca — é o que a UI mostra em cada card. */
export interface SimulatorTradeInBreakdown {
  model: string;
  capacity: string;
  color: string;
  label: string;
  baseValue: number;
  adjustmentsTotal: number;
  receivedValue: number;
  appliedAdjustments: TradeInAdjustmentRule[];
  /** Sem valor cadastrado na tabela: o valor veio do que o vendedor digitou. */
  isCustomValue: boolean;
}

export interface SimulatorInstallment extends CardChargeBreakdown {}

export interface SimulatorQuoteSummary {
  desiredDeviceLabel: string;
  desiredDevicePrice: number;
  desiredDeviceSource: 'stock' | 'manual';
  tradeInLabel: string;
  tradeInBaseValue: number;
  tradeInAdjustmentsTotal: number;
  tradeInReceivedValue: number;
  tradeIns: SimulatorTradeInBreakdown[];
  entriesTotal: number;
  cardNetAmount: number;
  reservationHintAmount: number;
  cardBrand: SimulatorCardBrand;
  cardBrandLabel: string;
  appliedAdjustments: TradeInAdjustmentRule[];
  entries: SimulatorEntry[];
  generatedAt: Date;
}

export interface SimulatorQuoteResult {
  ok: boolean;
  errors: SimulatorQuoteError[];
  summary: SimulatorQuoteSummary;
  installments: SimulatorInstallment[];
  messageText: string;
}

export const DEFAULT_SIMULATOR_TRADE_IN_VALUES: TradeInValueRule[] = [
  { model: 'iPhone 11', capacity: '64GB', baseValue: 800, isActive: true },
  { model: 'iPhone 11', capacity: '128GB', baseValue: 1100, isActive: true },
  { model: 'iPhone 12', capacity: '64GB', baseValue: 1000, isActive: true },
  { model: 'iPhone 12', capacity: '128GB', baseValue: 1250, isActive: true },
  { model: 'iPhone 13', capacity: '128GB', baseValue: 1700, isActive: true },
  { model: 'iPhone 13', capacity: '256GB', baseValue: 1900, isActive: true },
  { model: 'iPhone 14', capacity: '128GB', baseValue: 1900, isActive: true },
  { model: 'iPhone 14', capacity: '256GB', baseValue: 2100, isActive: true },
  { model: 'iPhone 15', capacity: '128GB', baseValue: 2600, isActive: true },
  { model: 'iPhone 15', capacity: '256GB', baseValue: 2900, isActive: true },
  { model: 'iPhone 15 Pro', capacity: '128GB', baseValue: 3100, isActive: true },
  { model: 'iPhone 15 Pro', capacity: '256GB', baseValue: 3350, isActive: true },
  { model: 'iPhone 15 Pro Max', capacity: '256GB', baseValue: 4100, isActive: true },
  { model: 'iPhone 15 Pro Max', capacity: '512GB', baseValue: 4500, isActive: true },
  { model: 'iPhone 16', capacity: '128GB', baseValue: 3000, isActive: true },
  { model: 'iPhone 16', capacity: '256GB', baseValue: 3300, isActive: true },
  { model: 'iPhone 16 Pro Max', capacity: '256GB', baseValue: 5000, isActive: true },
];

export const formatSimulatorCurrency = (value: number) => (
  roundMoney(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).replace(/\s/g, ' ')
);

const formatDeltaCurrency = (value: number) => {
  const formatted = formatSimulatorCurrency(Math.abs(value));
  if (value < 0) return `-${formatted}`;
  if (value > 0) return `+${formatted}`;
  return formatted;
};

const formatGeneratedAt = (date: Date) => date.toLocaleString('pt-BR', {
  timeZone: 'America/Fortaleza',
});

export const getCardBrandLabel = (brand: SimulatorCardBrand) => (
  brand === 'visa_master' ? 'Visa / Master' : 'Outras'
);

export const findTradeInValueRule = (
  rules: TradeInValueRule[],
  model: string,
  capacity: string,
) => {
  const targetModel = normalizeLookup(model);
  const targetCapacity = normalizeLookup(capacity);

  return rules.find((rule) => (
    rule.isActive !== false
    && normalizeLookup(rule.model) === targetModel
    && normalizeLookup(rule.capacity) === targetCapacity
  )) || null;
};

export const getApplicableTradeInAdjustments = (
  rules: TradeInAdjustmentRule[],
  model: string,
  capacity: string,
) => {
  const targetModel = normalizeLookup(model);
  const targetCapacity = normalizeLookup(capacity);

  return rules.filter((rule) => {
    if (rule.isActive === false) return false;
    const ruleModel = normalizeLookup(rule.model);
    const ruleCapacity = normalizeLookup(rule.capacity);
    if (ruleModel && ruleModel !== targetModel) return false;
    if (ruleCapacity && ruleCapacity !== targetCapacity) return false;
    return true;
  });
};

/** Aceita "3.500", "3500,50" ou "3500" — o que o vendedor digita no campo de valor. */
export const parseSimulatorAmount = (value: string) => (
  Number(String(value ?? '').replace(/\./g, '').replace(',', '.')) || 0
);

const modelCollator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

const iphoneVariantRank = (model: string) => {
  const name = model.toLowerCase();
  if (/\bpro\s+max\b/.test(name)) return 5;
  if (/\bpro\b/.test(name)) return 4;
  if (/\bair\b/.test(name)) return 3;
  if (/\bplus\b/.test(name)) return 2;
  if (/\bmini\b/.test(name)) return 1;
  return 0;
};

const iphoneGenerationRank = (model: string) => {
  const name = model.toLowerCase();
  const generation = name.match(/\biphone\s+(\d+)/);
  if (generation) return Number(generation[1]);
  if (/\biphone\s+xs\b/.test(name)) return 10.2;
  if (/\biphone\s+xr\b/.test(name)) return 10.1;
  if (/\biphone\s+x\b/.test(name)) return 10;
  if (/\biphone\s+se\b/.test(name)) return 0;
  return -1;
};

export const parseCapacityToGb = (value: string) => {
  const match = String(value ?? '').trim().toUpperCase().match(/(\d+(?:[.,]\d+)?)(?:\s*)(TB|GB)?/);
  if (!match) return 0;
  const amount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(amount)) return 0;
  return (match[2] || 'GB') === 'TB' ? amount * 1024 : amount;
};

/**
 * Ordena por família de iPhone (geração mais nova primeiro, depois variante e
 * capacidade) em vez de ordem alfabética — é assim que o vendedor procura o
 * aparelho na lista.
 */
export const compareTradeInDevicesByFamily = (
  a: { model: string; capacity: string },
  b: { model: string; capacity: string },
) => {
  const generationDiff = iphoneGenerationRank(b.model) - iphoneGenerationRank(a.model);
  if (generationDiff !== 0) return generationDiff;
  const variantDiff = iphoneVariantRank(a.model) - iphoneVariantRank(b.model);
  if (variantDiff !== 0) return variantDiff;
  const modelDiff = modelCollator.compare(a.model, b.model);
  if (modelDiff !== 0) return modelDiff;
  const capacityDiff = parseCapacityToGb(a.capacity) - parseCapacityToGb(b.capacity);
  if (capacityDiff !== 0) return capacityDiff;
  return modelCollator.compare(a.capacity, b.capacity);
};

const isFilledNumber = (value: unknown) => (
  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
);

export const buildTradeInLabel = (tradeIn: Pick<SimulatorTradeInInput, 'model' | 'capacity' | 'color'>) => (
  [tradeIn.model, tradeIn.capacity, tradeIn.color]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
);

/** Um aparelho "vazio" (nenhum campo tocado) não entra na conta nem gera erro. */
export const hasTradeInData = (tradeIn?: SimulatorTradeInInput | null) => {
  if (!tradeIn) return false;
  return Boolean(
    buildTradeInLabel(tradeIn)
    || (tradeIn.selectedAdjustmentIds || []).length > 0
    || isFilledNumber(tradeIn.manualReceivedValue),
  );
};

/** Normaliza `tradeIn` (legado) + `tradeIns` (novo) numa lista só, sem os vazios. */
export const resolveSimulatorTradeIns = (
  input: Pick<SimulatorQuoteInput, 'tradeIn' | 'tradeIns'>,
): SimulatorTradeInInput[] => {
  const list = Array.isArray(input.tradeIns) && input.tradeIns.length > 0
    ? input.tradeIns
    : (input.tradeIn ? [input.tradeIn] : []);
  return list.filter(hasTradeInData);
};

const cleanEntry = (entry: SimulatorEntry): SimulatorEntry => ({
  type: String(entry.type || '').trim() || 'Entrada',
  amount: roundMoney(Number(entry.amount) || 0),
});

const emptySummary = (input: SimulatorQuoteInput, generatedAt: Date): SimulatorQuoteSummary => ({
  desiredDeviceLabel: String(input.desiredDevice?.label || '').trim(),
  desiredDevicePrice: roundMoney(Number(input.desiredDevice?.price) || 0),
  desiredDeviceSource: input.desiredDevice?.source === 'manual' ? 'manual' : 'stock',
  tradeInLabel: resolveSimulatorTradeIns(input).map(buildTradeInLabel).filter(Boolean).join(' + '),
  tradeInBaseValue: 0,
  tradeInAdjustmentsTotal: 0,
  tradeInReceivedValue: 0,
  tradeIns: [],
  entriesTotal: 0,
  cardNetAmount: 0,
  reservationHintAmount: SIMULATOR_RESERVATION_HINT_AMOUNT,
  cardBrand: input.cardBrand,
  cardBrandLabel: getCardBrandLabel(input.cardBrand),
  appliedAdjustments: [],
  entries: [],
  generatedAt,
});

export const calculateSimulatorQuote = (input: SimulatorQuoteInput): SimulatorQuoteResult => {
  const generatedAt = input.generatedAt || new Date();
  const errors: SimulatorQuoteError[] = [];
  const valueRules = input.valueRules || DEFAULT_SIMULATOR_TRADE_IN_VALUES;
  const adjustmentRules = input.adjustmentRules || [];
  const cardFeeSettings = input.cardFeeSettings || DEFAULT_CARD_FEE_SETTINGS;
  const desiredDevicePrice = roundMoney(Number(input.desiredDevice?.price) || 0);
  const desiredDeviceLabel = String(input.desiredDevice?.label || '').trim();
  const desiredDeviceSource = input.desiredDevice?.source === 'manual' ? 'manual' : 'stock';

  if (!desiredDeviceLabel || desiredDevicePrice <= 0) {
    errors.push({ code: 'desired_device_invalid', message: 'Informe o aparelho desejado e um preço válido.' });
  }
  if (input.cardBrand !== 'visa_master' && input.cardBrand !== 'outras') {
    errors.push({ code: 'card_brand_invalid', message: 'Informe uma bandeira de cartão válida.' });
  }

  const tradeInInputs = resolveSimulatorTradeIns(input);
  if (tradeInInputs.length > SIMULATOR_MAX_TRADE_INS) {
    errors.push({
      code: 'trade_in_limit_exceeded',
      message: `Use no máximo ${SIMULATOR_MAX_TRADE_INS} aparelhos na troca.`,
    });
  }
  // Só numera o erro quando há mais de um aparelho — com um só, a numeração seria ruído.
  const describe = (index: number, message: string) => (
    tradeInInputs.length > 1 ? `Aparelho ${index + 1} — ${message}` : message
  );

  const tradeIns: SimulatorTradeInBreakdown[] = tradeInInputs.map((tradeIn, index) => {
    const model = String(tradeIn.model || '').trim();
    const capacity = String(tradeIn.capacity || '').trim();
    const color = String(tradeIn.color || '').trim();
    const selectedIds = new Set(tradeIn.selectedAdjustmentIds || []);
    const hasManualReceivedValue = isFilledNumber(tradeIn.manualReceivedValue);

    if (!model || !capacity) {
      errors.push({
        code: 'trade_in_invalid',
        tradeInIndex: index,
        message: describe(index, 'Informe modelo e armazenamento do aparelho da troca.'),
      });
    }

    const baseRule = model && capacity ? findTradeInValueRule(valueRules, model, capacity) : null;
    const applicableAdjustments = getApplicableTradeInAdjustments(adjustmentRules, model, capacity);
    const appliedAdjustments = applicableAdjustments.filter((rule) => selectedIds.has(rule.id));
    const invalidSelected = [...selectedIds].filter((id) => !applicableAdjustments.some((rule) => rule.id === id));

    if (invalidSelected.length > 0) {
      errors.push({
        code: 'adjustment_invalid',
        tradeInIndex: index,
        message: describe(index, 'Um ou mais ajustes selecionados não são compatíveis.'),
      });
    }
    // Aparelho fora da tabela é permitido desde que o vendedor digite quanto vai pagar por ele.
    if (!baseRule && !hasManualReceivedValue && model && capacity) {
      errors.push({
        code: 'trade_in_value_not_found',
        tradeInIndex: index,
        message: describe(index, 'Sem valor cadastrado para este aparelho. Informe o valor recebido.'),
      });
    }

    const baseValue = roundMoney(baseRule?.baseValue || 0);
    const adjustmentsTotal = roundMoney(appliedAdjustments.reduce((sum, rule) => sum + (Number(rule.amountDelta) || 0), 0));
    const suggestedValue = roundMoney(Math.max(0, baseValue + adjustmentsTotal));
    const receivedValue = roundMoney(Math.max(
      0,
      hasManualReceivedValue ? Number(tradeIn.manualReceivedValue) : suggestedValue,
    ));

    return {
      model,
      capacity,
      color,
      label: buildTradeInLabel({ model, capacity, color }),
      baseValue,
      adjustmentsTotal,
      receivedValue,
      appliedAdjustments,
      isCustomValue: !baseRule,
    };
  });

  const entries = (input.entries || []).map(cleanEntry);
  if (entries.some((entry) => entry.amount < 0)) {
    errors.push({ code: 'entry_invalid', message: 'Entradas não podem ter valor negativo.' });
  }

  const tradeInBaseValue = roundMoney(tradeIns.reduce((sum, item) => sum + item.baseValue, 0));
  const tradeInAdjustmentsTotal = roundMoney(tradeIns.reduce((sum, item) => sum + item.adjustmentsTotal, 0));
  const tradeInReceivedValue = roundMoney(tradeIns.reduce((sum, item) => sum + item.receivedValue, 0));
  const entriesTotal = roundMoney(entries.reduce((sum, entry) => sum + entry.amount, 0));
  const cardNetAmount = roundMoney(desiredDevicePrice - tradeInReceivedValue - entriesTotal);

  if (cardNetAmount < 0) {
    errors.push({
      code: 'entries_exceed_balance',
      message: `Troca e entradas passam ${formatSimulatorCurrency(Math.abs(cardNetAmount))} do valor do aparelho. Reduza a entrada ou o valor da troca.`,
    });
  }

  const summary: SimulatorQuoteSummary = {
    desiredDeviceLabel,
    desiredDevicePrice,
    desiredDeviceSource,
    tradeInLabel: tradeIns.map((item) => item.label).filter(Boolean).join(' + '),
    tradeInBaseValue,
    tradeInAdjustmentsTotal,
    tradeInReceivedValue,
    tradeIns,
    entriesTotal,
    cardNetAmount: Math.max(0, cardNetAmount),
    reservationHintAmount: SIMULATOR_RESERVATION_HINT_AMOUNT,
    cardBrand: input.cardBrand,
    cardBrandLabel: getCardBrandLabel(input.cardBrand),
    appliedAdjustments: tradeIns.flatMap((item) => item.appliedAdjustments),
    entries,
    generatedAt,
  };

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      summary: { ...emptySummary(input, generatedAt), ...summary },
      installments: [],
      messageText: '',
    };
  }

  const installments = Array.from({ length: CARD_INSTALLMENTS_MAX }, (_, index) => {
    const installmentsCount = index + 1;
    const rate = getCardRate(cardFeeSettings, input.cardBrand, installmentsCount);
    return calculateCardCharge(summary.cardNetAmount, rate, installmentsCount);
  });

  const result: SimulatorQuoteResult = {
    ok: true,
    errors: [],
    summary,
    installments,
    messageText: '',
  };
  result.messageText = formatSimulatorMessage(result);
  return result;
};

/** Linhas 📲 da mensagem: uma por aparelho, com seus ajustes logo abaixo. */
const buildTradeInMessageLines = (summary: SimulatorQuoteSummary) => {
  const tradeIns = summary.tradeIns || [];
  if (tradeIns.length === 0) {
    // Compatibilidade com resumos montados à mão (só os campos agregados).
    if (!summary.tradeInLabel && summary.tradeInReceivedValue <= 0) return [];
    return [`📲 ${summary.tradeInLabel} ${formatSimulatorCurrency(summary.tradeInReceivedValue)}`];
  }

  const deviceLines = tradeIns.flatMap((tradeIn) => [
    `📲 ${tradeIn.label} ${formatSimulatorCurrency(tradeIn.receivedValue)}`,
    ...tradeIn.appliedAdjustments.map((adjustment) => (
      `${adjustment.label}: ${formatDeltaCurrency(adjustment.amountDelta)}`
    )),
  ]);

  return tradeIns.length > 1
    ? [...deviceLines, `🔁 Total da troca: ${formatSimulatorCurrency(summary.tradeInReceivedValue)}`]
    : deviceLines;
};

export const formatSimulatorMessage = (quote: Pick<SimulatorQuoteResult, 'summary' | 'installments'>) => {
  const { summary, installments } = quote;
  const entryLines = summary.entries.length > 0
    ? ['Entradas:', ...summary.entries.map((entry) => `${entry.type}: ${formatSimulatorCurrency(entry.amount)}`), '']
    : [];
  const tradeInLines = buildTradeInMessageLines(summary);
  const installmentLines = installments.flatMap((item, index) => [
    `🔹 *${item.installments}x*`,
    `💸 Parcela: ${formatSimulatorCurrency(item.installmentAmount)}`,
    `🧾 Total: ${formatSimulatorCurrency(item.customerAmount)}`,
    index < installments.length - 1 ? '────────' : '',
  ]).filter(Boolean);

  return [
    `📱 ${summary.desiredDeviceLabel} ${formatSimulatorCurrency(summary.desiredDevicePrice)}`,
    '',
    ...tradeInLines,
    ...entryLines,
    `Resta a pagar ${formatSimulatorCurrency(summary.cardNetAmount)}`,
    '',
    '💳 *Simulação de Parcelamento*',
    '',
    `🏷️ Bandeira: *${summary.cardBrandLabel}*`,
    `🎯 Valor líquido desejado: *${formatSimulatorCurrency(summary.cardNetAmount)}*`,
    '',
    '📋 *Parcelas disponíveis*',
    '',
    ...installmentLines,
    '',
    `🗓️ Gerado em: ${formatGeneratedAt(summary.generatedAt)}`,
  ].join('\n');
};
