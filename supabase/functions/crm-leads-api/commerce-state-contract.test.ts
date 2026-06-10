import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migrationPath = 'supabase/migrations/20260610150000_repasse_commerce_state.sql';
const migration = readFileSync(migrationPath, 'utf8');
const api = readFileSync('supabase/functions/crm-leads-api/index.ts', 'utf8');

describe('repasse canonical commerce state contract', () => {
  it('adds versioned JSON state beside legacy lead_state fields', () => {
    expect(migration).toContain("commerce_state jsonb not null default '{}'::jsonb");
    expect(migration).toContain("tradein_assessment jsonb not null default '{}'::jsonb");
    expect(migration).toContain("quote_versions jsonb not null default '[]'::jsonb");
    expect(migration).toContain('state_version bigint not null default 0');
  });

  it('uses optimistic concurrency when updating commerce state', () => {
    expect(migration).toContain('create or replace function public.upsert_repasse_commerce_state');
    expect(migration).toContain('p_expected_version bigint');
    expect(migration).toContain('for update');
    expect(migration).toContain('stale commerce state version');
    expect(migration).toContain('state_version = state_version + 1');
  });

  it('records structured AI turn telemetry', () => {
    expect(migration).toContain('create table if not exists public.ai_turn_events');
    expect(migration).toContain('turn_id text not null');
    expect(migration).toContain('conversation_id uuid');
    expect(migration).toContain('action text not null');
    expect(migration).toContain('duration_ms integer');
    expect(migration).toContain('metadata jsonb');
    expect(migration).toContain('create or replace function public.record_ai_turn_event');
  });

  it('exposes canonical state and telemetry actions through crm-leads-api', () => {
    expect(api).toContain('"commerce_state"');
    expect(api).toContain('"tradein_assessment"');
    expect(api).toContain('"quote_versions"');
    expect(api).toContain('"state_version"');
    expect(api).toContain('action === "upsert_commerce_state"');
    expect(api).toContain('upsert_repasse_commerce_state');
    expect(api).toContain('action === "record_ai_turn_event"');
    expect(api).toContain('record_ai_turn_event');
  });
});
