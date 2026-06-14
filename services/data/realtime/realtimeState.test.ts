import { describe, expect, it } from 'vitest';
import {
  removeById,
  removeDebtCascade,
  removePayableDebtCascade,
  removeSaleCascade,
  upsertById
} from './realtimeState';
import {
  Condition,
  DeviceType,
  StockStatus,
  WarrantyType,
  type Debt,
  type DebtPayment,
  type PayableDebt,
  type PayableDebtPayment,
  type Sale,
  type StockItem,
  type Transaction
} from '../../../types';

const stockItem = (id: string, status = StockStatus.SOLD): StockItem => ({
  id,
  type: DeviceType.IPHONE,
  model: 'iPhone 15',
  color: 'Preto',
  capacity: '128 GB',
  imei: id,
  condition: Condition.USED,
  status,
  storeId: 'store-1',
  purchasePrice: 3000,
  sellPrice: 4000,
  maxDiscount: 0,
  warrantyType: WarrantyType.STORE,
  costs: [],
  photos: [],
  entryDate: '2026-05-01'
});

const sale = (id: string, items: StockItem[]): Sale => ({
  id,
  customerId: 'customer-1',
  sellerId: 'seller-1',
  items,
  tradeInValue: 0,
  discount: 0,
  total: 4000,
  paymentMethods: [],
  date: '2026-05-01',
  warrantyExpiresAt: null
});

const debt = (id: string, saleId?: string): Debt => ({
  id,
  customerId: 'customer-1',
  saleId,
  originalAmount: 100,
  remainingAmount: 100,
  status: 'Aberta',
  source: 'pdv',
  createdAt: '2026-05-01',
  updatedAt: '2026-05-01'
});

const debtPayment = (id: string, debtId: string): DebtPayment => ({
  id,
  debtId,
  amount: 50,
  paymentMethod: 'Pix',
  account: 'Conta Bancária',
  paidAt: '2026-05-02',
  createdAt: '2026-05-02'
});

const payableDebt = (id: string, saleId?: string): PayableDebt => ({
  id,
  creditorId: 'creditor-1',
  creditorName: 'Fornecedor',
  originalAmount: 100,
  remainingAmount: 100,
  status: 'Aberta',
  source: 'pdv',
  saleId,
  createdAt: '2026-05-01',
  updatedAt: '2026-05-01'
});

const payablePayment = (id: string, payableDebtId: string): PayableDebtPayment => ({
  id,
  payableDebtId,
  amount: 50,
  paymentMethod: 'Pix',
  account: 'Conta Bancária',
  paidAt: '2026-05-02',
  createdAt: '2026-05-02'
});

const transaction = (id: string, links: Partial<Transaction> = {}): Transaction => ({
  id,
  type: 'IN',
  category: 'Venda',
  amount: 100,
  date: '2026-05-01',
  description: id,
  account: 'Conta Bancária',
  ...links
});

