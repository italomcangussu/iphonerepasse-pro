export interface BroadcastRecipientFilters {
  hasExplicitLeadIds: boolean;
  leadIds: string[];
  funnelStage: string;
  isCustomer: boolean | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * `lead_ids` torna a audiência explícita. Mesmo uma lista inválida ou vazia
 * precisa permanecer explícita para que o worker jamais amplie o disparo.
 */
export function extractBroadcastRecipientFilters(value: unknown): BroadcastRecipientFilters {
  const filters = asRecord(value);
  const hasExplicitLeadIds = Object.prototype.hasOwnProperty.call(filters, 'lead_ids');
  const leadIds = hasExplicitLeadIds && Array.isArray(filters.lead_ids)
    ? Array.from(new Set(filters.lead_ids.map(cleanText).filter(Boolean)))
    : [];

  return {
    hasExplicitLeadIds,
    leadIds,
    funnelStage: cleanText(filters.funnel_stage),
    isCustomer: typeof filters.is_customer === 'boolean' ? filters.is_customer : null,
  };
}
