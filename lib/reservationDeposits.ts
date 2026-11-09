import type { ReservationDepositPart, ReservationTradeIn, StockReservation, StockReservationInput } from '../types';

const toAmount = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

/** Lê deposit_parts do banco; reservas antigas sem partes viram um sinal único. */
export const mapDepositPartsFromDb = (row: {
  deposit_parts?: unknown;
  deposit_amount?: unknown;
  deposit_payment_method?: string | null;
  deposit_transaction_id?: string | null;
  deposit_refund_transaction_id?: string | null;
}): ReservationDepositPart[] => {
  if (Array.isArray(row.deposit_parts) && row.deposit_parts.length > 0) {
    return row.deposit_parts.map((part: any) => ({
      amount: toAmount(part?.amount),
      method: String(part?.method || ''),
      transactionId: part?.transactionId || null,
      refundTransactionId: part?.refundTransactionId || null,
    }));
  }
  const amount = toAmount(row.deposit_amount);
  if (amount <= 0) return [];
  return [{
    amount,
    method: row.deposit_payment_method || '',
    transactionId: row.deposit_transaction_id || null,
    refundTransactionId: row.deposit_refund_transaction_id || null,
  }];
};

export const mapTradeInFromDb = (raw: unknown): ReservationTradeIn | null => {
  if (!raw || typeof raw !== 'object') return null;
  const tradeIn = raw as { description?: unknown; value?: unknown };
  const description = String(tradeIn.description || '').trim();
  if (!description) return null;
  return { description, value: toAmount(tradeIn.value) };
};

/** Sinais informados na tela, sem os zerados; aceita o formato antigo de sinal único. */
export const resolveInputDepositParts = (input: StockReservationInput): ReservationDepositPart[] => {
  const parts = input.depositParts
    ?? [{ amount: toAmount(input.depositAmount), method: input.depositPaymentMethod || '' }];
  return parts
    .map((part) => ({ amount: Number(part.amount), method: (part.method || '').trim() }))
    .filter((part) => part.amount !== 0);
};

export const assertValidDepositParts = (parts: ReservationDepositPart[]) => {
  for (const part of parts) {
    if (!Number.isFinite(part.amount) || part.amount < 0) throw new Error('Valor do sinal inválido.');
    if (!part.method) throw new Error('Informe a forma do sinal.');
  }
};

export const sumDepositParts = (parts: ReservationDepositPart[]): number =>
  parts.reduce((total, part) => total + toAmount(part.amount), 0);

export const normalizeTradeIn = (tradeIn: ReservationTradeIn | null | undefined): ReservationTradeIn | null => {
  const description = tradeIn?.description?.trim() || '';
  const value = toAmount(tradeIn?.value);
  if (!description && value === 0) return null;
  if (!description) throw new Error('Informe o aparelho da troca.');
  if (value < 0) throw new Error('Valor da troca inválido.');
  return { description, value };
};

/** Todos os lançamentos do financeiro que pertencem aos sinais da reserva. */
export const reservationDepositTransactionIds = (reservation: StockReservation | null | undefined): string[] => {
  if (!reservation) return [];
  const ids = [
    reservation.depositTransactionId,
    reservation.depositRefundTransactionId,
    ...(reservation.depositParts ?? []).flatMap((part) => [part.transactionId, part.refundTransactionId]),
  ];
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
};

/** Quanto falta o cliente pagar: preço menos sinais e o valor dado pela troca. */
export const reservationRemainingAmount = (
  price: number,
  parts: ReservationDepositPart[],
  tradeIn: ReservationTradeIn | null | undefined
): number => Math.max(0, price - sumDepositParts(parts) - toAmount(tradeIn?.value));
