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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

/**
 * Traduz `expiresAt` num prazo relativo ("Vence hoje", "Vencida há 2 dias").
 *
 * A lista mostrava só a data crua (`25/08/2026`), então o operador tinha que comparar
 * com o dia de hoje de cabeça para saber se precisava agir — e uma reserva vencendo
 * hoje ficava visualmente idêntica a uma vencendo em 30 dias. O prazo relativo põe esse
 * conhecimento no mundo em vez de na cabeça, e `tone` permite destacar só o que é
 * urgente em vez de pintar a linha inteira de âmbar.
 *
 * Usa a mesma leitura local de `expiresAt` que a data já exibida, para os dois nunca
 * discordarem, e o mesmo corte de `isReservationExpired` (vencida = antes de hoje).
 */
export const describeReservationDeadline = (
  expiresAt: string | null | undefined,
  now: Date
): ReservationDeadline => {
  if (!expiresAt) return { label: 'Sem validade', tone: 'none' };

  const expiresDate = new Date(expiresAt);
  if (Number.isNaN(expiresDate.getTime())) return { label: 'Sem validade', tone: 'none' };

  const days = Math.round((startOfDay(expiresDate).getTime() - startOfDay(now).getTime()) / MS_PER_DAY);

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
