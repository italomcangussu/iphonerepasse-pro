import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const migrationsDir = path.join(process.cwd(), 'supabase/migrations');

const latestCancelSaleMigrationSql = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .reverse()
  .map((file) => readFileSync(path.join(migrationsDir, file), 'utf8'))
  .find((sql) => sql.includes('function public.cancel_sale')) ?? '';

describe('cancel_sale restores reservations consumed by the sale', () => {
  it('captures sold reservations before the delete nulls their sold_sale_id', () => {
    const captureIdx = latestCancelSaleMigrationSql.indexOf('where sold_sale_id = p_sale_id');
    const deleteIdx = latestCancelSaleMigrationSql.indexOf('delete from public.sales where id = p_sale_id');

    expect(captureIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeGreaterThan(-1);
    // The reservation ids must be read BEFORE the delete, because the
    // sold_sale_id FK is `on delete set null` and gets wiped by the delete.
    expect(captureIdx).toBeLessThan(deleteIdx);
    expect(latestCancelSaleMigrationSql).toContain("and status = 'sold'");
  });

  it('reactivates the reservation and returns the device to Reservado', () => {
    expect(latestCancelSaleMigrationSql).toContain("set status = 'active'");
    expect(latestCancelSaleMigrationSql).toContain("set status = 'Reservado'");
    // Reactivation must happen after the delete (the delete trigger forces the
    // device to 'Disponível'; cancel_sale overrides it back to 'Reservado').
    const deleteIdx = latestCancelSaleMigrationSql.indexOf('delete from public.sales where id = p_sale_id');
    const reservedIdx = latestCancelSaleMigrationSql.indexOf("set status = 'Reservado'");
    expect(reservedIdx).toBeGreaterThan(deleteIdx);
  });

  it('keeps the deposit for a later refund/retain decision (no estorno on cancel)', () => {
    // The cancellation must NOT generate an "Estorno de reserva"; that decision
    // is deferred to release_stock_reservation.
    expect(latestCancelSaleMigrationSql).not.toContain('Estorno de reserva');
  });
});
