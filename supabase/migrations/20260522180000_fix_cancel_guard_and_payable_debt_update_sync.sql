begin;

-- ============================================================
-- 1. cancel_transaction: restaura a proteção de entradas de dívida
--    ativa (payable_debt_id), perdida ao reescrever a função na
--    migration 20260522170000 a partir de uma versão antiga. Mantém
--    o estorno de transferências (transfer_group_id) e dos pagamentos
--    de dívidas (debt_payment_id / payable_debt_payment_id).
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

  -- Bloqueia cancelamento de entradas de dívida ativa via Financeiro.
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

  -- Se for parte de uma transferência, estornar o(s) lançamento(s) pareado(s).
  if v_trx.transfer_group_id is not null then
    delete from public.transactions
    where transfer_group_id = v_trx.transfer_group_id
      and id <> p_transaction_id;
  end if;

  delete from public.transactions where id = p_transaction_id;
end;
$$;

grant execute on function public.cancel_transaction(text) to authenticated;

-- ============================================================
-- 2. Sincroniza o lançamento de entrada quando o valor de uma
--    dívida ativa é editado. Sem isso, alterar original_amount
--    (ex.: 1000 -> 750) deixava o IN "Entrada dívida ativa" com o
--    valor antigo, divergindo do saldo do caixa/banco.
-- ============================================================
create or replace function public.handle_payable_debt_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.original_amount is distinct from old.original_amount then
    update public.transactions
      set amount = new.original_amount
    where payable_debt_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payable_debts_after_update on public.payable_debts;
create trigger trg_payable_debts_after_update
after update on public.payable_debts
for each row execute function public.handle_payable_debt_after_update();

commit;
