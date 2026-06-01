import { describe, it, expect } from 'vitest';
import { roundCurrency, computePdvPricing } from './pdvPricing';

describe('roundCurrency', () => {
  it('rounds to two decimal places', () => {
    expect(roundCurrency(2.344)).toBe(2.34);
    expect(roundCurrency(2.346)).toBe(2.35);
    expect(roundCurrency(10)).toBe(10);
  });

  it('inherits IEEE-754 rounding quirks (characterization, not a spec)', () => {
    // 1.005 * 100 === 100.49999999999999 in JS, so this rounds DOWN to 1.00.
    expect(roundCurrency(1.005)).toBe(1);
  });

  it('returns 0 for non-finite input', () => {
    expect(roundCurrency(NaN)).toBe(0);
    expect(roundCurrency(Infinity)).toBe(0);
    expect(roundCurrency(-Infinity)).toBe(0);
  });
});

describe('computePdvPricing', () => {
  it('applies a flat amount discount', () => {
    const p = computePdvPricing(1000, { type: 'amount', value: 100 }, 0);
    expect(p.discountAmount).toBe(100);
    expect(p.discountPercent).toBe(10);
    expect(p.totalToPay).toBe(900);
    expect(p.clientOwedAmount).toBe(0);
  });

  it('applies a percentage discount', () => {
    const p = computePdvPricing(1000, { type: 'percent', value: 25 }, 0);
    expect(p.discountAmount).toBe(250);
    expect(p.discountPercent).toBe(25);
    expect(p.totalToPay).toBe(750);
  });

  it('clamps the discount so it never exceeds the subtotal', () => {
    const p = computePdvPricing(500, { type: 'amount', value: 9999 }, 0);
    expect(p.discountAmount).toBe(500);
    expect(p.discountPercent).toBe(100);
    expect(p.totalToPay).toBe(0);
  });

  it('floors a negative discount at zero (no discount)', () => {
    const p = computePdvPricing(500, { type: 'amount', value: -50 }, 0);
    expect(p.discountAmount).toBe(0);
    expect(p.discountPercent).toBeNull();
    expect(p.totalToPay).toBe(500);
  });

  it('subtracts the trade-in value from the total', () => {
    const p = computePdvPricing(1000, { type: 'amount', value: 0 }, 300);
    expect(p.totalToPay).toBe(700);
    expect(p.clientOwedAmount).toBe(0);
  });

  it('reports clientOwedAmount when trade-ins exceed the total', () => {
    const p = computePdvPricing(500, { type: 'amount', value: 0 }, 800);
    expect(p.rawTotalBeforeClamp).toBe(-300);
    expect(p.totalToPay).toBe(0);
    expect(p.clientOwedAmount).toBe(300);
  });

  it('has no discount percent when subtotal is zero', () => {
    const p = computePdvPricing(0, { type: 'amount', value: 0 }, 0);
    expect(p.discountAmount).toBe(0);
    expect(p.discountPercent).toBeNull();
    expect(p.totalToPay).toBe(0);
  });

  it('keeps centavo precision across combined discount + trade-in', () => {
    const p = computePdvPricing(1999.99, { type: 'percent', value: 10 }, 199.99);
    expect(p.discountAmount).toBe(200);
    expect(p.totalToPay).toBe(1600);
  });
});
