import { CARD_INSTALLMENTS_MAX } from '../../utils/cardFees';
import type { SharePriceMode } from './inventoryViewModel';

export type SharePreferences = {
  priceMode: SharePriceMode;
  installments: number;
};

const STORAGE_KEY = 'inventory:share-preferences:v1';
export const DEFAULT_SHARE_PREFERENCES: SharePreferences = { priceMode: 'cash', installments: 12 };

const isValidInstallments = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= CARD_INSTALLMENTS_MAX;

export const parseSharePreferences = (raw: string | null): SharePreferences => {
  if (!raw) return DEFAULT_SHARE_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<SharePreferences>;
    return {
      priceMode: parsed.priceMode === 'installments' ? 'installments' : 'cash',
      installments: isValidInstallments(parsed.installments) ? parsed.installments : DEFAULT_SHARE_PREFERENCES.installments
    };
  } catch {
    return DEFAULT_SHARE_PREFERENCES;
  }
};

export const readSharePreferences = (): SharePreferences => {
  try {
    return parseSharePreferences(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_SHARE_PREFERENCES;
  }
};

export const writeSharePreferences = (preferences: SharePreferences) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Preferência é conveniência: sem storage, o compartilhamento segue com o padrão.
  }
};
