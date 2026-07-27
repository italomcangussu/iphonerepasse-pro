import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationName = readdirSync('supabase/migrations').find((name) => name.endsWith('_rfm_broadcast_recipient_filters.sql'));
const source = migrationName ? readFileSync(`supabase/migrations/${migrationName}`, 'utf8') : '';

describe('rfm broadcast recipient filter migration', () => {
  it('trata lead_ids como restrição fechada dentro da função de preparo', () => {
    expect(source).toContain('create or replace function public.prepare_broadcast_recipients');
    expect(source).toContain("v_broadcast.recipient_filters ? 'lead_ids'");
    expect(source).toContain('jsonb_array_elements_text(');
    expect(source).toContain("jsonb_typeof(v_broadcast.recipient_filters -> 'lead_ids') = 'array'");
    expect(source).toContain('l.id = any (v_explicit_lead_ids)');
    expect(source).toContain('l.store_id = v_broadcast.store_id');
  });
});
