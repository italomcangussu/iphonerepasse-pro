import { describe, expect, it } from 'vitest';
import { extractBroadcastRecipientFilters } from '../../supabase/functions/_shared/broadcastRecipientFilters';

describe('extractBroadcastRecipientFilters', () => {
  it('identifica uma audiência explícita e normaliza IDs repetidos', () => {
    expect(extractBroadcastRecipientFilters({ lead_ids: [' lead-1 ', 'lead-2', 'lead-1', 3] })).toEqual({
      hasExplicitLeadIds: true,
      leadIds: ['lead-1', 'lead-2'],
      funnelStage: '',
      isCustomer: null,
    });
  });

  it('preserva uma lista explícita vazia para impedir fallback amplo', () => {
    expect(extractBroadcastRecipientFilters({ lead_ids: [] })).toEqual({
      hasExplicitLeadIds: true,
      leadIds: [],
      funnelStage: '',
      isCustomer: null,
    });
  });

  it('mantém os filtros genéricos quando não existe audiência explícita', () => {
    expect(extractBroadcastRecipientFilters({ funnel_stage: 'won', is_customer: true })).toEqual({
      hasExplicitLeadIds: false,
      leadIds: [],
      funnelStage: 'won',
      isCustomer: true,
    });
  });
});
