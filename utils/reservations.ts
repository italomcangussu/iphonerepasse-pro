import type { Seller, StockReservation } from '../types';

/**
 * Nome do vendedor responsável por uma reserva.
 *
 * `sellerId` é a fonte de verdade e vence sempre que o vendedor ainda consta no cadastro,
 * para que renomear um vendedor se reflita também nas reservas antigas. `sellerName` é o
 * snapshot gravado na reserva e serve apenas de fallback (vendedor removido do cadastro,
 * ou reserva anterior à coluna `seller_id`).
 */
export const resolveReservationSellerName = (
  reservation: StockReservation | null | undefined,
  sellers: Seller[]
): string | null => {
  if (!reservation) return null;

  const nameById = reservation.sellerId
    ? sellers.find((seller) => seller.id === reservation.sellerId)?.name
    : null;

  return nameById || reservation.sellerName || null;
};

export type ReservationDeadlineTone = 'expired' | 'urgent' | 'normal' | 'none';

export interface ReservationDeadline {
  label: string;
  tone: ReservationDeadlineTone;
}

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Extrai o DIA DE CALENDÁRIO (`YYYY-MM-DD`) da validade de uma reserva.
 *
 * `expires_at` é `timestamptz` no banco, mas o dado é um dia: a tela coleta com
 * `<input type="date">` e a regra é "a reserva vale até o dia X". Como o RPC faz
 * `'2026-08-26'::timestamptz` numa sessão UTC, o valor volta como meia-noite UTC — e
 * `new Date(...)` em BRT o joga para o dia ANTERIOR. Era por isso que o usuário escolhia
 * 26/08, a lista mostrava 25/08 e a reserva morria no dia 26.
 *
 * Ler os 10 primeiros caracteres é o mesmo que `toDateInputValue` já fazia no modal de
 * edição (que por isso sempre mostrou o dia certo), e continua correto depois que a
 * coluna virar `date` de verdade.
 */
export const toReservationCalendarDay = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const match = CALENDAR_DAY.exec(value);
  return match ? match[0] : null;
};

/** Formata um dia de calendário em pt-BR sem construir `Date` (logo, sem fuso). */
export const formatReservationDayBR = (value: string | null | undefined): string | null => {
  const day = toReservationCalendarDay(value);
  if (!day) return null;
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
};

const startOfLocalDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

/** Meia-noite LOCAL do dia de calendário — nunca reinterpretado por fuso. */
const parseCalendarDay = (day: string): Date => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
};

/** Dias inteiros entre hoje e a validade. Negativo = já passou. */
const daysUntil = (day: string, now: Date): number =>
  Math.round((parseCalendarDay(day).getTime() - startOfLocalDay(now).getTime()) / MS_PER_DAY);

/**
 * Uma reserva vence no FIM do dia escolhido: no próprio dia ela ainda vale.
 */
export const isReservationDayExpired = (
  expiresAt: string | null | undefined,
  now: Date
): boolean => {
  const day = toReservationCalendarDay(expiresAt);
  if (!day) return false;
  return daysUntil(day, now) < 0;
};

/**
 * Traduz a validade num prazo relativo ("Vence hoje", "Vencida há 2 dias").
 *
 * A lista mostrava só a data crua, então o operador tinha que comparar com o dia de hoje
 * de cabeça — e uma reserva vencendo hoje ficava idêntica a uma vencendo em 30 dias. O
 * prazo relativo põe esse conhecimento no mundo, e `tone` permite destacar só o que é
 * urgente em vez de pintar a linha inteira de âmbar.
 */
export const describeReservationDeadline = (
  expiresAt: string | null | undefined,
  now: Date
): ReservationDeadline => {
  const day = toReservationCalendarDay(expiresAt);
  if (!day) return { label: 'Sem validade', tone: 'none' };

  const days = daysUntil(day, now);

  if (days < 0) {
    const overdueDays = Math.abs(days);
    return {
      label: overdueDays === 1 ? 'Vencida ontem' : `Vencida há ${overdueDays} dias`,
      tone: 'expired'
    };
  }

  if (days === 0) return { label: 'Vence hoje', tone: 'urgent' };
  if (days === 1) return { label: 'Vence amanhã', tone: 'urgent' };
  if (days <= 3) return { label: `Vence em ${days} dias`, tone: 'urgent' };

  return { label: `Vence em ${days} dias`, tone: 'normal' };
};
