import { describe, it, expect } from 'vitest';
import {
  describeReservationDeadline,
  formatReservationDayBR,
  isReservationDayExpired,
  resolveReservationSellerName,
  toReservationCalendarDay
} from './reservations';
import type { Seller, StockReservation } from '../types';

const makeReservation = (overrides: Partial<StockReservation> = {}): StockReservation => ({
  id: 'res-1',
  stockItemId: 'stk-1',
  customerName: 'Cliente Reserva',
  customerPhone: '88999990000',
  reservedAt: '2026-08-25T10:00:00.000Z',
  status: 'active',
  createdAt: '2026-08-25T10:00:00.000Z',
  updatedAt: '2026-08-25T10:00:00.000Z',
  ...overrides
});

const sellers: Seller[] = [
  { id: 'sel-1', name: 'Kauan Lean', email: 'kauan@teste.com', authUserId: 'u-1', storeId: 'store-1', totalSales: 0 }
];

describe('resolveReservationSellerName', () => {
  it('returns null when there is no reservation', () => {
    expect(resolveReservationSellerName(null, sellers)).toBeNull();
    expect(resolveReservationSellerName(undefined, sellers)).toBeNull();
  });

  it('returns null when the reservation carries no seller at all', () => {
    expect(resolveReservationSellerName(makeReservation(), sellers)).toBeNull();
  });

  it('resolves the live name from sellerId', () => {
    const reservation = makeReservation({ sellerId: 'sel-1' });
    expect(resolveReservationSellerName(reservation, sellers)).toBe('Kauan Lean');
  });

  it('prefers the live cadastro name over the snapshot stored on the reservation', () => {
    const reservation = makeReservation({ sellerId: 'sel-1', sellerName: 'Nome Antigo' });
    expect(resolveReservationSellerName(reservation, sellers)).toBe('Kauan Lean');
  });

  it('falls back to the stored snapshot when the seller is no longer in the cadastro', () => {
    const reservation = makeReservation({ sellerId: 'sel-removido', sellerName: 'Edson Gadelha' });
    expect(resolveReservationSellerName(reservation, sellers)).toBe('Edson Gadelha');
  });

  it('falls back to the stored snapshot when the reservation predates sellerId', () => {
    const reservation = makeReservation({ sellerName: 'Edson Gadelha' });
    expect(resolveReservationSellerName(reservation, sellers)).toBe('Edson Gadelha');
  });

  it('returns null when the seller list is empty and nothing was stored', () => {
    expect(resolveReservationSellerName(makeReservation({ sellerId: 'sel-1' }), [])).toBeNull();
  });
});

describe('describeReservationDeadline', () => {
  // A função recebe a validade como ela vem do banco/insumo: um DIA de calendário
  // (`YYYY-MM-DD`, eventualmente com o resto do timestamp colado). Só `now` é um
  // instante local — por isso o bloco não depende do fuso da máquina.
  const localDay = (year: number, month: number, day: number, hour = 12): Date =>
    new Date(year, month - 1, day, hour, 0, 0);
  const now = localDay(2026, 8, 25);

  it('reports no deadline when expiresAt is missing or unparseable', () => {
    expect(describeReservationDeadline(null, now)).toEqual({ label: 'Sem validade', tone: 'none' });
    expect(describeReservationDeadline(undefined, now)).toEqual({ label: 'Sem validade', tone: 'none' });
    expect(describeReservationDeadline('não é data', now)).toEqual({ label: 'Sem validade', tone: 'none' });
  });

  it('flags a reservation expiring today as urgent', () => {
    expect(describeReservationDeadline('2026-08-25', now)).toEqual({
      label: 'Vence hoje',
      tone: 'urgent'
    });
  });

  it('flags tomorrow and the next three days as urgent', () => {
    expect(describeReservationDeadline('2026-08-26', now)).toEqual({
      label: 'Vence amanhã',
      tone: 'urgent'
    });
    expect(describeReservationDeadline('2026-08-28', now)).toEqual({
      label: 'Vence em 3 dias',
      tone: 'urgent'
    });
  });

  it('treats anything beyond three days as a normal deadline', () => {
    expect(describeReservationDeadline('2026-08-29', now)).toEqual({
      label: 'Vence em 4 dias',
      tone: 'normal'
    });
  });

  it('counts how long an expired reservation has been overdue', () => {
    expect(describeReservationDeadline('2026-08-24', now)).toEqual({
      label: 'Vencida ontem',
      tone: 'expired'
    });
    expect(describeReservationDeadline('2026-08-20', now)).toEqual({
      label: 'Vencida há 5 dias',
      tone: 'expired'
    });
  });

  it('ignores the clock time attached to the stored day', () => {
    // Qualquer horário colado no mesmo dia dá o mesmo resultado — inclusive a
    // meia-noite UTC que o RPC grava hoje.
    expect(describeReservationDeadline('2026-08-25T00:00:00.000Z', now).label).toBe('Vence hoje');
    expect(describeReservationDeadline('2026-08-25T23:59:59.000Z', now).label).toBe('Vence hoje');
  });
});

