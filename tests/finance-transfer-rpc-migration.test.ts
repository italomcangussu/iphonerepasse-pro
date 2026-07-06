import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
const migrationSql = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(path.join(migrationsDir, file), 'utf8'))
  .join('\n');

describe('finance transfer RPC migration', () => {
  it('defines the RPC signature used by the app and refreshes PostgREST cache', () => {
    expect(migrationSql.includes('create or replace function public.transfer_between_accounts(')).toBe(true);
    expect(migrationSql.includes('p_amount numeric')).toBe(true);
    expect(migrationSql.includes('p_from text')).toBe(true);
    expect(migrationSql.includes('p_to text')).toBe(true);
    expect(migrationSql.includes("grant execute on function public.transfer_between_accounts(numeric, text, text) to authenticated")).toBe(true);
    expect(migrationSql.includes("notify pgrst, 'reload schema'")).toBe(true);
  });

  it('keeps transfers atomic and linked for cancellation', () => {
    expect(migrationSql.includes("if public.current_role() is distinct from 'admin' then")).toBe(true);
    expect(migrationSql.includes("raise exception 'Selecione contas diferentes para transferir.'")).toBe(true);
    expect(migrationSql.includes('v_transfer_group_id')).toBe(true);
    expect(migrationSql.includes("description, account, transfer_group_id")).toBe(true);
    expect(migrationSql.includes("'Transferência para ' || p_to")).toBe(true);
    expect(migrationSql.includes("'Transferência de ' || p_from")).toBe(true);
  });
});
