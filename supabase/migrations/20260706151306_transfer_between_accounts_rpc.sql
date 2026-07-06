begin;

-- The app calls public.transfer_between_accounts(p_amount, p_from, p_to) through
-- Supabase RPC. Keep the public function as a thin invoker wrapper and isolate
-- the SECURITY DEFINER write operation in a non-exposed schema.
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

create or replace function private.transfer_between_accounts_impl(
  p_amount numeric,
  p_from text,
  p_to text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_from text := nullif(btrim(p_from), '');
  v_to text := nullif(btrim(p_to), '');
  v_transfer_group_id text := 'trf_' || replace(gen_random_uuid()::text, '-', '');
  v_transfer_date timestamptz := now();
  v_out_transaction_id text := 'trx_' || replace(gen_random_uuid()::text, '-', '');
  v_in_transaction_id text := 'trx_' || replace(gen_random_uuid()::text, '-', '');
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'Apenas administradores podem transferir entre contas.'
      using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor valido.'
      using errcode = '22023';
  end if;

  if v_from not in ('Conta Bancária', 'Cofre') or v_to not in ('Conta Bancária', 'Cofre') then
    raise exception 'Conta de transferencia invalida.'
      using errcode = '22023';
  end if;

  if v_from = v_to then
    raise exception 'Selecione contas diferentes para transferir.'
      using errcode = '22023';
  end if;

  insert into public.transactions (
    id, type, category, amount, date, description, account, transfer_group_id
  )
  values
    (
      v_out_transaction_id,
      'OUT',
      'Serviço',
      p_amount,
      v_transfer_date,
      'Transferência para ' || p_to,
      v_from,
      v_transfer_group_id
    ),
    (
      v_in_transaction_id,
      'IN',
      'Aporte',
      p_amount,
      v_transfer_date,
      'Transferência de ' || p_from,
      v_to,
      v_transfer_group_id
    );

  return jsonb_build_object(
    'transferGroupId', v_transfer_group_id,
    'outTransactionId', v_out_transaction_id,
    'inTransactionId', v_in_transaction_id,
    'amount', p_amount,
    'from', v_from,
    'to', v_to
  );
end;
$$;

revoke all on function private.transfer_between_accounts_impl(numeric, text, text) from public;
revoke all on function private.transfer_between_accounts_impl(numeric, text, text) from anon;
grant execute on function private.transfer_between_accounts_impl(numeric, text, text) to authenticated;
grant execute on function private.transfer_between_accounts_impl(numeric, text, text) to service_role;

create or replace function public.transfer_between_accounts(
  p_amount numeric,
  p_from text,
  p_to text
)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.transfer_between_accounts_impl(p_amount, p_from, p_to);
$$;

revoke all on function public.transfer_between_accounts(numeric, text, text) from public;
revoke all on function public.transfer_between_accounts(numeric, text, text) from anon;
grant execute on function public.transfer_between_accounts(numeric, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
