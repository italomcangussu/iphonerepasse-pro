import { describe, expect, it } from 'vitest';
import { DEFAULT_SHARE_PREFERENCES, parseSharePreferences } from './sharePreferences';
import { resolveDefaultShareScope } from './inventoryViewModel';

describe('parseSharePreferences', () => {
  it('falls back to cash-only defaults when nothing is stored or the value is corrupt', () => {
    expect(parseSharePreferences(null)).toEqual(DEFAULT_SHARE_PREFERENCES);
    expect(parseSharePreferences('{not json')).toEqual(DEFAULT_SHARE_PREFERENCES);
    expect(DEFAULT_SHARE_PREFERENCES.priceMode).toBe('cash');
  });

  it('keeps a valid stored choice and rejects out-of-range installments', () => {
    expect(parseSharePreferences('{"priceMode":"installments","installments":10}')).toEqual({ priceMode: 'installments', installments: 10 });
    expect(parseSharePreferences('{"priceMode":"installments","installments":99}').installments).toBe(DEFAULT_SHARE_PREFERENCES.installments);
  });
});

describe('resolveDefaultShareScope', () => {
  it('prefers the picked devices, then the filtered screen, then the whole available stock', () => {
    expect(resolveDefaultShareScope({ selectedCount: 2, filteredCount: 5, hasActiveFilters: true })).toBe('selected');
    expect(resolveDefaultShareScope({ selectedCount: 0, filteredCount: 5, hasActiveFilters: true })).toBe('filtered');
    expect(resolveDefaultShareScope({ selectedCount: 0, filteredCount: 0, hasActiveFilters: true })).toBe('available');
    expect(resolveDefaultShareScope({ selectedCount: 0, filteredCount: 5, hasActiveFilters: false })).toBe('available');
  });
});

describe('buildStockShareText for hand-picked lists', () => {
  it('omits an empty condition group and the card line when sharing cash-only', async () => {
    const { buildStockShareText } = await import('./inventoryViewModel');
    const { Condition, StockStatus } = await import('../../types');
    const item = {
      id: 'stk-1', model: 'iPhone 16', capacity: '128GB', color: 'Preto', condition: Condition.NEW,
      status: StockStatus.AVAILABLE, sellPrice: 5000, purchasePrice: 4000, batteryHealth: 100, storeId: 's1', entryDate: '2026-10-01'
    } as unknown as import('../../types').StockItem;

    const text = buildStockShareText([item], 'whatsapp');

    expect(text).toContain('🆕 *NOVOS*');
    expect(text).not.toContain('SEMINOVOS');
    expect(text).not.toContain('💳');
  });
});
