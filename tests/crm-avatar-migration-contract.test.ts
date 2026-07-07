import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20260707143741_crm_uaz_avatar_pipeline_hardening.sql',
  'utf8',
).toLowerCase();

describe('CRM UAZ avatar pipeline migration', () => {
  it('publishes lead avatar updates and stops public bucket listing', () => {
    expect(sql).toContain('alter publication supabase_realtime add table public.crm_leads');
    expect(sql).toContain('drop policy if exists "public read crm media" on storage.objects');
    expect(sql).not.toContain('create policy "public read crm media"');
  });

  it('adds durable avatar state and one coalesced job per lead', () => {
    expect(sql).toContain('avatar_storage_path text');
    expect(sql).toContain('avatar_content_hash text');
    expect(sql).toContain('avatar_missing_count integer not null default 0');
    expect(sql).toContain('avatar_missing_since timestamptz');
    expect(sql).toContain('create table public.crm_uaz_avatar_jobs');
    expect(sql).toContain('lead_id text not null unique');
    expect(sql).toContain('available_at timestamptz not null default now()');
    expect(sql).toContain('lease_expires_at timestamptz');
  });

  it('protects the job table and RPCs from browser roles', () => {
    expect(sql).toContain('alter table public.crm_uaz_avatar_jobs enable row level security');
    expect(sql).toContain('revoke all on public.crm_uaz_avatar_jobs from anon, authenticated');
    expect(sql).toContain('grant all on public.crm_uaz_avatar_jobs to service_role');
    expect(sql).toContain('revoke all on function public.enqueue_crm_uaz_avatar_job');
    expect(sql).toContain('revoke all on function public.claim_crm_uaz_avatar_jobs');
    expect(sql).toContain('revoke all on function public.complete_crm_uaz_avatar_job');
  });

  it('claims due jobs atomically and keeps store context in every RPC', () => {
    expect(sql).toContain('for update skip locked');
    expect(sql).toContain('p_store_id text');
    expect(sql).toContain('where store_id = p_store_id');
    expect(sql).toContain('and attempts = p_attempt');
    expect(sql).toContain('on conflict (lead_id) do update');
    expect(sql).toContain('notify pgrst');
  });
});
