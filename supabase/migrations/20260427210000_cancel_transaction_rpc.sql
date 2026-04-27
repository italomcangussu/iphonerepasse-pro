begin;

-- ============================================================
-- cancel_transaction: RPC segura para cancelar lançamentos
-- Problema anterior: DELETE direto via cliente falhava silenciosamente
-- (RLS retornava 0 rows sem erro) e o trigger handle_transaction_after_delete
-- combinado com o FK ON DELETE CASCADE em payable_debt_payment_id
-- poderia causar conflito de cascade recursivo em alguns cenários.
-- Esta RPC usa SECURITY DEFINER, verifica permissão explicitamente,
-- e retorna erro claro se o lançamento não for encontrado.
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
  -- 1. Verificar permissão
  if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem cancelar lançamentos.'
      using errcode = '42501';
  end if;

  -- 2. Buscar e travar o lançamento
  select * into v_trx
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Lançamento não encontrado: %', p_transaction_id
      using errcode = 'P0002';
  end if;

  -- 3. Se vinculado a um debt_payment, deletar o payment primeiro para que o
  --    trigger handle_debt_payment_after_delete restaure o saldo da dívida.
  --    Depois o cascade FK vai tentar deletar a transaction, mas ela será
  --    deletada no passo 5 — o cascade não encontrará rows (já deletada).
  if v_trx.debt_payment_id is not null then
    delete from public.debt_payments where id = v_trx.debt_payment_id;
  end if;

  -- 4. Se vinculado a um payable_debt_payment, deletar o payment primeiro para
  --    que o trigger handle_payable_debt_payment_after_delete restaure o saldo.
  --    Zeramos o campo no registro antes de deletar o payment para que o CASCADE
  --    FK (payable_debt_payments → transactions ON DELETE CASCADE) não tente
  --    deletar a transaction que vamos deletar logo a seguir, evitando o
  --    triggered_data_change_violation (error 27000).
  if v_trx.payable_debt_payment_id is not null then
    update public.transactions
      set payable_debt_payment_id = null
    where id = p_transaction_id;

    delete from public.payable_debt_payments where id = v_trx.payable_debt_payment_id;
  end if;

  -- 5. Deletar a transaction. O trigger handle_transaction_after_delete vai
  --    disparar mas não fará nada (debt_payment_id e payable_debt_payment_id
  --    já foram tratados nos passos 3/4).
  delete from public.transactions where id = p_transaction_id;
end;
$$;

grant execute on function public.cancel_transaction(text) to authenticated;

commit;
