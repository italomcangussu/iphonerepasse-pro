import type { Customer } from '../../types';
import type { CustomerRfm } from './campaigns';

export interface AudienceStats {
  count: number;
  totalSpent: number;
  totalPurchases: number;
  avgTicket: number;
}

export function matchesMinimumRecency(
  customer: Pick<CustomerRfm, 'recencyDays'> | null | undefined,
  minDays: number
): boolean {
  return customer != null && customer.recencyDays >= minDays;
}

export function computeAudienceStats(customers: Customer[]): AudienceStats {
  const totalSpent = customers.reduce((sum, customer) => sum + (customer.totalSpent || 0), 0);
  const totalPurchases = customers.reduce((sum, customer) => sum + Math.max(0, customer.purchases || 0), 0);

  return {
    count: customers.length,
    totalSpent,
    totalPurchases,
    avgTicket: totalPurchases > 0 ? totalSpent / totalPurchases : 0,
  };
}
