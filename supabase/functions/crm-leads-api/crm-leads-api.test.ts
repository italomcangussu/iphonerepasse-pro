import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('supabase/functions/crm-leads-api/index.ts', 'utf8');
const stripWebhookMigrationSource = readFileSync('supabase/migrations/20260529171500_strip_webhook_payload_from_lead_api.sql', 'utf8');
const latestChangeMigrationSource = readFileSync('supabase/migrations/20260529173000_get_lead_full_data_latest_change.sql', 'utf8');
const latestConversationMigrationSource = readFileSync('supabase/migrations/20260529174000_get_lead_full_data_latest_conversation.sql', 'utf8');
const latestMessageMigrationSource = readFileSync('supabase/migrations/20260529174500_get_lead_full_data_latest_message.sql', 'utf8');

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

  it('strips webhook_payload from get lead message payloads', () => {
    expect(stripWebhookMigrationSource).toContain('create or replace function public.get_lead_full_data');
    expect(stripWebhookMigrationSource).toContain("to_jsonb(m) - 'webhook_payload'");
    expect(stripWebhookMigrationSource).toContain("'source_channel', case");
    expect(stripWebhookMigrationSource).not.toContain("'api_key', ch.api_key");
    expect(stripWebhookMigrationSource).not.toContain("'uaz_admin_token', ch.uaz_admin_token");
    expect(stripWebhookMigrationSource).not.toContain("'webhook_secret', ch.webhook_secret");
  });

  it('returns all crm_leads columns and only the latest stage change', () => {
    expect(latestChangeMigrationSource).toContain('select to_jsonb(l)');
    expect(latestChangeMigrationSource).toContain('from public.crm_leads l');
    expect(latestChangeMigrationSource).toContain('from public.crm_lead_stage_history h');
    expect(latestChangeMigrationSource).toContain('limit 1');
    expect(latestChangeMigrationSource).toContain("to_jsonb(m) - 'webhook_payload'");
  });

  it('returns only the latest conversation in get lead', () => {
    expect(latestConversationMigrationSource).toContain('from public.crm_conversations c');
    expect(latestConversationMigrationSource).toContain('order by c.last_message_at desc nulls last, c.created_at desc, c.id desc');
    expect(latestConversationMigrationSource).toContain('limit 1');
  });

  it('returns only the latest message in the latest conversation', () => {
    expect(latestMessageMigrationSource).toContain('from public.crm_messages m');
    expect(latestMessageMigrationSource).toContain('order by m.created_at desc, m.id desc');
    expect(latestMessageMigrationSource).toContain('limit 1');
    expect(latestMessageMigrationSource).toContain("to_jsonb(m) - 'webhook_payload'");
  });
});
