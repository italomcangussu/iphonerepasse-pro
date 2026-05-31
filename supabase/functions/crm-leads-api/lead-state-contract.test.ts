import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const functionSource = readFileSync('supabase/functions/crm-leads-api/index.ts', 'utf8');
const migrationSource = readFileSync('supabase/migrations/20260529170000_crm_lead_state.sql', 'utf8');

describe('crm lead_state contract', () => {
  it('creates lead_state with store-scoped RLS and state constraints', () => {
    expect(migrationSource).toContain('create table if not exists public.lead_state');
    expect(migrationSource).toContain('lead_id text primary key references public.crm_leads(id) on delete cascade');
    expect(migrationSource).toContain('simulation_count integer not null default 0');
    expect(migrationSource).toContain('check (simulation_count between 0 and 3)');
    expect(migrationSource).toContain('check (tradein_battery_pct is null or tradein_battery_pct between 0 and 100)');
    expect(migrationSource).toContain('public.crm_can_access_store(l.store_id)');
    expect(migrationSource).toContain('create or replace function public.upsert_lead_state');
    expect(migrationSource).toContain('create index if not exists idx_lead_state_stock_item_id');
  });

  it('exposes lead_state through crm-leads-api GET and POST', () => {
    expect(functionSource).toContain('include_state');
    expect(functionSource).toContain('const isN8NRequest = checkN8NKey(req)');
    expect(functionSource).toContain('url.searchParams.get("include_state") !== "false"');
    expect(functionSource).toContain('upsert_lead_state');
    expect(functionSource).toContain('lead_state');
    expect(functionSource).toContain('p_state: state');
  });
});
