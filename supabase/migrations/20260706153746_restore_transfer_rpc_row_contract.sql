begin;

-- PostgREST does not support overloaded functions reliably. Keep one public
-- signature and return the inserted rows expected by the data context.
drop function if exists public.transfer_between_accounts(text, text, numeric);
drop function if exists public.transfer_between_accounts(numeric, text, text);
drop function if exists private.transfer_between_accounts_impl(numeric, text, text);

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

insert into public.finance_categories (id, name, type, is_default)
values
  ('cat_in_transfer', 'Transferência', 'IN', false),
  ('cat_out_transfer', 'Transferência', 'OUT', false)
on conflict (id) do nothing;

create function private.transfer_between_accounts_impl(
  p_amount numeric,
  p_from text,
  p_to text
)
returns setof public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text := nullif(pg_catalog.btrim(p_from), '');
  v_to text := nullif(pg_catalog.btrim(p_to), '');
  v_transfer_group_id text := 'trf_' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');
  v_transfer_date timestamptz := pg_catalog.now();
  v_balance numeric;
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

  -- Serialize consumers of the same source balance until commit or rollback.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('finance-transfer:' || v_from, 0));

  select coalesce(
      pg_catalog.sum(case when trx.type = 'IN' then trx.amount else -trx.amount end),
      0
    )
    into v_balance
    from public.transactions as trx
    where trx.account = v_from;

  if v_balance < p_amount - 0.001 then
    raise exception 'Saldo insuficiente em %.', v_from
      using errcode = '22023';
  end if;

  return query
  insert into public.transactions (
    id, type, category, amount, date, description, account, transfer_group_id
  )
  values
    (
      'trx_' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
      'OUT',
      'Transferência',
      p_amount,
      v_transfer_date,
      'Transferência para ' || v_to,
      v_from,
      v_transfer_group_id
    ),
    (
      'trx_' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
      'IN',
      'Transferência',
      p_amount,
      v_transfer_date,
      'Transferência de ' || v_from,
      v_to,
      v_transfer_group_id
    )
  returning *;
end;
$$;

revoke all on function private.transfer_between_accounts_impl(numeric, text, text) from public;
revoke all on function private.transfer_between_accounts_impl(numeric, text, text) from anon;
grant execute on function private.transfer_between_accounts_impl(numeric, text, text) to authenticated;
grant execute on function private.transfer_between_accounts_impl(numeric, text, text) to service_role;

create function public.transfer_between_accounts(
  p_amount numeric,
  p_from text,
  p_to text
)
returns setof public.transactions
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.transfer_between_accounts_impl(p_amount, p_from, p_to);
$$;

revoke all on function public.transfer_between_accounts(numeric, text, text) from public;
revoke all on function public.transfer_between_accounts(numeric, text, text) from anon;
grant execute on function public.transfer_between_accounts(numeric, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
