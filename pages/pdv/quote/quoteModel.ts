/**
 * Regras do orçamento do PDV, sem React e sem Supabase.
 *
 * O orçamento é um snapshot: os valores calculados aqui são gravados junto com
 * os itens, então reabrir um orçamento antigo mostra o que foi oferecido, mesmo
 * que o preço do estoque ou as taxas de cartão mudem depois.
 */
import type { CardFeeSettings, StockItem } from '../../../types';
import { calculateCardCharge, CARD_INSTALLMENTS_MAX, getCardRate, type CardChargeBreakdown } from '../../../utils/cardFees';

export const QUOTE_VALIDITY_MIN_DAYS = 1;
export const QUOTE_VALIDITY_MAX_DAYS = 30;
export const QUOTE_VALIDITY_DEFAULT_DAYS = 1;
export const QUOTE_VALIDITY_PRESETS = [1, 2, 3, 7, 15, 30] as const;

export const QUOTE_INSTALLMENT_PRESETS = {
  principais: [1, 3, 6, 10, 12, 18],
  ate12: Array.from({ length: 12 }, (_, index) => index + 1),
  todas: Array.from({ length: CARD_INSTALLMENTS_MAX }, (_, index) => index + 1),
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export type QuoteItemSource = 'stock' | 'manual';
export type QuoteCardBrand = 'visa_master' | 'outras';

/** `sum` = compra conjunta (um total); `compare` = opções para o cliente escolher (cada item com seu preço). */
export type QuotePresentation = 'sum' | 'compare';

export interface QuoteItem {
  key: string;
  source: QuoteItemSource;
  stockItemId?: string;
  name: string;
  details: string[];
  quantity: number;
  unitPrice: number;
  /** Marcação interna; o documento não diz "encomenda". */
  madeToOrder: boolean;
  /** Prazo combinado com o cliente; aparece no documento quando preenchido. */
  leadTime?: string;
}

export interface QuotePaymentPlan {
  cashOnly: boolean;
  cardBrand: QuoteCardBrand;
  installments: number[];
  includeDebit: boolean;
}

export interface QuotePaymentBreakdown {
  cash: number;
  debit: CardChargeBreakdown | null;
  installments: CardChargeBreakdown[];
}

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  total: number;
  payment: QuotePaymentBreakdown;
  /** Uma linha por item, na mesma ordem de `items` (usado no modo comparar). */
  itemPayments: QuotePaymentBreakdown[];
}

export const DEFAULT_QUOTE_PAYMENT_PLAN: QuotePaymentPlan = {
  cashOnly: false,
  cardBrand: 'visa_master',
  installments: [...QUOTE_INSTALLMENT_PRESETS.principais],
  includeDebit: false,
};

export const itemLineTotal = (item: Pick<QuoteItem, 'quantity' | 'unitPrice'>) =>
  roundMoney(Math.max(0, item.unitPrice) * Math.max(1, Math.trunc(item.quantity)));

export const normalizeInstallments = (installments: number[]) =>
  [...new Set(installments.map((value) => Math.trunc(value)))]
    .filter((value) => value >= 1 && value <= CARD_INSTALLMENTS_MAX)
    .sort((a, b) => a - b);

export const computePaymentBreakdown = (
  amount: number,
  plan: QuotePaymentPlan,
  settings: CardFeeSettings,
): QuotePaymentBreakdown => {
  const cash = roundMoney(Math.max(0, amount));
  if (plan.cashOnly || cash === 0) return { cash, debit: null, installments: [] };

  const installments = normalizeInstallments(plan.installments).map((count) =>
    calculateCardCharge(cash, getCardRate(settings, plan.cardBrand, count), count),
  );
  const debit = plan.includeDebit ? calculateCardCharge(cash, settings.debitRate, 1) : null;
  return { cash, debit, installments };
};

export const clampDiscount = (discount: number, subtotal: number) =>
  roundMoney(Math.min(Math.max(0, discount || 0), subtotal));

export interface ComputeQuoteInput {
  items: QuoteItem[];
  discount: number;
  presentation: QuotePresentation;
  plan: QuotePaymentPlan;
}

