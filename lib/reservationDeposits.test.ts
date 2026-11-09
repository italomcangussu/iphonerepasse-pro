import { describe, expect, it } from 'vitest';
import {
  mapDepositPartsFromDb,
  normalizeTradeIn,
  reservationDepositTransactionIds,
  reservationRemainingAmount,
  resolveInputDepositParts,
} from './reservationDeposits';

describe('reservationDeposits', () => {
  it('reads saved deposit parts and falls back to the legacy single deposit', () => {
    expect(mapDepositPartsFromDb({
      deposit_parts: [{ amount: '500', method: 'Pix', transactionId: 'trx_1' }],
    })).toEqual([{ amount: 500, method: 'Pix', transactionId: 'trx_1', refundTransactionId: null }]);

    expect(mapDepositPartsFromDb({
      deposit_parts: [],
      deposit_amount: 200,
      deposit_payment_method: 'Dinheiro',
      deposit_transaction_id: 'trx_legacy',
    })).toEqual([{ amount: 200, method: 'Dinheiro', transactionId: 'trx_legacy', refundTransactionId: null }]);

    expect(mapDepositPartsFromDb({ deposit_amount: null })).toEqual([]);
  });

  it('accepts the old single-deposit input and drops empty parts', () => {
    expect(resolveInputDepositParts({ customerName: 'A', customerPhone: '1', depositAmount: 200, depositPaymentMethod: 'Pix' }))
      .toEqual([{ amount: 200, method: 'Pix' }]);
    expect(resolveInputDepositParts({
      customerName: 'A',
      customerPhone: '1',
      depositParts: [{ amount: 0, method: '' }, { amount: 300, method: ' Dinheiro ' }],
    })).toEqual([{ amount: 300, method: 'Dinheiro' }]);
  });

  it('requires a device description for a valued trade-in', () => {
    expect(normalizeTradeIn({ description: '', value: 0 })).toBeNull();
    expect(() => normalizeTradeIn({ description: '', value: 900 })).toThrow('Informe o aparelho da troca.');
    expect(normalizeTradeIn({ description: ' iPhone 11 ', value: 900 })).toEqual({ description: 'iPhone 11', value: 900 });
  });

  it('collects every finance transaction of the reservation deposits', () => {
    expect(reservationDepositTransactionIds({
      id: 'r', stockItemId: 's', customerName: 'A', customerPhone: '1', reservedAt: '', status: 'active', createdAt: '', updatedAt: '',
      depositTransactionId: 'trx_1',
      depositParts: [
        { amount: 500, method: 'Pix', transactionId: 'trx_1' },
        { amount: 300, method: 'Dinheiro', transactionId: 'trx_2', refundTransactionId: 'trx_3' },
      ],
    })).toEqual(['trx_1', 'trx_2', 'trx_3']);
  });

  it('subtracts deposits and trade-in from the price, never below zero', () => {
    const parts = [{ amount: 500, method: 'Pix' }, { amount: 300, method: 'Dinheiro' }];
    expect(reservationRemainingAmount(6700, parts, { description: 'iPhone 11', value: 1200 })).toBe(4700);
    expect(reservationRemainingAmount(500, parts, null)).toBe(0);
  });
});
