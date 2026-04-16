begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'device-images',
    'device-images',
    true,
    15728640,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
  ),
  (
    'logos',
    'logos',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']::text[]
  )
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.debts
  add column if not exists installments_total integer not null default 1,
  add column if not exists first_due_date date null;

update public.debts
set
  installments_total = greatest(1, coalesce(installments_total, 1)),
  first_due_date = coalesce(first_due_date, due_date);

alter table public.debts drop constraint if exists debts_installments_total_check;
alter table public.debts
  add constraint debts_installments_total_check
  check (installments_total >= 1);

alter table public.payment_methods
  add column if not exists debt_installments integer null;

update public.payment_methods
set debt_installments = greatest(1, coalesce(debt_installments, installments, 1))
where type = 'Devedor';

alter table public.payment_methods drop constraint if exists payment_methods_debt_installments_check;
alter table public.payment_methods
  add constraint payment_methods_debt_installments_check
  check (debt_installments is null or debt_installments >= 1);

update public.transactions
set account = 'Conta Bancária'
where account = 'Caixa';

update public.debt_payments
set account = 'Conta Bancária'
where account = 'Caixa';

update public.payment_methods
set account = 'Conta Bancária'
where account = 'Caixa';

alter table public.transactions drop constraint if exists transactions_account_check;
alter table public.transactions
  add constraint transactions_account_check
  check (account in ('Conta Bancária', 'Cofre', 'Devedores'));

alter table public.debt_payments drop constraint if exists debt_payments_account_check;
alter table public.debt_payments
  add constraint debt_payments_account_check
  check (account in ('Conta Bancária', 'Cofre', 'Devedores'));

alter table public.payment_methods drop constraint if exists payment_methods_account_check;
alter table public.payment_methods
  add constraint payment_methods_account_check
  check (account in ('Conta Bancária', 'Cofre', 'Devedores') or account is null);

create or replace function public.handle_sale_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.trade_in_value, 0) > 0 then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Compra',
      coalesce(new.trade_in_value, 0),
      coalesce(new.date, now()),
      'Entrada (Troca) - ' || coalesce(new.id, ''),
      'Conta Bancária',
      new.id
    );
  end if;

  if new.seller_id is not null then
    update public.sellers
    set total_sales = coalesce(total_sales, 0) + coalesce(new.total, 0),
        updated_at = now()
    where id = new.seller_id;
  end if;

  if new.customer_id is not null then
    update public.customers
    set purchases = coalesce(purchases, 0) + 1,
        total_spent = coalesce(total_spent, 0) + coalesce(new.total, 0),
        updated_at = now()
    where id = new.customer_id;
  end if;

  return new;
end;
$$;

create or replace function public.handle_payment_method_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_description text;
  v_account text;
begin
  if new.sale_id is null then
    return new;
  end if;

  select *
  into v_sale
  from public.sales
  where id = new.sale_id;

  if not found then
    return new;
  end if;

  v_account := coalesce(nullif(new.account, 'Caixa'), 'Conta Bancária');

  if new.type = 'Devedor' then
    insert into public.debts (
      id,
      customer_id,
      sale_id,
      original_amount,
      remaining_amount,
      status,
      due_date,
      first_due_date,
      installments_total,
      notes,
      source
    )
    values (
      'debt_' || replace(gen_random_uuid()::text, '-', ''),
      v_sale.customer_id,
      new.sale_id,
      coalesce(new.amount, 0),
      coalesce(new.amount, 0),
      'Aberta',
      new.debt_due_date,
      new.debt_due_date,
      greatest(1, coalesce(new.debt_installments, 1)),
      new.debt_notes,
      'pdv'
    );
  else
    if new.type = 'Cartão' then
      v_description := 'Venda (Cartão) liquido='
        || coalesce(new.amount, 0)::text
        || ' bruto=' || coalesce(new.customer_amount, new.amount, 0)::text
        || ' taxa=' || coalesce(new.fee_amount, 0)::text
        || ' - ' || coalesce(new.sale_id, '');
    else
      v_description := 'Venda (' || coalesce(new.type, '') || ') - ' || coalesce(new.sale_id, '');
    end if;

    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'IN',
      'Venda',
      coalesce(new.amount, 0),
      coalesce(v_sale.date, now()),
      v_description,
      v_account,
      new.sale_id
    );
  end if;

  return new;
end;
$$;

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

  insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
  values (
    'trx_' || replace(gen_random_uuid()::text, '-', ''),
    'IN',
    'Venda',
    coalesce(new.amount, 0),
    coalesce(new.paid_at, now()),
    'Quitação de dívida - ' || coalesce(v_debt.id, ''),
    v_account,
    v_debt.sale_id
  );

  return new;
end;
$$;

commit;
