import { describe, expect, it } from 'vitest';
import { Condition } from '../../types';
import { clearPdvDraft, PDV_DRAFT_KEY, readPdvDraft, writePdvDraft, type PdvDraft } from './pdvDraft';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
};

describe('PDV draft persistence', () => {
  const draft: PdvDraft = {
    selectedStore: 'store-1',
    selectedSeller: 'seller-1',
    selectedClient: 'customer-1',
    cartItemIds: ['stock-1'],
    productConditionFilter: Condition.USED,
    payments: [{ type: 'Pix', amount: 100, account: 'Conta Bancária' }],
    commission: 50,
    negotiatedPriceInput: '3000.00'
  };

  it('ignores invalid JSON and version mismatches', () => {
    const storage = createStorage();

    storage.setItem(PDV_DRAFT_KEY, '{');
    expect(readPdvDraft(storage)).toBeNull();

    storage.setItem(PDV_DRAFT_KEY, JSON.stringify({ version: 999, draft }));
    expect(readPdvDraft(storage)).toBeNull();
  });

  it('writes, reads and clears a versioned draft', () => {
    const storage = createStorage();

    expect(readPdvDraft(storage)).toBeNull();
    writePdvDraft(storage, draft);
    expect(readPdvDraft(storage)).toEqual(draft);
    clearPdvDraft(storage);
    expect(storage.getItem(PDV_DRAFT_KEY)).toBeNull();
  });

  it('restores legacy unversioned drafts for compatibility', () => {
    const storage = createStorage();

    storage.setItem(PDV_DRAFT_KEY, JSON.stringify(draft));

    expect(readPdvDraft(storage)).toEqual(draft);
  });
});
