// Pure pricing math extracted from pages/PDV.tsx so it can be unit-tested in
// isolation (the component itself is a ~2.9k-LOC god-component). Behavior is a
// faithful copy of the inline calculation that lived in the PDV render body.

export const roundCurrency = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
};

export type DiscountInputType = 'amount' | 'percent';

export type DiscountConfig = {
  type: DiscountInputType;
  value: number;
};

export type PdvPricing = {
  /** Discount in currency, clamped to [0, negotiatedSubtotal]. */
  discountAmount: number;
  /** Discount as a percentage of the subtotal, or null when there is none. */
  discountPercent: number | null;
  /** Subtotal − discount − trade-in, before clamping at zero (may be negative). */
  rawTotalBeforeClamp: number;
  /** Positive amount owed back to the client when trade-ins exceed the total. */
  clientOwedAmount: number;
  /** Final amount the client must pay (never negative). */
  totalToPay: number;
};

/**
 * Compute the PDV pricing breakdown from the negotiated subtotal, the discount
 * configuration (flat amount or percentage) and the total trade-in value.
 */
export const computePdvPricing = (
  negotiatedSubtotal: number,
  discountConfig: DiscountConfig,
  tradeInValue: number
): PdvPricing => {
  const discountAmountRaw =
    discountConfig.type === 'percent'
      ? negotiatedSubtotal * (discountConfig.value / 100)
      : discountConfig.value;
  const discountAmount = roundCurrency(Math.min(Math.max(discountAmountRaw, 0), negotiatedSubtotal));
  const discountPercent =
    discountAmount > 0 && negotiatedSubtotal > 0
      ? roundCurrency((discountAmount / negotiatedSubtotal) * 100)
      : null;
  const rawTotalBeforeClamp = roundCurrency(negotiatedSubtotal - discountAmount - tradeInValue);
  const clientOwedAmount = rawTotalBeforeClamp < -0.009 ? roundCurrency(Math.abs(rawTotalBeforeClamp)) : 0;
  const totalToPay = roundCurrency(Math.max(0, rawTotalBeforeClamp));
  return { discountAmount, discountPercent, rawTotalBeforeClamp, clientOwedAmount, totalToPay };
};
