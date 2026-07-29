import { Condition, type FinancialAccount, type PaymentMethod, type StockItem } from '../../types';
import type { DiscountInputType } from '../../utils/pdvPricing';
import type { StoreWarrantyDays, WarrantyDaysByItem } from './pdvCalculations';

export const PDV_DRAFT_KEY = 'pdv:draft:v1';
const PDV_DRAFT_VERSION = 1;

export type ProductConditionFilter = Condition.NEW | Condition.USED;

export type PdvDraft = {
  selectedStore?: string;
  selectedSeller?: string;
  selectedClient?: string;
  selectedProductId?: string;
  cartItemIds?: string[];
  productConditionFilter?: ProductConditionFilter;
  storeWarrantyDays?: StoreWarrantyDays;
  itemWarrantyDays?: WarrantyDaysByItem;
  payments?: PaymentMethod[];
  commission?: number;
  originalSaleDate?: string | null;
  originalSaleId?: string | null;
  draftTradeIns?: StockItem[];
  discountConfig?: { type: DiscountInputType; value: number };
  negotiatedPriceInput?: string;
  clientPaymentMode?: 'immediate' | 'payable_debt' | null;
  clientPaymentAccount?: FinancialAccount | null;
  clientPaymentMethod?: 'Pix' | 'Dinheiro' | 'Cartão' | 'Cartão Débito' | null;
  clientPaymentNotes?: string | null;
  clientPaymentDueDate?: string | null;
};

type VersionedPdvDraft = {
  version: typeof PDV_DRAFT_VERSION;
  draft: PdvDraft;
};

export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => unknown;
  removeItem: (key: string) => unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isVersionedPdvDraft = (value: unknown): value is VersionedPdvDraft =>
  isRecord(value) && value.version === PDV_DRAFT_VERSION && isRecord(value.draft);

export const readPdvDraft = (storage: StorageLike): PdvDraft | null => {
  try {
    const rawDraft = storage.getItem(PDV_DRAFT_KEY);
    if (!rawDraft) return null;

    const parsed: unknown = JSON.parse(rawDraft);
    if (!isRecord(parsed)) return null;

    if ('version' in parsed) {
      return isVersionedPdvDraft(parsed) ? parsed.draft : null;
    }

    return parsed as PdvDraft;
  } catch {
    return null;
  }
};

export const writePdvDraft = (storage: StorageLike, draft: PdvDraft): void => {
  storage.setItem(PDV_DRAFT_KEY, JSON.stringify({ version: PDV_DRAFT_VERSION, draft }));
};

export const clearPdvDraft = (storage: StorageLike): void => {
  storage.removeItem(PDV_DRAFT_KEY);
};

/**
 * Um sinal de reserva só continua válido enquanto a reserva que o originou
 * segue ativa e o dinheiro segue com a loja. Cancelar a reserva (com estorno
 * ou com retenção) invalida o pagamento — ele não pode voltar para a venda.
 */
export const isReservationDepositPaymentValid = (
  payment: PaymentMethod,
  cartItems: StockItem[]
): boolean => {
  if (payment.source !== 'reservation_deposit') return true;

  return cartItems.some((item) => {
    const reservation = item.reservation;
    if (!reservation || reservation.status !== 'active') return false;
    if (reservation.id !== payment.reservationId) return false;
    if (reservation.depositTransactionId !== payment.reservationDepositTransactionId) return false;
    return !reservation.depositRefundTransactionId &&
      !reservation.depositRefundedAt &&
      !reservation.depositRetainedAt;
  });
};

export const sanitizeReservationDepositPayments = (
  payments: PaymentMethod[],
  cartItems: StockItem[]
): { payments: PaymentMethod[]; removed: PaymentMethod[] } => {
  const kept: PaymentMethod[] = [];
  const removed: PaymentMethod[] = [];

  payments.forEach((payment) => {
    if (isReservationDepositPaymentValid(payment, cartItems)) {
      kept.push(payment);
    } else {
      removed.push(payment);
    }
  });

  return { payments: kept, removed };
};

/**
 * Cancelar/liberar uma reserva precisa invalidar o rascunho que o "Vender
 * reservado" gravou, senão o PDV recarrega para sempre um sinal que já foi
 * estornado (ou retido) ao cliente.
 */
export const releaseReservationFromPdvDraft = (
  storage: StorageLike,
  { stockItemId, reservationId }: { stockItemId: string; reservationId?: string | null }
): boolean => {
  const draft = readPdvDraft(storage);
  if (!draft) return false;

  const cartItemIds = Array.isArray(draft.cartItemIds)
    ? draft.cartItemIds
    : draft.selectedProductId
      ? [draft.selectedProductId]
      : [];

  const draftPayments = Array.isArray(draft.payments) ? draft.payments : [];
  const referencesItem = cartItemIds.includes(stockItemId);
  const referencesReservation = !!reservationId && draftPayments.some(
    (payment) => payment.source === 'reservation_deposit' && payment.reservationId === reservationId
  );

  if (!referencesItem && !referencesReservation) return false;

  const remainingCartItemIds = cartItemIds.filter((id) => id !== stockItemId);
  if (remainingCartItemIds.length === 0) {
    clearPdvDraft(storage);
    return true;
  }

  const remainingPayments = draftPayments.filter((payment) => {
    if (payment.source !== 'reservation_deposit') return true;
    if (reservationId) return payment.reservationId !== reservationId;
    return false;
  });

  writePdvDraft(storage, {
    ...draft,
    cartItemIds: remainingCartItemIds,
    selectedProductId: draft.selectedProductId === stockItemId ? undefined : draft.selectedProductId,
    payments: remainingPayments
  });

  return true;
};
