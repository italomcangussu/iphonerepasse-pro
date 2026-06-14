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
