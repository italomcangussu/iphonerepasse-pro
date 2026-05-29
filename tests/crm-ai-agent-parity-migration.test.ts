import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20260529130000_crm_ai_agent_parity.sql', 'utf8');

describe('CRM AI agent parity migration', () => {
  it('adds channel webhook, AI config, invocation, and ownership contracts', () => {
    expect(sql).toContain('ai_resume_webhook_url');
    expect(sql).toContain('create table if not exists public.crm_ai_entry_settings');
    expect(sql).toContain('create table if not exists public.crm_ai_agent_invocations');
    expect(sql).toContain('conversation_status');
    expect(sql).toContain('attendance_owner');
    expect(sql).toContain('human_started_at');
    expect(sql).toContain('ai_inbound');
  });
});
