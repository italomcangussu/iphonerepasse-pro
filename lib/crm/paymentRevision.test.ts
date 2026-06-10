import { describe, expect, it } from 'vitest';
import {
  calculateMixedGroupCards,
  normalizeCardGroup,
  splitSameGroupTaxedTotal,
  validateCardAllocations,
} from './paymentRevision';

describe('payment revision card groups', () => {
  it('normalizes individual brands into configured fee groups', () => {
    expect(normalizeCardGroup('visa')).toBe('visa_master');
    expect(normalizeCardGroup('mastercard')).toBe('visa_master');
    expect(normalizeCardGroup('elo')).toBe('outras');
    expect(normalizeCardGroup('hipercard')).toBe('outras');
    expect(normalizeCardGroup('amex')).toBe('outras');
  });

  it('splits an already taxed same-group total without recalculating fees', () => {
    expect(splitSameGroupTaxedTotal({
      taxedTotal: 5850,
      installments: 10,
      cards: [
        { brand: 'visa', amount: 3000 },
        { brand: 'master', amount: 2850 },
      ],
    })).toEqual([
      { brand: 'visa', group: 'visa_master', total: 3000, installments: 10, installmentAmount: 300 },
      { brand: 'master', group: 'visa_master', total: 2850, installments: 10, installmentAmount: 285 },
    ]);
  });

  it('rejects a same-group split that does not close the taxed total', () => {
    expect(() => splitSameGroupTaxedTotal({
      taxedTotal: 5850,
      installments: 10,
      cards: [
        { brand: 'visa', amount: 3000 },
        { brand: 'master', amount: 2800 },
      ],
    })).toThrow(/total com taxa/i);
  });

  it('calculates each different fee group from its allocated net amount', () => {
    const result = calculateMixedGroupCards({
      netTotal: 5000,
      installments: 10,
      cards: [
        { brand: 'visa', amount: 3000 },
        { brand: 'elo', amount: 2000 },
      ],
      feeRates: {
        visa_master: 10,
        outras: 20,
      },
    });

    expect(result.cards[0]).toMatchObject({
      group: 'visa_master',
      netAmount: 3000,
      taxedTotal: 3333.33,
      installmentAmount: 333.33,
    });
    expect(result.cards[1]).toMatchObject({
      group: 'outras',
      netAmount: 2000,
      taxedTotal: 2500,
      installmentAmount: 250,
    });
    expect(result.taxedTotal).toBe(5833.33);
  });

  it('validates that net allocations close the financed amount', () => {
    expect(validateCardAllocations(5000, [
      { brand: 'visa', amount: 3000 },
      { brand: 'elo', amount: 2000 },
    ])).toBe(true);

    expect(validateCardAllocations(5000, [
      { brand: 'visa', amount: 3000 },
      { brand: 'elo', amount: 1999.99 },
    ])).toBe(false);
  });
});
