import { describe, expect, it } from 'vitest';
import type { Sale } from '../../types';
import type { CampaignSegment, CustomerRfm } from './campaigns';
import { resolveRfmRecipients } from './rfmRecipients';

const rfmCustomer = (
  customerId: string,
  monetary: number,
  segment: CampaignSegment = 'dormant'
): CustomerRfm => ({
  customerId,
  name: customerId,
  phone: '',
  email: '',
  recencyDays: 180,
  frequency: 1,
  monetary,
  firstPurchaseDays: 180,
  lastPurchaseDate: '2026-01-01',
  lastModelKey: 'iPhone',
  segment,
});

const sale = (overrides: Partial<Sale>): Sale => ({
  id: 'sale-1',
  customerId: 'customer-1',
  sellerId: 'seller-1',
  items: [],
  tradeInValue: 0,
  discount: 0,
  total: 0,
  paymentMethods: [],
  date: '2026-01-01',
  warrantyExpiresAt: null,
  ...overrides,
});

describe('resolveRfmRecipients', () => {
  it('mantém somente o vínculo CRM mais recente de cada cliente do segmento e da loja', () => {
    const result = resolveRfmRecipients({
      customers: [
        rfmCustomer('customer-high', 10_000),
        rfmCustomer('customer-mid', 5_000),
        rfmCustomer('customer-without-link', 2_000),
        rfmCustomer('customer-new', 1_000, 'new'),
      ],
      sales: [
        sale({ id: 'old', customerId: 'customer-high', crmLeadId: 'lead-old', storeId: 'store-1', date: '2025-10-01' }),
        sale({ id: 'latest', customerId: 'customer-high', crmLeadId: 'lead-high', storeId: 'store-1', date: '2026-01-15' }),
        sale({ id: 'mid', customerId: 'customer-mid', crmLeadId: 'lead-mid', storeId: 'store-1', date: '2026-01-10' }),
        sale({ id: 'cross-store', customerId: 'customer-without-link', crmLeadId: 'lead-other-store', storeId: 'store-2', date: '2026-01-20' }),
      ],
      storeId: 'store-1',
      segment: 'dormant',
    });

    expect(result).toEqual({
      targetCustomers: 3,
      linkedCustomers: 2,
      unlinkedCustomers: 1,
      omittedByLimit: 0,
      leadIds: ['lead-high', 'lead-mid'],
    });
  });

  it('prioriza os clientes de maior valor quando o segmento supera o limite de envio', () => {
    const result = resolveRfmRecipients({
      customers: [
        rfmCustomer('customer-low', 1_000),
        rfmCustomer('customer-high', 9_000),
        rfmCustomer('customer-mid', 5_000),
      ],
      sales: [
        sale({ id: 'low', customerId: 'customer-low', crmLeadId: 'lead-low', storeId: 'store-1' }),
        sale({ id: 'high', customerId: 'customer-high', crmLeadId: 'lead-high', storeId: 'store-1' }),
        sale({ id: 'mid', customerId: 'customer-mid', crmLeadId: 'lead-mid', storeId: 'store-1' }),
      ],
      storeId: 'store-1',
      segment: 'dormant',
      limit: 2,
    });

    expect(result.leadIds).toEqual(['lead-high', 'lead-mid']);
    expect(result.linkedCustomers).toBe(3);
    expect(result.omittedByLimit).toBe(1);
  });
});
