import { describe, expect, it } from 'vitest';
import { PDV_PAYMENT_METHODS } from './payments';

describe('PDV payment methods', () => {
  it('keeps the expected payment methods and removes legacy labels', () => {
    expect(PDV_PAYMENT_METHODS).toEqual(['Pix', 'Dinheiro', 'Cartão', 'Devedor']);
    expect(PDV_PAYMENT_METHODS).not.toContain('Cartão Crédito');
    expect(PDV_PAYMENT_METHODS).not.toContain('Cartão Débito');
  });
});
