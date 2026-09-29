import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const migrationsDir = path.join(process.cwd(), 'supabase/migrations');

const latestApplyDepositSql = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .reverse()
  .map((file) => readFileSync(path.join(migrationsDir, file), 'utf8'))
  .find((sql) => sql.includes('function public.pdv_apply_reservation_deposit_payments')) ?? '';

const latestRebuildSaleSql = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .reverse()
  .map((file) => readFileSync(path.join(migrationsDir, file), 'utf8'))
  .find((sql) => sql.includes('function public.pdv_rebuild_sale_full_payload')) ?? '';

describe('venda encerra também a reserva sem sinal', () => {
  it('marca a reserva sem sinal como vendida antes do early-return', () => {
    // Sem isso a função retorna cedo (não há pagamento de sinal) e a reserva
    // fica 'active' num aparelho 'Vendido'.
    const noDepositUpdateIdx = latestApplyDepositSql.indexOf("and coalesce(sr.deposit_amount, 0) = 0");
    const earlyReturnIdx = latestApplyDepositSql.indexOf('if coalesce(v_expected_count, 0) = 0 then');

    expect(noDepositUpdateIdx).toBeGreaterThan(-1);
    expect(earlyReturnIdx).toBeGreaterThan(-1);
    expect(noDepositUpdateIdx).toBeLessThan(earlyReturnIdx);
    expect(latestApplyDepositSql).toContain('sold_sale_id = p_sale_id');
  });

  it('preserva o guard de duplicidade do sinal já pago', () => {
    // Reservas COM sinal seguem o caminho de sempre: vender sem incluir o
    // pagamento duplicaria o adiantamento no caixa.
    expect(latestApplyDepositSql).toContain('Aparelho com reserva ativa com sinal pago');
    expect(latestApplyDepositSql).toContain('Sinal de reserva invalido para a venda.');
    expect(latestApplyDepositSql).toContain('Pagamento de sinal da reserva sem vinculo com a reserva.');
  });

  it('religa as reservas órfãs já existentes ao histórico da venda', () => {
    expect(latestApplyDepositSql).toContain("and sit.status = 'Vendido'");
    expect(latestApplyDepositSql).toContain('from public.sale_items si');
  });
});

describe('edição de venda com reserva sem sinal', () => {
  it('só bloqueia a edição se a reserva consumida tinha sinal pago', () => {
    // Se a reserva consumida tinha deposit_amount > 0, remover o pagamento do sinal
    // duplicaria o valor no caixa.
    expect(latestRebuildSaleSql).toContain('if coalesce(v_reservation.deposit_amount, 0) > 0 then');
    expect(latestRebuildSaleSql).toContain('Este aparelho foi vendido usando o sinal de uma reserva.');
  });

  it('permite editar a venda quando a reserva não tinha sinal pago', () => {
    // Quando a reserva tinha sinal zero (coalesce(deposit_amount, 0) = 0), a venda
    // não tem pagamento de sinal e a edição deve continuar normalmente (ex: trocar conta para Cofre).
    const depositGuardIdx = latestRebuildSaleSql.indexOf('if coalesce(v_reservation.deposit_amount, 0) > 0 then');
    const continueIdx = latestRebuildSaleSql.indexOf('continue;', depositGuardIdx);

    expect(depositGuardIdx).toBeGreaterThan(-1);
    expect(continueIdx).toBeGreaterThan(-1);
  });

  it('reativa a reserva se o aparelho foi removido da venda durante a edição', () => {
    expect(latestRebuildSaleSql).toContain("set status = 'active'");
    expect(latestRebuildSaleSql).toContain("set status = 'Reservado'");
  });
});

