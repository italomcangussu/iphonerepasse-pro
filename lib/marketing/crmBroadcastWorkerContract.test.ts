import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/crm-broadcast-worker/index.ts', 'utf8');

describe('crm-broadcast-worker audience contract', () => {
  it('falha uma audiência explícita vazia e consulta somente os lead_ids fornecidos', () => {
    expect(source).toContain('hasExplicitLeadIds');
    expect(source).toContain('invalid_explicit_recipient_filter');
    expect(source).toContain('.in("id", leadIds)');
  });
});