// O RPC faz `'2026-08-26'::timestamptz` numa sessão UTC, então a validade escolhida como
// 26/08 volta do banco como meia-noite UTC. Em BRT, `new Date(...)` disso cai em 25/08 —
// a lista mostrava o dia anterior e a reserva vencia um dia antes do combinado.
const ESCOLHIDO_NO_INPUT = '2026-08-26';
const COMO_VOLTA_DO_BANCO = '2026-08-26T00:00:00.000Z';

describe('validade como dia de calendário (não instante)', () => {
  const localDay = (year: number, month: number, day: number, hour = 12): Date =>
    new Date(year, month - 1, day, hour, 0, 0);

  describe('toReservationCalendarDay', () => {
    it('recovers the day the user picked from the stored timestamptz', () => {
      expect(toReservationCalendarDay(COMO_VOLTA_DO_BANCO)).toBe(ESCOLHIDO_NO_INPUT);
    });

    it('accepts a plain date, so it keeps working after the column becomes `date`', () => {
      expect(toReservationCalendarDay(ESCOLHIDO_NO_INPUT)).toBe(ESCOLHIDO_NO_INPUT);
    });

    it('rejects empty and malformed values', () => {
      expect(toReservationCalendarDay(null)).toBeNull();
      expect(toReservationCalendarDay('')).toBeNull();
      expect(toReservationCalendarDay('26/08/2026')).toBeNull();
    });
  });

  describe('formatReservationDayBR', () => {
    it('shows the day the user picked, not the day before', () => {
      expect(formatReservationDayBR(COMO_VOLTA_DO_BANCO)).toBe('26/08/2026');
    });

    it('returns null when there is no deadline', () => {
      expect(formatReservationDayBR(null)).toBeNull();
    });
  });

  describe('isReservationDayExpired', () => {
    it('is still valid on the very day it expires', () => {
      expect(isReservationDayExpired(COMO_VOLTA_DO_BANCO, localDay(2026, 8, 26))).toBe(false);
    });

    it('expires only after that day is over', () => {
      expect(isReservationDayExpired(COMO_VOLTA_DO_BANCO, localDay(2026, 8, 27))).toBe(true);
    });

    it('is not expired before the deadline', () => {
      expect(isReservationDayExpired(COMO_VOLTA_DO_BANCO, localDay(2026, 8, 25))).toBe(false);
    });

    it('never expires without a deadline', () => {
      expect(isReservationDayExpired(null, localDay(2026, 8, 27))).toBe(false);
    });
  });

  describe('describeReservationDeadline', () => {
    it('counts from the picked day, not from the UTC-shifted one', () => {
      expect(describeReservationDeadline(COMO_VOLTA_DO_BANCO, localDay(2026, 8, 25))).toEqual({
        label: 'Vence amanhã',
        tone: 'urgent'
      });
      expect(describeReservationDeadline(COMO_VOLTA_DO_BANCO, localDay(2026, 8, 26))).toEqual({
        label: 'Vence hoje',
        tone: 'urgent'
      });
      expect(describeReservationDeadline(COMO_VOLTA_DO_BANCO, localDay(2026, 8, 27))).toEqual({
        label: 'Vencida ontem',
        tone: 'expired'
      });
    });
  });
});
