import { describe, expect, it } from 'vitest';
import {
  Condition,
  DeviceType,
  StockStatus,
  WarrantyType,
  type PaymentMethod,
  type StockItem,
  type StockReservation
} from '../../types';
import {
  clearPdvDraft,
  isReservationDepositPaymentValid,
  PDV_DRAFT_KEY,
  readPdvDraft,
  releaseReservationFromPdvDraft,
  sanitizeReservationDepositPayments,
  writePdvDraft,
  type PdvDraft
} from './pdvDraft';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
};

describe('PDV draft persistence', () => {
  const draft: PdvDraft = {
    selectedStore: 'store-1',
    selectedSeller: 'seller-1',
    selectedClient: 'customer-1',
    cartItemIds: ['stock-1'],
    productConditionFilter: Condition.USED,
    payments: [{ type: 'Pix', amount: 100, account: 'Conta Bancária' }],
    commission: 50,
    negotiatedPriceInput: '3000.00'
  };

  it('ignores invalid JSON and version mismatches', () => {
    const storage = createStorage();

    storage.setItem(PDV_DRAFT_KEY, '{');
    expect(readPdvDraft(storage)).toBeNull();

    storage.setItem(PDV_DRAFT_KEY, JSON.stringify({ version: 999, draft }));
    expect(readPdvDraft(storage)).toBeNull();
  });

  it('writes, reads and clears a versioned draft', () => {
    const storage = createStorage();

    expect(readPdvDraft(storage)).toBeNull();
    writePdvDraft(storage, draft);
    expect(readPdvDraft(storage)).toEqual(draft);
    clearPdvDraft(storage);
    expect(storage.getItem(PDV_DRAFT_KEY)).toBeNull();
  });

  it('restores legacy unversioned drafts for compatibility', () => {
    const storage = createStorage();

    storage.setItem(PDV_DRAFT_KEY, JSON.stringify(draft));

    expect(readPdvDraft(storage)).toEqual(draft);
  });
});

const reservation = (overrides: Partial<StockReservation> = {}): StockReservation => ({
  id: 'res-1',
  stockItemId: 'stock-1',
  customerName: 'Cliente',
  customerPhone: '85999999999',
  reservedAt: '2026-07-01T12:00:00Z',
  depositAmount: 500,
  depositPaymentMethod: 'Pix',
  depositTransactionId: 'tx-deposit-1',
  status: 'active',
  createdAt: '2026-07-01T12:00:00Z',
  updatedAt: '2026-07-01T12:00:00Z',
  ...overrides
});

const reservedItem = (overrides: Partial<StockItem> = {}): StockItem => ({
  id: 'stock-1',
  type: DeviceType.IPHONE,
  model: 'iPhone 15',
  color: 'Preto',
  capacity: '128 GB',
  imei: 'imei-1',
  condition: Condition.USED,
  status: StockStatus.RESERVED,
  storeId: 'store-1',
  purchasePrice: 2500,
  sellPrice: 3000,
  maxDiscount: 0,
  warrantyType: WarrantyType.STORE,
  costs: [],
  photos: [],
  entryDate: '2026-05-01',
  reservation: reservation(),
  ...overrides
});

const depositPayment: PaymentMethod = {
  type: 'Pix',
  amount: 500,
  account: 'Conta Bancária',
  source: 'reservation_deposit',
  reservationId: 'res-1',
  reservationDepositTransactionId: 'tx-deposit-1'
};

const regularPayment: PaymentMethod = { type: 'Pix', amount: 2500, account: 'Conta Bancária' };

describe('reservation deposit validity', () => {
  it('keeps the deposit while the reservation is active and the money is with the store', () => {
    expect(isReservationDepositPaymentValid(depositPayment, [reservedItem()])).toBe(true);
  });

  it('never touches regular PDV payments', () => {
    expect(isReservationDepositPaymentValid(regularPayment, [])).toBe(true);
  });

  it.each([
    ['reserva liberada', reservedItem({ reservation: reservation({ status: 'released' }) })],
    ['sinal estornado', reservedItem({
      reservation: reservation({ depositRefundTransactionId: 'tx-refund-1', depositRefundedAt: '2026-07-29T12:00:00Z' })
    })],
    ['sinal retido', reservedItem({ reservation: reservation({ depositRetainedAt: '2026-07-29T12:00:00Z' }) })],
    ['outra transação de sinal', reservedItem({ reservation: reservation({ depositTransactionId: 'tx-other' }) })],
    ['item sem reserva', reservedItem({ reservation: null })]
  ])('invalidates the deposit when %s', (_label, item) => {
    expect(isReservationDepositPaymentValid(depositPayment, [item])).toBe(false);
  });

  it('splits stale deposits out of the payment list', () => {
    const cartItems = [reservedItem({ reservation: reservation({ status: 'released' }) })];

    const { payments, removed } = sanitizeReservationDepositPayments(
      [regularPayment, depositPayment],
      cartItems
    );

    expect(payments).toEqual([regularPayment]);
    expect(removed).toEqual([depositPayment]);
  });
});

describe('releaseReservationFromPdvDraft', () => {
  const reservedDraft: PdvDraft = {
    selectedStore: 'store-1',
    selectedClient: 'customer-1',
    cartItemIds: ['stock-1'],
    productConditionFilter: Condition.USED,
    payments: [depositPayment],
    negotiatedPriceInput: '3000.00'
  };

  it('clears the whole draft when the released item was the only one in the cart', () => {
    const storage = createStorage();
    writePdvDraft(storage, reservedDraft);

    expect(releaseReservationFromPdvDraft(storage, { stockItemId: 'stock-1', reservationId: 'res-1' })).toBe(true);
    expect(readPdvDraft(storage)).toBeNull();
  });

  it('drops only the released item and its deposit when other items remain', () => {
    const storage = createStorage();
    writePdvDraft(storage, {
      ...reservedDraft,
      cartItemIds: ['stock-1', 'stock-2'],
      payments: [depositPayment, regularPayment]
    });

    expect(releaseReservationFromPdvDraft(storage, { stockItemId: 'stock-1', reservationId: 'res-1' })).toBe(true);
    expect(readPdvDraft(storage)).toMatchObject({
      cartItemIds: ['stock-2'],
      payments: [regularPayment]
    });
  });

  it('leaves unrelated drafts untouched', () => {
    const storage = createStorage();
    writePdvDraft(storage, { ...reservedDraft, cartItemIds: ['stock-9'], payments: [regularPayment] });

    expect(releaseReservationFromPdvDraft(storage, { stockItemId: 'stock-1', reservationId: 'res-1' })).toBe(false);
    expect(readPdvDraft(storage)).toMatchObject({ cartItemIds: ['stock-9'] });
  });

  it('handles legacy drafts that used selectedProductId', () => {
    const storage = createStorage();
    writePdvDraft(storage, { selectedProductId: 'stock-1', payments: [depositPayment] });

    expect(releaseReservationFromPdvDraft(storage, { stockItemId: 'stock-1', reservationId: 'res-1' })).toBe(true);
    expect(readPdvDraft(storage)).toBeNull();
  });

  it('does nothing when there is no draft', () => {
    const storage = createStorage();

    expect(releaseReservationFromPdvDraft(storage, { stockItemId: 'stock-1', reservationId: 'res-1' })).toBe(false);
  });
});
