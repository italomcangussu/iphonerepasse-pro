import { describe, expect, it } from 'vitest';
import type { Customer } from '../../types';
import type { CustomerRfm } from './campaigns';
import { computeAudienceStats, matchesMinimumRecency } from './audience';

const customer = (overrides: Partial<Customer>): Customer => ({
  id: 'customer-1',
  name: 'Cliente',
  cpf: '',
  phone: '',
  email: '',
  purchases: 0,
  totalSpent: 0,
  ...overrides,
});

const rfm = (recencyDays: number): CustomerRfm => ({
  customerId: 'customer-1',
  name: 'Cliente',
  phone: '',
  email: '',
  recencyDays,
  frequency: 1,
  monetary: 1000,
  firstPurchaseDays: recencyDays,
  lastPurchaseDate: '2026-01-01',
  lastModelKey: 'iPhone 13',
  segment: 'dormant',
});

describe('audience helpers', () => {
  it('exige histórico de compra para passar em um filtro de recência', () => {
    expect(matchesMinimumRecency(undefined, 60)).toBe(false);
    expect(matchesMinimumRecency(rfm(59), 60)).toBe(false);
    expect(matchesMinimumRecency(rfm(60), 60)).toBe(true);
  });

  it('calcula ticket pela quantidade de compras, não pela quantidade de clientes', () => {
    const stats = computeAudienceStats([
      customer({ id: 'c1', purchases: 2, totalSpent: 2000 }),
      customer({ id: 'c2', purchases: 1, totalSpent: 1000 }),
    ]);

    expect(stats).toEqual({
      count: 2,
      totalSpent: 3000,
      totalPurchases: 3,
      avgTicket: 1000,
    });
  });
});
