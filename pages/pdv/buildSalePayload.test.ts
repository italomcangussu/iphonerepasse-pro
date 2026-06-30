import { describe, expect, it } from 'vitest';
import { Condition, DeviceType, StockStatus, WarrantyType, type StockItem } from '../../types';
import { buildSalePayload } from './buildSalePayload';

const stockItem = (overrides: Partial<StockItem> = {}): StockItem => ({
  id: overrides.id || 'stock-1',
  type: DeviceType.IPHONE,
  model: overrides.model || 'iPhone 15',
  color: 'Preto',
  capacity: '128 GB',
  imei: overrides.imei || 'imei-1',
  condition: overrides.condition || Condition.USED,
  status: StockStatus.AVAILABLE,
  storeId: 'store-1',
  purchasePrice: overrides.purchasePrice ?? 2500,
  sellPrice: overrides.sellPrice ?? 3000,
  originalSellPrice: overrides.originalSellPrice,
  maxDiscount: 0,
  warrantyType: overrides.warrantyType || WarrantyType.STORE,
  costs: [],
  photos: [],
  entryDate: '2026-05-01',
  ...overrides
});

describe('buildSalePayload', () => {
  it('builds the UI sale and DB sale without the legacy trade-in snapshot', () => {
    const soldItem = stockItem({ id: 'stock-sold', sellPrice: 3000, originalSellPrice: 3200 });
    const tradeIn = stockItem({ id: 'stock-trade', model: 'iPhone 13', purchasePrice: 500 });

    const { sale, saleForDb } = buildSalePayload({
      saleId: 'sale-1',
      saleDate: new Date('2026-06-13T12:00:00.000Z'),
      selectedClient: 'customer-1',
      selectedSeller: 'seller-1',
      selectedStore: 'store-1',
      cartItems: [soldItem],
      tradeInItems: [tradeIn],
      payments: [{ type: 'Pix', amount: 2500, account: 'Conta Bancária' }],
      itemWarrantyDays: { 'stock-sold': 90 },
      totals: {
        originalSubtotal: 3200,
        negotiatedSubtotal: 3000,
        tradeInValue: 500,
        discountAmount: 0,
        discountPercent: null,
        totalToPay: 2500,
        clientOwedAmount: 0
      },
      discountType: 'amount',
      commission: 50,
      createTradeInId: () => 'sti-1',
      clientPaymentMode: 'immediate',
      clientPaymentAccount: 'Conta Bancária',
      clientPaymentMethod: 'Pix',
      clientPaymentNotes: '  nota  ',
      clientPaymentDueDate: ''
    });

    expect(sale).toMatchObject({
      id: 'sale-1',
      customerId: 'customer-1',
      sellerId: 'seller-1',
      storeId: 'store-1',
      tradeIn,
      tradeInValue: 500,
      discount: 0,
      discountType: null,
      discountPercent: null,
      originalSubtotal: 3200,
      negotiatedSubtotal: 3000,
      total: 2500,
      commission: 50
    });
    expect(sale.items[0]).toMatchObject({
      id: 'stock-sold',
      sellPrice: 3000,
      originalSellPrice: 3200
    });
    expect(sale.items[0].warrantyExpiresAt).toBe('2026-09-11T12:00:00.000Z');
    expect(sale.tradeIns).toEqual([expect.objectContaining({
      id: 'sti-1',
      stockItemId: 'stock-trade',
      receivedValue: 500,
      stockSnapshot: tradeIn
    })]);
    expect(saleForDb.tradeIn).toBeUndefined();
  });

  it('adds client refund metadata only when the store owes the customer', () => {
    const { sale } = buildSalePayload({
      saleId: 'sale-refund',
      saleDate: new Date('2026-06-13T12:00:00.000Z'),
      selectedClient: 'customer-1',
      selectedSeller: 'seller-1',
      selectedStore: 'store-1',
      cartItems: [stockItem()],
      tradeInItems: [],
      payments: [],
      itemWarrantyDays: {},
      totals: {
        originalSubtotal: 3000,
        negotiatedSubtotal: 3000,
        tradeInValue: 3500,
        discountAmount: 0,
        discountPercent: null,
        totalToPay: 0,
        clientOwedAmount: 500
      },
      discountType: 'amount',
      commission: 0,
      createTradeInId: () => 'sti-unused',
      clientPaymentMode: 'payable_debt',
      clientPaymentAccount: 'Conta Bancária',
      clientPaymentMethod: 'Pix',
      clientPaymentNotes: '  negociar  ',
      clientPaymentDueDate: '2026-07-01'
    });

    expect(sale).toMatchObject({
      clientPaymentAmount: 500,
      clientPaymentMode: 'payable_debt',
      clientPaymentAccount: null,
      clientPaymentMethod: null,
      clientPaymentNotes: 'negociar',
      clientPaymentDueDate: '2026-07-01'
    });
  });

  it('preserves reservation deposit payment metadata in the sale payload', () => {
    const { sale, saleForDb } = buildSalePayload({
      saleId: 'sale-reservation-deposit',
      saleDate: new Date('2026-06-30T12:00:00.000Z'),
      selectedClient: 'customer-1',
      selectedSeller: 'seller-1',
      selectedStore: 'store-1',
      cartItems: [stockItem({ id: 'stock-reserved', sellPrice: 3000 })],
      tradeInItems: [],
      payments: [
        {
          type: 'Pix',
          amount: 250,
          account: 'Conta Bancária',
          source: 'reservation_deposit',
          reservationId: 'res-1',
          reservationDepositTransactionId: 'trx-res-1'
        }
      ],
      itemWarrantyDays: { 'stock-reserved': 90 },
      totals: {
        originalSubtotal: 3000,
        negotiatedSubtotal: 3000,
        tradeInValue: 0,
        discountAmount: 0,
        discountPercent: null,
        totalToPay: 250,
        clientOwedAmount: 0
      },
      discountType: 'amount',
      commission: 0,
      createTradeInId: () => 'sti-unused',
      clientPaymentMode: 'immediate',
      clientPaymentAccount: 'Conta Bancária',
      clientPaymentMethod: 'Pix',
      clientPaymentNotes: '',
      clientPaymentDueDate: ''
    });

    expect(sale.paymentMethods).toEqual([
      expect.objectContaining({
        source: 'reservation_deposit',
        reservationId: 'res-1',
        reservationDepositTransactionId: 'trx-res-1'
      })
    ]);
    expect(saleForDb.paymentMethods).toEqual(sale.paymentMethods);
  });
});
