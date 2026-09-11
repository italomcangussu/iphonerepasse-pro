begin;

-- ============================================================
-- Devedor avulso: a saída do dinheiro passa a constar no extrato.
--
-- Hoje só a VOLTA do dinheiro é lançada: quitar um devedor insere em
-- debt_payments e o trigger handle_debt_payment_after_insert cria um IN
-- na conta escolhida. Cadastrar o devedor não lança nada — então o saldo
-- de Conta Bancária/Cofre sobe sem que a saída correspondente tenha
-- aparecido.
--
-- A simetria já existe do outro lado: payable_debts (dívidas da loja) tem
-- entry_account + trigger de insert/update/delete criando o IN de entrada
-- (20260429000000 / 20260522180000). Este arquivo espelha esse desenho para
-- debts (devedores), com o sinal invertido: dívida manual com conta
-- informada gera um OUT.
--
-- Escopo deliberado: SOMENTE source = 'manual' (devedor avulso). Dívida
-- originada do PDV (source = 'pdv') não pode gerar saída — aquele valor já
-- faz parte da venda e sairia em dobro do resultado.
--
-- Nada é retroagido: as dívidas manuais já cadastradas seguem sem
-- lançamento, porque criar saídas com data de hoje reescreveria saldos
-- históricos. O ajuste dessas fica a critério do administrador.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Conta de saída na dívida + vínculo na transação
-- ------------------------------------------------------------
alter table public.debts
  add column if not exists entry_account text null
  check (entry_account in ('Conta Bancária', 'Cofre'));

alter table public.transactions
  add column if not exists debt_id text null;

create index if not exists idx_transactions_debt_id
  on public.transactions (debt_id);

insert into public.finance_categories (id, name, type, is_default)
values ('cat_out_manual_debt', 'Saída de devedor', 'OUT', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. INSERT em debts -> saída (OUT) na conta informada
-- ------------------------------------------------------------
create or replace function public.handle_debt_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_name text;
begin
  -- `sale_id is null` é defesa em profundidade: dívida ligada a uma venda
  -- nunca gera saída, mesmo que algum caminho futuro grave source='manual'.
  if new.source = 'manual' and new.sale_id is null and new.entry_account is not null then
    select name into v_customer_name
    from public.customers
    where id = new.customer_id;

    insert into public.transactions (
      id, type, category, amount, date, description, account, debt_id
    )
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Saída de devedor',
      new.original_amount,
      now(),
      'Saída devedor - ' || coalesce(v_customer_name, 'Cliente'),
      new.entry_account,
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_debts_after_insert on public.debts;
create trigger trg_debts_after_insert
after insert on public.debts
for each row execute function public.handle_debt_after_insert();

-- ------------------------------------------------------------
-- 3. UPDATE do valor -> sincroniza a saída
--    (mesmo problema resolvido em payable_debts: editar o valor
--    deixava o lançamento com o número antigo)
-- ------------------------------------------------------------
create or replace function public.handle_debt_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.original_amount is distinct from old.original_amount then
    update public.transactions
      set amount = new.original_amount
    where debt_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_debts_after_update on public.debts;
create trigger trg_debts_after_update
after update on public.debts
for each row execute function public.handle_debt_after_update();

-- ------------------------------------------------------------
-- 4. DELETE da dívida -> apaga a saída vinculada
-- ------------------------------------------------------------
create or replace function public.handle_debt_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.transactions
  where debt_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_debts_after_delete on public.debts;
create trigger trg_debts_after_delete
after delete on public.debts
for each row execute function public.handle_debt_after_delete();

-- ------------------------------------------------------------
-- 5. cancel_transaction: a saída do devedor não some pelo extrato
--    (mesma proteção que já existe para a entrada de dívida ativa) —
--    reverter significa excluir o devedor, que dispara o trigger acima.
-- ------------------------------------------------------------
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

  if v_trx.payable_debt_id is not null then
    raise exception 'Este lançamento é uma entrada de dívida ativa. Para revertê-lo, exclua a dívida correspondente na página Dívidas Ativas.'
      using errcode = '23503';
  end if;

  if v_trx.debt_id is not null then
    raise exception 'Este lançamento é a saída de um devedor. Para revertê-lo, exclua o devedor correspondente na página Devedores.'
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

  if v_trx.transfer_group_id is not null then
    delete from public.transactions
    where transfer_group_id = v_trx.transfer_group_id
      and id <> p_transaction_id;
  end if;

  delete from public.transactions where id = p_transaction_id;
end;
$$;

grant execute on function public.cancel_transaction(text) to authenticated;

notify pgrst, 'reload schema';

commit;
