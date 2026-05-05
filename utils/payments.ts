import type { PaymentMethod } from '../types';

export const PDV_PAYMENT_METHODS: PaymentMethod['type'][] = ['Pix', 'Dinheiro', 'Cartão', 'Cartão Débito', 'Devedor'];

export const getPaymentTypeLabel = (type: PaymentMethod['type']): string =>
  type === 'Cartão' ? 'Cartão Crédito' : type;
