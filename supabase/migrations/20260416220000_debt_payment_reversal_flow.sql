begin;

alter table public.transactions
  add column if not exists debt_payment_id text null;

alter table public.transactions
  drop constraint if exists transactions_debt_payment_fk;
alter table public.transactions
  add constraint transactions_debt_payment_fk
  foreign key (debt_payment_id)
  references public.debt_payments(id)
  on delete cascade;

create index if not exists idx_transactions_debt_payment_id
  on public.transactions (debt_payment_id);

update public.transactions t
set debt_payment_id = dp.id
from public.debt_payments dp
join public.debts d on d.id = dp.debt_id
where t.debt_payment_id is null
  and t.description = 'Quitação de dívida - ' || d.id
  and t.amount = dp.amount
  and t.date = dp.paid_at
  and t.account = coalesce(nullif(dp.account, 'Caixa'), 'Conta Bancária');

create or replace function public.handle_debt_payment_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt public.debts%rowtype;
  v_new_remaining numeric;
  v_new_status text;
  v_account text;
begin
  select *
  into v_debt
  from public.debts
  where id = new.debt_id
  for update;

  if not found then
    raise exception 'Debt not found for payment: %', new.debt_id;
  end if;

  if new.amount > coalesce(v_debt.remaining_amount, 0) then
    raise exception 'Payment amount (%) exceeds remaining debt amount (%)', new.amount, v_debt.remaining_amount;
  end if;

  v_new_remaining := coalesce(v_debt.remaining_amount, 0) - coalesce(new.amount, 0);
  if v_new_remaining = 0 then
    v_new_status := 'Quitada';
  else
    v_new_status := 'Parcial';
  end if;

  update public.debts
  set remaining_amount = v_new_remaining,
      status = v_new_status,
      updated_at = now()
  where id = v_debt.id;

  v_account := coalesce(nullif(new.account, 'Caixa'), 'Conta Bancária');

  insert into public.transactions (
    id,
    type,
    category,
    amount,
    date,
    description,
    account,
    sale_id,
    debt_payment_id
  )
  values (
    'trx_' || replace(gen_random_uuid()::text, '-', ''),
    'IN',
    'Venda',
    coalesce(new.amount, 0),
    coalesce(new.paid_at, now()),
    'Quitação de dívida - ' || coalesce(v_debt.id, ''),
    v_account,
    v_debt.sale_id,
    new.id
  );

  return new;
end;
$$;

create or replace function public.handle_debt_payment_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt public.debts%rowtype;
  v_restored_remaining numeric;
  v_new_status text;
begin
  select *
  into v_debt
  from public.debts
  where id = old.debt_id
  for update;

  if not found then
    return old;
  end if;

  v_restored_remaining := coalesce(v_debt.remaining_amount, 0) + coalesce(old.amount, 0);
  if v_restored_remaining > coalesce(v_debt.original_amount, 0) then
    v_restored_remaining := coalesce(v_debt.original_amount, 0);
  end if;

  if v_restored_remaining <= 0 then
    v_new_status := 'Quitada';
  elsif v_restored_remaining >= coalesce(v_debt.original_amount, 0) then
    v_new_status := 'Aberta';
  else
    v_new_status := 'Parcial';
  end if;

  update public.debts
  set remaining_amount = v_restored_remaining,
      status = v_new_status,
      updated_at = now()
  where id = v_debt.id;

  return old;
end;
$$;

drop trigger if exists trg_debt_payments_after_delete on public.debt_payments;
create trigger trg_debt_payments_after_delete
after delete on public.debt_payments
for each row
execute function public.handle_debt_payment_after_delete();

create or replace function public.handle_transaction_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.debt_payment_id is not null then
    delete from public.debt_payments where id = old.debt_payment_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_transactions_after_delete on public.transactions;
create trigger trg_transactions_after_delete
after delete on public.transactions
for each row
execute function public.handle_transaction_after_delete();

commit;
