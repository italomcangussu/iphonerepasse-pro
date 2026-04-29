begin;

-- ============================================================
-- 1. Limpeza: apaga todos os pagamentos e dívidas ativas existentes
-- ============================================================
-- Pagamentos primeiro (cascade deleta transações OUT vinculadas via FK)
delete from public.payable_debt_payments;

-- Dívidas em seguida
delete from public.payable_debts;

-- Limpa transações órfãs de "Pagamento de dívida ativa" sem vínculo (segurança)
delete from public.transactions
where category = 'Pagamento de dívida ativa'
  and payable_debt_payment_id is null;

-- ============================================================
-- 2. Coluna entry_account na tabela payable_debts
--    Registra qual conta/caixa recebeu o valor ao cadastrar a dívida
-- ============================================================
alter table public.payable_debts
  add column if not exists entry_account text null
  check (entry_account in ('Conta Bancária', 'Cofre'));

-- ============================================================
-- 3. Coluna payable_debt_id na tabela transactions (referência suave)
--    Vincula a transação de entrada (IN) à dívida ativa que a originou
-- ============================================================
alter table public.transactions
  add column if not exists payable_debt_id text null;

create index if not exists idx_transactions_payable_debt_id
  on public.transactions (payable_debt_id);

-- ============================================================
-- 4. Trigger: após INSERT em payable_debts → cria transação IN de entrada
-- ============================================================
create or replace function public.handle_payable_debt_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Apenas dívidas manuais com conta informada geram entrada no caixa/banco
  if new.source = 'manual' and new.entry_account is not null then
    insert into public.transactions (
      id,
      type,
      category,
      amount,
      date,
      description,
      account,
      payable_debt_id
    )
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'IN',
      'Entrada de dívida ativa',
      new.original_amount,
      now(),
      'Entrada dívida ativa - ' || new.creditor_name,
      new.entry_account,
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payable_debts_after_insert on public.payable_debts;
create trigger trg_payable_debts_after_insert
after insert on public.payable_debts
for each row execute function public.handle_payable_debt_after_insert();

-- ============================================================
-- 5. Trigger: após DELETE em payable_debts → deleta transação IN vinculada
-- ============================================================
create or replace function public.handle_payable_debt_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.transactions
  where payable_debt_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_payable_debts_after_delete on public.payable_debts;
create trigger trg_payable_debts_after_delete
after delete on public.payable_debts
for each row execute function public.handle_payable_debt_after_delete();

-- ============================================================
-- 6. Atualiza cancel_transaction: bloqueia cancelamento direto de
--    transações de entrada de dívida ativa (devem ser removidas
--    excluindo a dívida na página Dívidas Ativas)
-- ============================================================
create or replace function public.cancel_transaction(p_transaction_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trx public.transactions%rowtype;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem cancelar lançamentos.'
      using errcode = '42501';
  end if;

  select * into v_trx
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Lançamento não encontrado: %', p_transaction_id
      using errcode = 'P0002';
  end if;

  -- Bloqueia cancelamento de entradas de dívida ativa via Financeiro
  if v_trx.payable_debt_id is not null then
    raise exception 'Este lançamento é uma entrada de dívida ativa. Para revertê-lo, exclua a dívida correspondente na página Dívidas Ativas.'
      using errcode = '23503';
  end if;

  if v_trx.debt_payment_id is not null then
    delete from public.debt_payments where id = v_trx.debt_payment_id;
  end if;

  if v_trx.payable_debt_payment_id is not null then
    update public.transactions
      set payable_debt_payment_id = null
    where id = p_transaction_id;

    delete from public.payable_debt_payments where id = v_trx.payable_debt_payment_id;
  end if;

  delete from public.transactions where id = p_transaction_id;
end;
$$;

-- ============================================================
-- 7. Categoria financeira para entradas de dívida ativa
-- ============================================================
insert into public.finance_categories (id, name, type, is_default)
values ('cat_in_payable_debt', 'Entrada de dívida ativa', 'IN', false)
on conflict (id) do nothing;

commit;