export const computeQuoteTotals = (input: ComputeQuoteInput, settings: CardFeeSettings): QuoteTotals => {
  const subtotal = roundMoney(input.items.reduce((sum, item) => sum + itemLineTotal(item), 0));
  const discount = input.presentation === 'sum' ? clampDiscount(input.discount, subtotal) : 0;
  const total = roundMoney(subtotal - discount);

  return {
    subtotal,
    discount,
    total,
    payment: computePaymentBreakdown(total, input.plan, settings),
    itemPayments: input.items.map((item) => computePaymentBreakdown(itemLineTotal(item), input.plan, settings)),
  };
};

/** Maior parcelamento oferecido: é o "ou até 18x de R$ …" do destaque. */
export const longestInstallment = (payment: QuotePaymentBreakdown): CardChargeBreakdown | null =>
  payment.installments.length > 0 ? payment.installments[payment.installments.length - 1] : null;

export const clampValidityDays = (days: number) =>
  Math.min(QUOTE_VALIDITY_MAX_DAYS, Math.max(QUOTE_VALIDITY_MIN_DAYS, Math.trunc(days) || QUOTE_VALIDITY_DEFAULT_DAYS));

export const computeQuoteExpiry = (createdAt: Date, validityDays: number) =>
  new Date(createdAt.getTime() + clampValidityDays(validityDays) * DAY_MS);

export type QuoteLifecycle = 'valido' | 'vencido' | 'cancelado';

export const resolveQuoteLifecycle = (
  quote: { status: 'aberto' | 'cancelado'; expiresAt: string },
  now: Date,
): QuoteLifecycle => {
  if (quote.status === 'cancelado') return 'cancelado';
  return new Date(quote.expiresAt).getTime() < now.getTime() ? 'vencido' : 'valido';
};

const describeBattery = (batteryHealth?: number) =>
  typeof batteryHealth === 'number' && batteryHealth > 0 ? `Bateria ${Math.round(batteryHealth)}%` : null;

export const stockItemToQuoteItem = (item: StockItem, key: string): QuoteItem => ({
  key,
  source: 'stock',
  stockItemId: item.id,
  name: [item.model, item.capacity].filter(Boolean).join(' '),
  details: [item.color, item.condition, describeBattery(item.batteryHealth)].filter(
    (detail): detail is string => Boolean(detail),
  ),
  quantity: 1,
  unitPrice: roundMoney(Number(item.sellPrice) || 0),
  madeToOrder: false,
});

export const createManualQuoteItem = (key: string): QuoteItem => ({
  key,
  source: 'manual',
  name: '',
  details: [],
  quantity: 1,
  unitPrice: 0,
  madeToOrder: false,
});

export interface QuoteDraftIssue {
  itemKey?: string;
  message: string;
}

export const findQuoteDraftIssues = (items: QuoteItem[]): QuoteDraftIssue[] => {
  if (items.length === 0) return [{ message: 'Adicione pelo menos um produto ao orçamento.' }];

  return items.flatMap((item) => {
    if (!item.name.trim()) return [{ itemKey: item.key, message: 'Dê um nome ao produto.' }];
    if (item.unitPrice <= 0) return [{ itemKey: item.key, message: `Informe o valor de ${item.name.trim()}.` }];
    return [];
  });
};

/** Versão final do item para gravar: sem espaços sobrando e sem detalhes vazios. */
export const cleanQuoteItem = (item: QuoteItem): QuoteItem => ({
  ...item,
  name: item.name.trim(),
  details: item.details.map((detail) => detail.trim()).filter(Boolean),
  leadTime: item.leadTime?.trim() || undefined,
});

export const formatQuoteNumber = (quoteNumber: number) => `ORC-${String(quoteNumber).padStart(4, '0')}`;

/** O que fica gravado em `pdv_quotes.payment`: o plano escolhido e os valores calculados na hora. */
export interface QuoteSnapshot {
  plan: QuotePaymentPlan;
  presentation: QuotePresentation;
  totals: QuoteTotals;
}

export interface SavedQuote {
  id: string;
  quoteNumber: number;
  createdAt: string;
  expiresAt: string;
  validityDays: number;
  status: 'aberto' | 'cancelado';
  storeId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  sellerName: string | null;
  items: QuoteItem[];
  snapshot: QuoteSnapshot;
  notes: string | null;
}

export type NewQuote = Omit<SavedQuote, 'id' | 'quoteNumber' | 'createdAt' | 'status'>;
