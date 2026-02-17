import type { CardFeeSettings } from '../types';

export const CARD_INSTALLMENTS_MAX = 18;

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const DEFAULT_VISA_MASTER_RATES = [
  2.99, 4.09, 4.78, 5.47, 6.14, 6.81, 7.67, 8.33, 8.98, 9.63, 10.26, 10.9, 12.32, 12.94, 13.56, 14.17, 14.77, 15.37
];

export const DEFAULT_OTHER_RATES = [
  3.99, 5.3, 5.99, 6.68, 7.35, 8.02, 9.47, 10.13, 10.78, 11.43, 12.06, 12.7, 13.32, 13.94, 14.56, 15.17, 15.77, 16.37
];

export const DEFAULT_CARD_FEE_SETTINGS: CardFeeSettings = {
  visaMasterRates: DEFAULT_VISA_MASTER_RATES,
  otherRates: DEFAULT_OTHER_RATES
};

const ensureRates = (input: unknown, fallback: number[]) => {
  if (!Array.isArray(input)) return [...fallback];

  const normalized = input
    .slice(0, CARD_INSTALLMENTS_MAX)
    .map((value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 100) return null;
      return roundMoney(parsed);
    });

  while (normalized.length < CARD_INSTALLMENTS_MAX) {
    normalized.push(fallback[normalized.length]);
  }

  return normalized.map((value, index) => (value === null ? fallback[index] : value));
};

export const normalizeCardFeeSettings = (input?: Partial<CardFeeSettings> | null): CardFeeSettings => ({
  visaMasterRates: ensureRates(input?.visaMasterRates, DEFAULT_VISA_MASTER_RATES),
  otherRates: ensureRates(input?.otherRates, DEFAULT_OTHER_RATES)
});

export const getCardRate = (
  settings: CardFeeSettings,
  brand: 'visa_master' | 'outras',
  installments: number
) => {
  const safeInstallments = Math.min(CARD_INSTALLMENTS_MAX, Math.max(1, Math.trunc(installments)));
  const rates = brand === 'visa_master' ? settings.visaMasterRates : settings.otherRates;
  return Number(rates[safeInstallments - 1] || 0);
};

export interface CardChargeBreakdown {
  netAmount: number;
  customerAmount: number;
  feeAmount: number;
  feeRate: number;
  installments: number;
  installmentAmount: number;
}

export const calculateCardCharge = (netAmount: number, feeRate: number, installments: number): CardChargeBreakdown => {
  const safeNet = roundMoney(Math.max(0, Number(netAmount) || 0));
  const safeRate = Math.max(0, Math.min(99.99, Number(feeRate) || 0));
  const safeInstallments = Math.min(CARD_INSTALLMENTS_MAX, Math.max(1, Math.trunc(installments)));

  const customerAmount = safeRate === 0
    ? safeNet
    : roundMoney(safeNet / (1 - safeRate / 100));
  const feeAmount = roundMoney(customerAmount - safeNet);
  const installmentAmount = roundMoney(customerAmount / safeInstallments);

  return {
    netAmount: safeNet,
    customerAmount,
    feeAmount,
    feeRate: roundMoney(safeRate),
    installments: safeInstallments,
    installmentAmount
  };
};
