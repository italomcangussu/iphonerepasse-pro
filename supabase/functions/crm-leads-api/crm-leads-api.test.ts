import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('supabase/functions/crm-leads-api/index.ts', 'utf8');

describe('crm-leads-api edge function contract', () => {
  it('accepts the internal n8n API key as an alternative to user bearer auth', () => {
    expect(source).toContain('CRM_N8N_API_KEY');
    expect(source).toContain('x-api-key');
    expect(source).toContain('requireAuthenticatedRole(req, supabase)');
    expect(source).toContain('Unauthorized. Use x-api-key ou Bearer válido.');
  });

  it('forwards sales_stage filters to the lead search RPC', () => {
    expect(source).toContain('url.searchParams.get("sales_stage")');
    expect(source).toContain('filters.sales_stage = salesStage');
  });
});
