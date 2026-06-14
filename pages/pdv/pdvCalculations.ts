import { Condition, WarrantyType, type PaymentMethod, type StockItem } from '../../types';
import {
  computePdvPricing,
  roundCurrency,
  type DiscountConfig
} from '../../utils/pdvPricing';

export type StoreWarrantyDays = 90 | 180 | 365;
export type WarrantyDaysByItem = Record<string, StoreWarrantyDays>;

export type RemainingBalanceInput = {
  cartTotal: number;
  tradeInTotal: number;
  paymentTotal: number;
};

export type PdvTotalsInput = {
  cartItems: StockItem[];
  tradeInItems: StockItem[];
  payments: PaymentMethod[];
  negotiatedPrice: number;
  discountConfig: DiscountConfig;
};

export type PdvTotals = {
  originalSubtotal: number;
  negotiatedSubtotal: number;
  tradeInValue: number;
  discountAmount: number;
  discountPercent: number | null;
  clientOwedAmount: number;
  totalToPay: number;
  totalPaidNet: number;
  cardSurchargeTotal: number;
  totalPaidByCustomer: number;
  remaining: number;
  isPaymentBalanced: boolean;
  hasPaymentPending: boolean;
  hasPaymentOverage: boolean;
  hasNegotiatedPriceChange: boolean;
};

export const calculateRemainingBalance = ({
  cartTotal,
  tradeInTotal,
  paymentTotal
}: RemainingBalanceInput): number => roundCurrency(cartTotal - tradeInTotal - paymentTotal);

export const calculatePdvTotals = ({
  cartItems,
  tradeInItems,
  payments,
  negotiatedPrice,
  discountConfig
}: PdvTotalsInput): PdvTotals => {
  const originalSubtotal = roundCurrency(
    cartItems.reduce((acc, item) => acc + Number(item.originalSellPrice ?? item.sellPrice ?? 0), 0)
  );
  const negotiatedSubtotal = cartItems.length === 1
    ? roundCurrency(Math.max(0, negotiatedPrice))
    : roundCurrency(cartItems.reduce((acc, item) => acc + Number(item.sellPrice || 0), 0));
  const tradeInValue = roundCurrency(tradeInItems.reduce((acc, item) => acc + item.purchasePrice, 0));
  const { discountAmount, discountPercent, clientOwedAmount, totalToPay } =
    computePdvPricing(negotiatedSubtotal, discountConfig, tradeInValue);
  const totalPaidNet = payments.reduce((acc, payment) => acc + payment.amount, 0);
  const cardSurchargeTotal = payments.reduce((acc, payment) => acc + (payment.feeAmount || 0), 0);
  const totalPaidByCustomer = payments.reduce((acc, payment) => acc + (payment.customerAmount || payment.amount), 0);
  const remaining = roundCurrency(totalToPay - totalPaidNet);

  return {
    originalSubtotal,
    negotiatedSubtotal,
    tradeInValue,
    discountAmount,
    discountPercent,
    clientOwedAmount,
    totalToPay,
    totalPaidNet,
    cardSurchargeTotal,
    totalPaidByCustomer,
    remaining,
    isPaymentBalanced: Math.abs(remaining) < 0.01,
    hasPaymentPending: remaining > 0.009,
    hasPaymentOverage: remaining < -0.009,
    hasNegotiatedPriceChange:
      cartItems.length > 0 && Math.abs(negotiatedSubtotal - originalSubtotal) > 0.009
  };
};

export const getStoreWarrantyDate = (saleDate: Date, days: StoreWarrantyDays): Date => {
  const date = new Date(saleDate);
  date.setDate(date.getDate() + days);
  return date;
};

export const getSoldItemWarrantyDate = (item: StockItem): string | null =>
  item.condition === Condition.USED ? item.warrantyExpiresAt || item.warrantyEnd || null : null;

export const getSoldItemWarrantyLabel = (item: StockItem): string | null => {
  if (item.condition === Condition.NEW && item.warrantyType === WarrantyType.APPLE) return 'Garantia Apple: 1 ano';
  const warrantyDate = getSoldItemWarrantyDate(item);
  if (!warrantyDate) return null;
  return `Garantia loja: até ${new Date(warrantyDate).toLocaleDateString('pt-BR')}`;
};
