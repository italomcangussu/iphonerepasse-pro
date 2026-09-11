import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const migrationsDir = path.join(process.cwd(), 'supabase/migrations');

const allMigrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => ({ file, sql: readFileSync(path.join(migrationsDir, file), 'utf8') }));

const latestWith = (needle: string) =>
  [...allMigrations].reverse().find((entry) => entry.sql.includes(needle))?.sql ?? '';

const debtInsertTrigger = latestWith('function public.handle_debt_after_insert');
const latestCancelTransaction = latestWith('function public.cancel_transaction');

describe('devedor avulso lança a saída no extrato', () => {
  it('cria a saída (OUT) na conta informada ao cadastrar', () => {
    expect(debtInsertTrigger).toContain("'OUT'");
    expect(debtInsertTrigger).toContain("'Saída de devedor'");
    expect(debtInsertTrigger).toContain('new.entry_account');
    expect(debtInsertTrigger).toContain('trg_debts_after_insert');
  });

  it('nunca lança saída para dívida originada de venda', () => {
    // O valor de uma dívida do PDV já faz parte do resultado da venda: lançar
    // a saída de novo tiraria o dinheiro duas vezes do caixa.
    expect(debtInsertTrigger).toContain("new.source = 'manual'");
    expect(debtInsertTrigger).toContain('new.sale_id is null');
  });

  it('mantém a saída em dia quando o valor da dívida é editado', () => {
    expect(debtInsertTrigger).toContain('function public.handle_debt_after_update');
    expect(debtInsertTrigger).toContain('new.original_amount is distinct from old.original_amount');
  });

  it('apaga a saída quando o devedor é excluído', () => {
    expect(debtInsertTrigger).toContain('function public.handle_debt_after_delete');
    expect(debtInsertTrigger).toContain('delete from public.transactions');
    expect(debtInsertTrigger).toContain('trg_debts_after_delete');
  });

  it('impede cancelar a saída direto pelo extrato', () => {
    // Reverter significa excluir o devedor (que dispara o trigger de delete);
    // apagar só o lançamento deixaria a dívida sem contrapartida no caixa.
    expect(latestCancelTransaction).toContain('v_trx.debt_id is not null');
    expect(latestCancelTransaction).toContain('exclua o devedor correspondente');
    // As proteções que já existiam continuam de pé.
    expect(latestCancelTransaction).toContain('v_trx.payable_debt_id is not null');
    expect(latestCancelTransaction).toContain('v_trx.transfer_group_id is not null');
  });

  it('não retroage lançamentos para as dívidas já cadastradas', () => {
    // Criar saídas com data de hoje para dívidas antigas reescreveria saldos
    // históricos: o ajuste dessas fica a critério do administrador.
    expect(debtInsertTrigger).not.toMatch(/insert into public\.transactions[\s\S]*from public\.debts/);
  });
});
