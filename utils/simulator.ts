import {
  calculateCardCharge,
  CARD_INSTALLMENTS_MAX,
  DEFAULT_CARD_FEE_SETTINGS,
  getCardRate,
  type CardChargeBreakdown,
} from './cardFees';
import type { CardFeeSettings } from '../types';

export const SIMULATOR_RESERVATION_HINT_AMOUNT = 250;

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
  tradeIn: SimulatorTradeInInput;
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
    | 'adjustment_invalid'
    | 'entry_invalid'
    | 'entries_exceed_balance'
    | 'card_brand_invalid';
  message: string;
}

export interface SimulatorInstallment extends CardChargeBreakdown {}

export interface SimulatorQuoteSummary {
  desiredDeviceLabel: string;
  desiredDevicePrice: number;
  tradeInLabel: string;
  tradeInBaseValue: number;
  tradeInAdjustmentsTotal: number;
  tradeInReceivedValue: number;
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

const cleanEntry = (entry: SimulatorEntry): SimulatorEntry => ({
  type: String(entry.type || '').trim() || 'Entrada',
  amount: roundMoney(Number(entry.amount) || 0),
});

const emptySummary = (input: SimulatorQuoteInput, generatedAt: Date): SimulatorQuoteSummary => ({
  desiredDeviceLabel: String(input.desiredDevice?.label || '').trim(),
  desiredDevicePrice: roundMoney(Number(input.desiredDevice?.price) || 0),
  tradeInLabel: [input.tradeIn?.model, input.tradeIn?.capacity, input.tradeIn?.color].filter(Boolean).join(' '),
  tradeInBaseValue: 0,
  tradeInAdjustmentsTotal: 0,
  tradeInReceivedValue: 0,
  entriesTotal: 0,
  cardNetAmount: 0,
  reservationHintAmount: SIMULATOR_RESERVATION_HINT_AMOUNT,
  cardBrand: input.cardBrand,
  cardBrandLabel: input.cardBrand === 'outras' ? 'Outras' : 'Visa / Master',
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
  const tradeInModel = String(input.tradeIn?.model || '').trim();
  const tradeInCapacity = String(input.tradeIn?.capacity || '').trim();
  const tradeInColor = String(input.tradeIn?.color || '').trim();

  if (!desiredDeviceLabel || desiredDevicePrice <= 0) {
    errors.push({ code: 'desired_device_invalid', message: 'Informe aparelho desejado e preco valido.' });
  }
  if (!tradeInModel || !tradeInCapacity) {
    errors.push({ code: 'trade_in_invalid', message: 'Informe modelo e armazenamento do trade-in.' });
  }
  if (input.cardBrand !== 'visa_master' && input.cardBrand !== 'outras') {
    errors.push({ code: 'card_brand_invalid', message: 'Informe uma bandeira de cartao valida.' });
  }

  const baseRule = tradeInModel && tradeInCapacity
    ? findTradeInValueRule(valueRules, tradeInModel, tradeInCapacity)
    : null;
  if (!baseRule) {
    errors.push({ code: 'trade_in_value_not_found', message: 'Nao existe valor padrao ativo para este trade-in.' });
  }

  const applicableAdjustments = getApplicableTradeInAdjustments(adjustmentRules, tradeInModel, tradeInCapacity);
  const selectedIds = new Set(input.tradeIn.selectedAdjustmentIds || []);
  const appliedAdjustments = applicableAdjustments.filter((rule) => selectedIds.has(rule.id));
  const invalidSelected = [...selectedIds].filter((id) => !applicableAdjustments.some((rule) => rule.id === id));
  if (invalidSelected.length > 0) {
    errors.push({ code: 'adjustment_invalid', message: 'Um ou mais ajustes selecionados nao sao compativeis.' });
  }

  const entries = (input.entries || []).map(cleanEntry);
  if (entries.some((entry) => entry.amount < 0)) {
    errors.push({ code: 'entry_invalid', message: 'Entradas nao podem ter valor negativo.' });
  }

  const tradeInBaseValue = roundMoney(baseRule?.baseValue || 0);
  const tradeInAdjustmentsTotal = roundMoney(appliedAdjustments.reduce((sum, rule) => sum + (Number(rule.amountDelta) || 0), 0));
  const suggestedTradeInValue = roundMoney(Math.max(0, tradeInBaseValue + tradeInAdjustmentsTotal));
  const hasManualReceivedValue = input.tradeIn.manualReceivedValue !== null
    && input.tradeIn.manualReceivedValue !== undefined
    && Number.isFinite(Number(input.tradeIn.manualReceivedValue));
  const tradeInReceivedValue = roundMoney(Math.max(0, hasManualReceivedValue ? Number(input.tradeIn.manualReceivedValue) : suggestedTradeInValue));
  const entriesTotal = roundMoney(entries.reduce((sum, entry) => sum + entry.amount, 0));
  const cardNetAmount = roundMoney(desiredDevicePrice - tradeInReceivedValue - entriesTotal);

  if (cardNetAmount < 0) {
    errors.push({ code: 'entries_exceed_balance', message: 'Entradas e trade-in excedem o valor do aparelho.' });
  }

  const summary: SimulatorQuoteSummary = {
    desiredDeviceLabel,
    desiredDevicePrice,
    tradeInLabel: [tradeInModel, tradeInCapacity, tradeInColor].filter(Boolean).join(' '),
    tradeInBaseValue,
    tradeInAdjustmentsTotal,
    tradeInReceivedValue,
    entriesTotal,
    cardNetAmount: Math.max(0, cardNetAmount),
    reservationHintAmount: SIMULATOR_RESERVATION_HINT_AMOUNT,
    cardBrand: input.cardBrand,
    cardBrandLabel: input.cardBrand === 'outras' ? 'Outras' : 'Visa / Master',
    appliedAdjustments,
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

export const formatSimulatorMessage = (quote: Pick<SimulatorQuoteResult, 'summary' | 'installments'>) => {
  const { summary, installments } = quote;
  const adjustmentLines = summary.appliedAdjustments.map((adjustment) => (
    `${adjustment.label}: ${formatDeltaCurrency(adjustment.amountDelta)}`
  ));
  const entryLines = summary.entries.length > 0
    ? ['Entradas:', ...summary.entries.map((entry) => `${entry.type}: ${formatSimulatorCurrency(entry.amount)}`), '']
    : [];
  const installmentLines = installments.flatMap((item, index) => [
    `🔹 *${item.installments}x*`,
    `💸 Parcela: ${formatSimulatorCurrency(item.installmentAmount)}`,
    `🧾 Total: ${formatSimulatorCurrency(item.customerAmount)}`,
    index < installments.length - 1 ? '────────' : '',
  ]).filter(Boolean);

  return [
    `📱 ${summary.desiredDeviceLabel} ${formatSimulatorCurrency(summary.desiredDevicePrice)}`,
    '',
    `📲 ${summary.tradeInLabel} ${formatSimulatorCurrency(summary.tradeInReceivedValue)}`,
    ...adjustmentLines,
    `Reserva/sinal opcional: ${formatSimulatorCurrency(summary.reservationHintAmount)} via Pix`,
    '',
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
