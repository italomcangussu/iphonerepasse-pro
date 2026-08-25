import { describe, it, expect } from 'vitest';
import { describeReservationDeadline, resolveReservationSellerName } from './reservations';
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
  // Datas construídas em horário LOCAL de propósito: o projeto não fixa TZ nos testes,
  // e `expiresAt` é lido como data local (igual ao `toLocaleDateString('pt-BR')` que já
  // aparece na tela). Cravar strings UTC deixaria o teste dependente do fuso da máquina.
  const localDay = (year: number, month: number, day: number, hour = 12): Date =>
    new Date(year, month - 1, day, hour, 0, 0);
  const now = localDay(2026, 8, 25);
  const iso = (date: Date) => date.toISOString();

  it('reports no deadline when expiresAt is missing or unparseable', () => {
    expect(describeReservationDeadline(null, now)).toEqual({ label: 'Sem validade', tone: 'none' });
    expect(describeReservationDeadline(undefined, now)).toEqual({ label: 'Sem validade', tone: 'none' });
    expect(describeReservationDeadline('não é data', now)).toEqual({ label: 'Sem validade', tone: 'none' });
  });

  it('flags a reservation expiring today as urgent', () => {
    expect(describeReservationDeadline(iso(localDay(2026, 8, 25, 18)), now)).toEqual({
      label: 'Vence hoje',
      tone: 'urgent'
    });
  });

  it('flags tomorrow and the next three days as urgent', () => {
    expect(describeReservationDeadline(iso(localDay(2026, 8, 26)), now)).toEqual({
      label: 'Vence amanhã',
      tone: 'urgent'
    });
    expect(describeReservationDeadline(iso(localDay(2026, 8, 28)), now)).toEqual({
      label: 'Vence em 3 dias',
      tone: 'urgent'
    });
  });

  it('treats anything beyond three days as a normal deadline', () => {
    expect(describeReservationDeadline(iso(localDay(2026, 8, 29)), now)).toEqual({
      label: 'Vence em 4 dias',
      tone: 'normal'
    });
  });

  it('counts how long an expired reservation has been overdue', () => {
    expect(describeReservationDeadline(iso(localDay(2026, 8, 24)), now)).toEqual({
      label: 'Vencida ontem',
      tone: 'expired'
    });
    expect(describeReservationDeadline(iso(localDay(2026, 8, 20)), now)).toEqual({
      label: 'Vencida há 5 dias',
      tone: 'expired'
    });
  });

  it('compares whole days, so any hour of today still counts as today', () => {
    expect(describeReservationDeadline(iso(localDay(2026, 8, 25, 0)), now).tone).toBe('urgent');
    expect(describeReservationDeadline(iso(localDay(2026, 8, 25, 23)), now).tone).toBe('urgent');
  });
});
