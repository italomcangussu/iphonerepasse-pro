import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const migrationsDir = path.join(process.cwd(), 'supabase/migrations');

const migrationsNewestFirst = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .reverse()
  .map((file) => readFileSync(path.join(migrationsDir, file), 'utf8'));

const latestDefinitionOf = (fnName: string): string =>
  migrationsNewestFirst.find((sql) => sql.includes(`create or replace function public.${fnName}`)) ?? '';

describe('reservation deposit is booked exactly once across the sale flow', () => {
  it('financial side effects skip reservation_deposit payments (the deposit IN already exists)', () => {
    const sql = latestDefinitionOf('pdv_create_sale_financial_side_effects');

    // O sinal vira transação IN "Adiantamento de reserva" na criação da
    // reserva. Se o loop de efeitos financeiros da venda não pular o
    // pagamento source='reservation_deposit', o mesmo dinheiro entra duas
    // vezes no extrato.
    expect(sql).toMatch(/if\s+v_payment\.source\s*=\s*'reservation_deposit'\s+then\s+continue;/);
  });

  it('blocks inserting a sale that sells a reserved item without its deposit payment', () => {
    const sql = latestDefinitionOf('pdv_apply_reservation_deposit_payments');

    // Guard de inserção (espelho do guard já existente no rebuild/edição):
    // vender um aparelho com reserva ativa e sinal pago SEM o pagamento
    // "Sinal já pago" vinculado deixaria o "Adiantamento de reserva" no
    // extrato E lançaria o total cheio como "Venda" — sinal contado 2x.
    expect(sql).toContain("sr.status = 'active'");
    expect(sql).toContain('sr.deposit_transaction_id is not null');
    expect(sql).toMatch(/raise exception '[^']*reserva ativa com sinal pago[^']*'/);
  });

  it('runs the reserved-item guard even when the sale has no reservation_deposit payments', () => {
    const sql = latestDefinitionOf('pdv_apply_reservation_deposit_payments');

    const guardIdx = sql.indexOf('reserva ativa com sinal pago');
    const earlyReturnIdx = sql.search(/if\s+coalesce\(v_expected_count,\s*0\)\s*=\s*0\s+then\s+return;/);

    // A venda quebrada é exatamente a que chega SEM nenhum pagamento de
    // sinal — o guard precisa rodar antes do early-return de
    // "nenhum sinal nesta venda".
    expect(guardIdx).toBeGreaterThan(-1);
    expect(earlyReturnIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(earlyReturnIdx);
  });
});