describe('realtime state transitions', () => {
  it('upserts and removes rows by id without mutating the source arrays', () => {
    const rows = [{ id: '1', name: 'old' }];

    expect(upsertById(rows, { id: '1', name: 'new' })).toEqual([{ id: '1', name: 'new' }]);
    expect(upsertById(rows, { id: '2', name: 'next' })).toEqual([
      { id: '1', name: 'old' },
      { id: '2', name: 'next' }
    ]);
    expect(removeById([...rows, { id: '2', name: 'next' }], '1')).toEqual([
      { id: '2', name: 'next' }
    ]);
    expect(rows).toEqual([{ id: '1', name: 'old' }]);
  });

  it('removes a sale and every linked finance row while releasing sold stock', () => {
    const sold = stockItem('stock-sold');
    const untouched = stockItem('stock-other');
    const linkedDebt = debt('debt-linked', 'sale-1');
    const linkedDebtPayment = debtPayment('debt-payment-linked', linkedDebt.id);
    const linkedPayableDebt = payableDebt('payable-linked', 'sale-1');
    const linkedPayablePayment = payablePayment('payable-payment-linked', linkedPayableDebt.id);

    const next = removeSaleCascade({
      saleId: 'sale-1',
      sales: [sale('sale-1', [sold]), sale('sale-other', [untouched])],
      transactions: [
        transaction('by-sale', { saleId: 'sale-1' }),
        transaction('by-debt-payment', { debtPaymentId: linkedDebtPayment.id }),
        transaction('by-payable-payment', { payableDebtPaymentId: linkedPayablePayment.id }),
        transaction('by-payable-debt', { payableDebtId: linkedPayableDebt.id }),
        transaction('unrelated')
      ],
      debts: [linkedDebt, debt('debt-other')],
      debtPayments: [linkedDebtPayment, debtPayment('debt-payment-other', 'debt-other')],
      payableDebts: [linkedPayableDebt, payableDebt('payable-other')],
      payableDebtPayments: [
        linkedPayablePayment,
        payablePayment('payable-payment-other', 'payable-other')
      ],
      stock: [sold, untouched]
    });

    expect(next.sales.map((item) => item.id)).toEqual(['sale-other']);
    expect(next.transactions.map((item) => item.id)).toEqual(['unrelated']);
    expect(next.debts.map((item) => item.id)).toEqual(['debt-other']);
    expect(next.debtPayments.map((item) => item.id)).toEqual(['debt-payment-other']);
    expect(next.payableDebts.map((item) => item.id)).toEqual(['payable-other']);
    expect(next.payableDebtPayments.map((item) => item.id)).toEqual(['payable-payment-other']);
    expect(next.stock.find((item) => item.id === sold.id)?.status).toBe(StockStatus.AVAILABLE);
    expect(next.stock.find((item) => item.id === untouched.id)?.status).toBe(StockStatus.SOLD);
  });

  it('does not release stock when the deleted sale is absent locally', () => {
    const sold = stockItem('stock-sold');

    const next = removeSaleCascade({
      saleId: 'missing-sale',
      sales: [],
      transactions: [],
      debts: [],
      debtPayments: [],
      payableDebts: [],
      payableDebtPayments: [],
      stock: [sold]
    });

    expect(next.stock).toEqual([sold]);
  });

  it('removes a debt with its payments and linked transactions', () => {
    const linkedPayment = debtPayment('payment-linked', 'debt-1');

    const next = removeDebtCascade({
      debtId: 'debt-1',
      debts: [debt('debt-1'), debt('debt-other')],
      debtPayments: [linkedPayment, debtPayment('payment-other', 'debt-other')],
      transactions: [
        transaction('transaction-linked', { debtPaymentId: linkedPayment.id }),
        transaction('transaction-other')
      ]
    });

    expect(next.debts.map((item) => item.id)).toEqual(['debt-other']);
    expect(next.debtPayments.map((item) => item.id)).toEqual(['payment-other']);
    expect(next.transactions.map((item) => item.id)).toEqual(['transaction-other']);
  });

  it('removes a payable debt with direct and payment-linked transactions', () => {
    const linkedPayment = payablePayment('payment-linked', 'payable-1');

    const next = removePayableDebtCascade({
      payableDebtId: 'payable-1',
      payableDebts: [payableDebt('payable-1'), payableDebt('payable-other')],
      payableDebtPayments: [linkedPayment, payablePayment('payment-other', 'payable-other')],
      transactions: [
        transaction('by-debt', { payableDebtId: 'payable-1' }),
        transaction('by-payment', { payableDebtPaymentId: linkedPayment.id }),
        transaction('transaction-other')
      ]
    });

    expect(next.payableDebts.map((item) => item.id)).toEqual(['payable-other']);
    expect(next.payableDebtPayments.map((item) => item.id)).toEqual(['payment-other']);
    expect(next.transactions.map((item) => item.id)).toEqual(['transaction-other']);
  });
});
