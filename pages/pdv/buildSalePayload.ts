import {
  type FinancialAccount,
  type PaymentMethod,
  type Sale,
  type SaleTradeInItem,
  type StockItem
} from '../../types';
import { Condition } from '../../types';
import { roundCurrency, type DiscountInputType } from '../../utils/pdvPricing';
import { getStoreWarrantyDate, type WarrantyDaysByItem } from './pdvCalculations';

export type ClientRefundMethod = 'Pix' | 'Dinheiro';
export type ClientPaymentMode = 'immediate' | 'payable_debt';

export type BuildSalePayloadTotals = {
  originalSubtotal: number;
  negotiatedSubtotal: number;
  tradeInValue: number;
  discountAmount: number;
  discountPercent: number | null;
  totalToPay: number;
  clientOwedAmount: number;
};

export type BuildSalePayloadInput = {
  saleId: string;
  saleDate: Date;
  selectedClient: string;
  selectedSeller: string;
  selectedStore: string;
  cartItems: StockItem[];
  tradeInItems: StockItem[];
  payments: PaymentMethod[];
  itemWarrantyDays: WarrantyDaysByItem;
  totals: BuildSalePayloadTotals;
  discountType: DiscountInputType;
  commission: number;
  createTradeInId: () => string;
  clientPaymentMode: ClientPaymentMode;
  clientPaymentAccount: FinancialAccount | null;
  clientPaymentMethod: ClientRefundMethod | null;
  clientPaymentNotes: string;
  clientPaymentDueDate: string;
};

export type BuildSalePayloadResult = {
  sale: Sale;
  saleForDb: Sale;
};

const mapTradeInItemToSaleTradeIn = (
  item: StockItem,
  createTradeInId: () => string
): SaleTradeInItem => ({
  id: createTradeInId(),
  stockItemId: item.id,
  model: item.model || 'Trade-in',
  capacity: item.capacity || undefined,
  color: item.color || undefined,
  imei: item.imei || undefined,
  condition: item.condition,
  receivedValue: Number(item.purchasePrice || 0),
  stockSnapshot: item
});

export const buildSalePayload = ({
  saleId,
  saleDate,
  selectedClient,
  selectedSeller,
  selectedStore,
  cartItems,
  tradeInItems,
  payments,
  itemWarrantyDays,
  totals,
  discountType,
  commission,
  createTradeInId,
  clientPaymentMode,
  clientPaymentAccount,
  clientPaymentMethod,
  clientPaymentNotes,
  clientPaymentDueDate
}: BuildSalePayloadInput): BuildSalePayloadResult => {
  const saleProductSnapshots: StockItem[] = cartItems.map((item) => {
    const isSingleItemPriceOverride = cartItems.length === 1;
    const itemWarrantyExpiresAt =
      item.condition === Condition.USED
        ? getStoreWarrantyDate(saleDate, itemWarrantyDays[item.id] || 90).toISOString()
        : null;

    return {
      ...item,
      sellPrice: isSingleItemPriceOverride ? totals.negotiatedSubtotal : roundCurrency(item.sellPrice),
      originalSellPrice: roundCurrency(item.originalSellPrice ?? item.sellPrice),
      warrantyExpiresAt: itemWarrantyExpiresAt
    };
  });
  const saleWarrantyExpiresAt = saleProductSnapshots
    .map((item) => item.warrantyExpiresAt)
    .filter((value): value is string => !!value)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
  const normalizedDiscountType = totals.discountAmount > 0 ? discountType : null;

  const sale: Sale = {
    id: saleId,
    customerId: selectedClient,
    sellerId: selectedSeller,
    items: saleProductSnapshots,
    tradeIn: tradeInItems[0] || undefined,
    tradeIns: tradeInItems.map((item) => mapTradeInItemToSaleTradeIn(item, createTradeInId)),
    tradeInValue: totals.tradeInValue,
    discount: totals.discountAmount,
    discountType: normalizedDiscountType,
    discountPercent: normalizedDiscountType === 'percent' ? totals.discountPercent : null,
    originalSubtotal: totals.originalSubtotal,
    negotiatedSubtotal: totals.negotiatedSubtotal,
    total: totals.totalToPay,
    paymentMethods: payments,
    date: saleDate.toISOString(),
    storeId: selectedStore,
    warrantyExpiresAt: saleWarrantyExpiresAt,
    commission: selectedSeller ? roundCurrency(commission) : 0,
    ...(totals.clientOwedAmount > 0 && {
      clientPaymentAmount: totals.clientOwedAmount,
      clientPaymentMode,
      clientPaymentAccount: clientPaymentMode === 'immediate' ? clientPaymentAccount : null,
      clientPaymentMethod: clientPaymentMode === 'immediate' ? clientPaymentMethod : null,
      clientPaymentNotes: clientPaymentNotes.trim() || null,
      clientPaymentDueDate: clientPaymentMode === 'payable_debt' && clientPaymentDueDate ? clientPaymentDueDate : null
    })
  };

  return {
    sale,
    saleForDb: { ...sale, tradeIn: undefined }
  };
};
