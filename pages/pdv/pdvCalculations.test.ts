import { describe, expect, it } from 'vitest';
import { calculateCardCharge } from '../../utils/cardFees';
import { Condition, DeviceType, StockStatus, WarrantyType, type PaymentMethod, type StockItem } from '../../types';
import {
  calculateRemainingBalance,
  calculatePdvTotals,
  getSoldItemWarrantyDate,
  getSoldItemWarrantyLabel,
  getStoreWarrantyDate
} from './pdvCalculations';

const stockItem = (overrides: Partial<StockItem> = {}): StockItem => ({
  id: overrides.id || 'stock-1',
  type: DeviceType.IPHONE,
  model: 'iPhone 15',
  color: 'Preto',
  capacity: '128 GB',
  imei: overrides.imei || 'imei-1',
  condition: overrides.condition || Condition.USED,
  status: overrides.status || StockStatus.AVAILABLE,
  storeId: 'store-1',
  purchasePrice: overrides.purchasePrice ?? 2500,
  sellPrice: overrides.sellPrice ?? 3000,
  originalSellPrice: overrides.originalSellPrice,
  maxDiscount: 0,
  warrantyType: overrides.warrantyType || WarrantyType.STORE,
  warrantyEnd: overrides.warrantyEnd,
  warrantyExpiresAt: overrides.warrantyExpiresAt,
  costs: [],
  photos: [],
  entryDate: '2026-05-01',
  ...overrides
});

describe('PDV calculations', () => {
  it.each([
    { cart: 3000, tradeIn: 0, payments: 1000, expected: 2000 },
    { cart: 3000, tradeIn: 500, payments: 2500, expected: 0 },
    { cart: 3000, tradeIn: 3500, payments: 0, expected: -500 }
  ])('calculates remaining balance', ({ cart, tradeIn, payments, expected }) => {
    expect(calculateRemainingBalance({ cartTotal: cart, tradeInTotal: tradeIn, paymentTotal: payments }))
      .toBe(expected);
  });

  it('calculates totals, card fees, payment overage and client refund', () => {
    const cardPayment = {
      type: 'Cartão',
      amount: 1000,
      customerAmount: 1042.64,
      feeAmount: 42.64,
      feeRate: 4.09
    } satisfies PaymentMethod;

    const totals = calculatePdvTotals({
      cartItems: [stockItem({ sellPrice: 3000, originalSellPrice: 3200 })],
      tradeInItems: [stockItem({ id: 'trade-1', purchasePrice: 3500 })],
      payments: [cardPayment],
      negotiatedPrice: 3500,
      discountConfig: { type: 'percent', value: 10 }
    });

    expect(totals.originalSubtotal).toBe(3200);
    expect(totals.negotiatedSubtotal).toBe(3500);
    expect(totals.discountAmount).toBe(350);
    expect(totals.discountPercent).toBe(10);
    expect(totals.tradeInValue).toBe(3500);
    expect(totals.clientOwedAmount).toBe(350);
    expect(totals.totalToPay).toBe(0);
    expect(totals.totalPaidNet).toBe(1000);
    expect(totals.cardSurchargeTotal).toBe(42.64);
    expect(totals.totalPaidByCustomer).toBe(1042.64);
    expect(totals.remaining).toBe(-1000);
    expect(totals.hasPaymentOverage).toBe(true);
    expect(totals.hasNegotiatedPriceChange).toBe(true);
  });

  it('counts reservation deposit payments toward the remaining PDV balance', () => {
    const totals = calculatePdvTotals({
      cartItems: [stockItem({ sellPrice: 3000 })],
      tradeInItems: [],
      payments: [{
        type: 'Pix',
        amount: 250,
        account: 'Conta Bancária',
        source: 'reservation_deposit',
        reservationId: 'res-1',
        reservationDepositTransactionId: 'trx-res-1'
      }],
      negotiatedPrice: 3000,
      discountConfig: { type: 'amount', value: 0 }
    });

    expect(totals.totalPaidNet).toBe(250);
    expect(totals.remaining).toBe(2750);
    expect(totals.hasPaymentPending).toBe(true);
  });

  it('clamps single-item negotiated price and flat discount at the negotiated subtotal', () => {
    const totals = calculatePdvTotals({
      cartItems: [stockItem({ sellPrice: 3000 })],
      tradeInItems: [],
      payments: [],
      negotiatedPrice: -50,
      discountConfig: { type: 'amount', value: 9999 }
    });

    expect(totals.negotiatedSubtotal).toBe(0);
    expect(totals.discountAmount).toBe(0);
    expect(totals.totalToPay).toBe(0);
  });

  it('keeps multi-item negotiated subtotal from item prices', () => {
    const totals = calculatePdvTotals({
      cartItems: [
        stockItem({ id: 'stock-1', sellPrice: 1200 }),
        stockItem({ id: 'stock-2', sellPrice: 1800 })
      ],
      tradeInItems: [],
      payments: [],
      negotiatedPrice: 9999,
      discountConfig: { type: 'amount', value: 0 }
    });

    expect(totals.negotiatedSubtotal).toBe(3000);
  });

  it('uses existing card fee math for totals shown to the customer', () => {
    expect(calculateCardCharge(1000, 4.09, 2)).toMatchObject({
      netAmount: 1000,
      customerAmount: 1042.64,
      feeAmount: 42.64,
      feeRate: 4.09,
      installments: 2,
      installmentAmount: 521.32
    });
  });

  it('calculates store warranty dates and labels sold item warranties', () => {
    const saleDate = new Date('2026-06-13T12:00:00.000Z');
    const storeWarranty = getStoreWarrantyDate(saleDate, 90).toISOString();
    const usedItem = stockItem({ condition: Condition.USED, warrantyExpiresAt: storeWarranty });
    const newItem = stockItem({ condition: Condition.NEW, warrantyType: WarrantyType.APPLE });

    expect(storeWarranty).toBe('2026-09-11T12:00:00.000Z');
    expect(getSoldItemWarrantyDate(usedItem)).toBe(storeWarranty);
    expect(getSoldItemWarrantyLabel(usedItem)).toContain('Garantia loja: até');
    expect(getSoldItemWarrantyLabel(newItem)).toBe('Garantia Apple: 1 ano');
  });
});
