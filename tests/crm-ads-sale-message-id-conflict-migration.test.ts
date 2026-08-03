import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
const migrationFile = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('_fix_crm_ads_sale_message_id_conflict.sql'))
  .sort()
  .at(-1);

const migrationSql = migrationFile
  ? readFileSync(path.join(migrationsDir, migrationFile), 'utf8')
  : '';

describe('CRM ads attribution message ownership migration', () => {
  it('keeps the original attribution as the sole owner of its message', () => {
    expect(migrationFile).toBeDefined();
    expect(migrationSql).toContain(
      'create or replace function public.crm_backfill_sale_ads_origin_from_phone_match(p_sale_id text)',
    );

    // `message_id` identifies one inbound CRM message and is intentionally
    // unique. Phone-based sale backfill may create a second attribution for a
    // canonical lead, but it must not transfer/copy that message to it.
    expect(migrationSql).toMatch(
      /message_id\s*=\s*case\s+when\s+ca\.message_id\s+is\s+not\s+null\s+then\s+ca\.message_id\s+when\s+v_ad\.message_id\s+is\s+not\s+null\s+and\s+not\s+exists[\s\S]*?other\.message_id\s*=\s+v_ad\.message_id[\s\S]*?then\s+v_ad\.message_id\s+else\s+null\s+end/i,
    );
    expect(migrationSql).toContain("'source_message_id', v_ad.message_id");
  });
});
