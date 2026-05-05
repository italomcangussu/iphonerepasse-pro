import { describe, expect, it } from 'vitest';
import { PDV_PAYMENT_METHODS } from './payments';

describe('PDV payment methods', () => {
  it('keeps the expected payment methods including debit card', () => {
    expect(PDV_PAYMENT_METHODS).toEqual(['Pix', 'Dinheiro', 'Cartão', 'Cartão Débito', 'Devedor']);
    expect(PDV_PAYMENT_METHODS).not.toContain('Cartão Crédito');
  });
});
