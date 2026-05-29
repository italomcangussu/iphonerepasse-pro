import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('supabase/functions/crm-n8n-api/index.ts', 'utf8');

describe('crm-n8n-api edge function contract', () => {
  it('normalizes upsert lead phone numbers before calling CRM lead RPCs', () => {
    expect(source).toContain('normalizePhone');
    expect(source).toContain('const normalizedPhone = normalizePhone(payload.phone)');
    expect(source).toContain('p_phone: normalizedPhone');
  });

  it('returns the full lead row after an upsert', () => {
    expect(source).toContain('fetchLeadById');
    expect(source).toContain('.from("crm_leads")');
    expect(source).toContain('.select("*")');
    expect(source).toContain('return jsonResponse({ success: true, leadId, lead })');
  });
});
