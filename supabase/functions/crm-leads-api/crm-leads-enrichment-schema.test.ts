import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migrationPath = 'supabase/migrations/20260529162000_crm_leads_enriched_agent_payload.sql';

describe('crm leads enriched agent payload schema', () => {
  it('persists agent summary and stage fields on crm_leads and exposes them in search_leads', () => {
    const source = readFileSync(migrationPath, 'utf8');

    [
      'summary_operational',
      'summary_short',
      'last_message_content',
      'first_name',
      'sales_stage',
      'last_event_name',
      'last_event_at',
    ].forEach((field) => expect(source).toContain(field));

    expect(source).toContain('chk_crm_leads_sales_stage');
    expect(source).toContain("'reserva_pendente'");
    expect(source).toContain('create or replace function public.search_leads');
    expect(source).toContain('trg_crm_messages_sync_lead_last_message_content');
    expect(source).toContain('trg_crm_event_log_sync_lead_last_event');
  });

  it('exposes the official lead memory update action through crm-leads-api', () => {
    const source = readFileSync('supabase/functions/crm-leads-api/index.ts', 'utf8');

    expect(source).toContain('action === "update_memory"');
    expect(source).toContain('update_lead_memory');
    expect(source).toContain('p_summary_short');
    expect(source).toContain('p_summary_operational');
  });
});
