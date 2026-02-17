import { describe, expect, it } from 'vitest';
import {
  CARD_INSTALLMENTS_MAX,
  DEFAULT_CARD_FEE_SETTINGS,
  calculateCardCharge,
  getCardRate,
  normalizeCardFeeSettings
} from './cardFees';

describe('card fee helpers', () => {
  it('calculates customer amount from net amount and fee', () => {
    const charge = calculateCardCharge(1000, 4.09, 2);

    expect(charge.netAmount).toBe(1000);
    expect(charge.customerAmount).toBe(1042.64);
    expect(charge.feeAmount).toBe(42.64);
    expect(charge.installmentAmount).toBe(521.32);
  });

  it('returns expected rate by brand/installments', () => {
    expect(getCardRate(DEFAULT_CARD_FEE_SETTINGS, 'visa_master', 1)).toBe(2.99);
    expect(getCardRate(DEFAULT_CARD_FEE_SETTINGS, 'outras', 18)).toBe(16.37);
  });

  it('normalizes malformed settings', () => {
    const settings = normalizeCardFeeSettings({
      visaMasterRates: [1, 2, -5, 101] as number[],
      otherRates: [] as number[]
    });

    expect(settings.visaMasterRates).toHaveLength(CARD_INSTALLMENTS_MAX);
    expect(settings.otherRates).toHaveLength(CARD_INSTALLMENTS_MAX);
    expect(settings.visaMasterRates[0]).toBe(1);
    expect(settings.visaMasterRates[1]).toBe(2);
    expect(settings.visaMasterRates[2]).toBe(DEFAULT_CARD_FEE_SETTINGS.visaMasterRates[2]);
    expect(settings.visaMasterRates[3]).toBe(DEFAULT_CARD_FEE_SETTINGS.visaMasterRates[3]);
  });
});
