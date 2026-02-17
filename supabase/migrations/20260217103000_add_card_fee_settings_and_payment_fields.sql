begin;

create table if not exists public.card_fee_settings (
  id text primary key default 'default' check (id = 'default'),
  visa_master_rates jsonb not null,
  other_rates jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_valid_card_fee_rates(input jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(input) = 'array'
    and jsonb_array_length(input) = 18
    and not exists (
      select 1
      from jsonb_array_elements(input) as e(value)
      where jsonb_typeof(e.value) <> 'number'
         or (e.value::text)::numeric < 0
         or (e.value::text)::numeric >= 100
    );
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'card_fee_settings_visa_master_rates_check'
      and conrelid = 'public.card_fee_settings'::regclass
  ) then
    alter table public.card_fee_settings
      add constraint card_fee_settings_visa_master_rates_check
      check (public.is_valid_card_fee_rates(visa_master_rates));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'card_fee_settings_other_rates_check'
      and conrelid = 'public.card_fee_settings'::regclass
  ) then
    alter table public.card_fee_settings
      add constraint card_fee_settings_other_rates_check
      check (public.is_valid_card_fee_rates(other_rates));
  end if;
end $$;

create or replace function public.tg_set_card_fee_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_card_fee_settings_updated_at on public.card_fee_settings;
create trigger set_card_fee_settings_updated_at
before update on public.card_fee_settings
for each row
execute function public.tg_set_card_fee_settings_updated_at();

insert into public.card_fee_settings (id, visa_master_rates, other_rates)
values (
  'default',
  '[
    2.99,4.09,4.78,5.47,6.14,6.81,7.67,8.33,8.98,9.63,10.26,10.90,12.32,12.94,13.56,14.17,14.77,15.37
  ]'::jsonb,
  '[
    3.99,5.30,5.99,6.68,7.35,8.02,9.47,10.13,10.78,11.43,12.06,12.70,13.32,13.94,14.56,15.17,15.77,16.37
  ]'::jsonb
)
on conflict (id) do nothing;

alter table public.payment_methods
  add column if not exists account text null,
  add column if not exists card_brand text null,
  add column if not exists customer_amount numeric null,
  add column if not exists fee_rate numeric null,
  add column if not exists fee_amount numeric null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_methods_account_check'
      and conrelid = 'public.payment_methods'::regclass
  ) then
    alter table public.payment_methods
      add constraint payment_methods_account_check
      check (account in ('Caixa', 'Cofre') or account is null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_methods_card_brand_check'
      and conrelid = 'public.payment_methods'::regclass
  ) then
    alter table public.payment_methods
      add constraint payment_methods_card_brand_check
      check (card_brand in ('visa_master', 'outras') or card_brand is null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_methods_customer_amount_check'
      and conrelid = 'public.payment_methods'::regclass
  ) then
    alter table public.payment_methods
      add constraint payment_methods_customer_amount_check
      check (customer_amount is null or customer_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_methods_fee_rate_check'
      and conrelid = 'public.payment_methods'::regclass
  ) then
    alter table public.payment_methods
      add constraint payment_methods_fee_rate_check
      check (fee_rate is null or (fee_rate >= 0 and fee_rate < 100));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_methods_fee_amount_check'
      and conrelid = 'public.payment_methods'::regclass
  ) then
    alter table public.payment_methods
      add constraint payment_methods_fee_amount_check
      check (fee_amount is null or fee_amount >= 0);
  end if;
end $$;

update public.payment_methods
set
  account = coalesce(account, 'Caixa'),
  card_brand = coalesce(card_brand, 'visa_master'),
  customer_amount = coalesce(customer_amount, amount),
  fee_rate = coalesce(fee_rate, 0),
  fee_amount = coalesce(fee_amount, 0),
  installments = coalesce(installments, 1)
where type = 'Cartão';

create or replace function public.handle_payment_method_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_description text;
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

  if new.type = 'Devedor' then
    insert into public.debts (
      id,
      customer_id,
      sale_id,
      original_amount,
      remaining_amount,
      status,
      due_date,
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
      coalesce(new.account, 'Caixa'),
      new.sale_id
    );
  end if;

  return new;
end;
$$;

alter table public.card_fee_settings enable row level security;

drop policy if exists card_fee_settings_admin_all on public.card_fee_settings;
create policy card_fee_settings_admin_all on public.card_fee_settings
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists card_fee_settings_seller_select on public.card_fee_settings;
create policy card_fee_settings_seller_select on public.card_fee_settings
  for select to authenticated
  using (public.current_role() = 'seller');

commit;
