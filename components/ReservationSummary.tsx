import React from 'react';
import { AlertTriangle, CalendarClock, User, Wallet } from 'lucide-react';
import type { Seller, StockReservation } from '../types';
import { formatCurrencyBRL } from '../utils/inputMasks';
import {
  describeReservationDeadline,
  resolveReservationSellerName,
  type ReservationDeadlineTone
} from '../utils/reservations';

interface ReservationSummaryProps {
  reservation?: StockReservation | null;
  sellers: Seller[];
  /** Injetável nos testes; por padrão, agora. */
  now?: Date;
  className?: string;
}

// Faixa lateral + fundo do bloco. Só urgente/vencida ganham cor: o resto fica neutro,
// para a cor sinalizar "preciso agir" em vez de decorar toda reserva.
const CONTAINER_TONE: Record<ReservationDeadlineTone, string> = {
  expired: 'border-l-red-500 bg-red-50/70 dark:border-l-red-400 dark:bg-red-900/15',
  urgent: 'border-l-amber-500 bg-amber-50/70 dark:border-l-amber-400 dark:bg-amber-900/15',
  normal: 'border-l-gray-300 app-surface-soft dark:border-l-surface-dark-300',
  none: 'border-l-gray-300 app-surface-soft dark:border-l-surface-dark-300'
};

const DEADLINE_TONE: Record<ReservationDeadlineTone, string> = {
  expired: 'text-red-700 font-semibold dark:text-red-300',
  urgent: 'text-amber-700 font-semibold dark:text-amber-300',
  normal: '',
  none: ''
};

/**
 * Bloco de reserva das listas de estoque (card mobile e tabela desktop).
 *
 * Substitui uma linha corrida em âmbar (`Reserva: NOME · 25/08/2026 · Vendedor: X`) que
 * era truncada e escondia o vendedor. Aqui a hierarquia é de peso e tamanho — o cliente
 * é o dado forte, vendedor e prazo são apoio —, a cor só aparece quando a reserva pede
 * ação, e a data crua virou prazo relativo ("Vence hoje"), que o operador não precisa
 * comparar de cabeça.
 */
export const ReservationSummary: React.FC<ReservationSummaryProps> = ({
  reservation,
  sellers,
  now,
  className = ''
}) => {
  if (!reservation) return null;

  const sellerName = resolveReservationSellerName(reservation, sellers);
  const deadline = describeReservationDeadline(reservation.expiresAt, now ?? new Date());
  const hasDeposit = typeof reservation.depositAmount === 'number' && reservation.depositAmount > 0;
  const DeadlineIcon = deadline.tone === 'expired' ? AlertTriangle : CalendarClock;

  return (
    <div className={`rounded-ios border-l-[3px] px-3 py-2 ${CONTAINER_TONE[deadline.tone]} ${className}`}>
      <p className="text-ios-footnote font-semibold app-text-primary leading-snug break-words">
        {reservation.customerName}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ios-caption app-text-secondary">
        {sellerName && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <User size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{sellerName}</span>
          </span>
        )}

        <span className={`inline-flex items-center gap-1 ${DEADLINE_TONE[deadline.tone]}`}>
          <DeadlineIcon size={12} className="shrink-0" aria-hidden="true" />
          {deadline.label}
        </span>

        {hasDeposit ? (
          <span className="ios-badge-green inline-flex items-center gap-1">
            <Wallet size={12} className="shrink-0" aria-hidden="true" />
            Sinal {formatCurrencyBRL(reservation.depositAmount as number)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Wallet size={12} className="shrink-0" aria-hidden="true" />
            Sem sinal
          </span>
        )}
      </div>
    </div>
  );
};

export default ReservationSummary;
