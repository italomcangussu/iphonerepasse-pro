-- Auth + RBAC + RLS foundation

-- 1) Sellers table auth linkage
alter table public.sellers
  add column if not exists email text,
  add column if not exists auth_user_id uuid;

do $$
begin
  if exists (select 1 from public.sellers where email is null or auth_user_id is null) then
    raise exception 'Cannot enforce sellers.email/auth_user_id NOT NULL while null values exist.';
  end if;
end $$;

alter table public.sellers alter column email set not null;
alter table public.sellers alter column auth_user_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sellers_email_key' and conrelid = 'public.sellers'::regclass
  ) then
    alter table public.sellers add constraint sellers_email_key unique (email);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sellers_auth_user_id_key' and conrelid = 'public.sellers'::regclass
  ) then
    alter table public.sellers add constraint sellers_auth_user_id_key unique (auth_user_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sellers_auth_user_id_fkey' and conrelid = 'public.sellers'::regclass
  ) then
    alter table public.sellers
      add constraint sellers_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id);
  end if;
end $$;

-- 2) User profiles for roles
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'seller')),
  seller_id text unique references public.sellers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Helper function used by policies
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select up.role
  from public.user_profiles up
  where up.id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_role() from public;
grant execute on function public.current_role() to authenticated;

-- 4) Enable RLS
alter table public.business_profile enable row level security;
alter table public.stores enable row level security;
alter table public.customers enable row level security;
alter table public.sellers enable row level security;
alter table public.stock_items enable row level security;
alter table public.costs enable row level security;
alter table public.cost_history enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payment_methods enable row level security;
alter table public.transactions enable row level security;
alter table public.user_profiles enable row level security;

-- 5) Policies
-- business_profile
 drop policy if exists business_profile_admin_all on public.business_profile;
 drop policy if exists business_profile_read_all_auth on public.business_profile;
 create policy business_profile_admin_all on public.business_profile
   for all to authenticated
   using (public.current_role() = 'admin')
   with check (public.current_role() = 'admin');
 create policy business_profile_read_all_auth on public.business_profile
   for select to authenticated
   using (public.current_role() in ('admin', 'seller'));

-- stores
 drop policy if exists stores_admin_all on public.stores;
 drop policy if exists stores_read_all_auth on public.stores;
 create policy stores_admin_all on public.stores
   for all to authenticated
   using (public.current_role() = 'admin')
   with check (public.current_role() = 'admin');
 create policy stores_read_all_auth on public.stores
   for select to authenticated
   using (public.current_role() in ('admin', 'seller'));

-- sellers
 drop policy if exists sellers_admin_all on public.sellers;
 drop policy if exists sellers_read_all_auth on public.sellers;
 create policy sellers_admin_all on public.sellers
   for all to authenticated
   using (public.current_role() = 'admin')
   with check (public.current_role() = 'admin');
 create policy sellers_read_all_auth on public.sellers
   for select to authenticated
   using (public.current_role() in ('admin', 'seller'));

-- customers
 drop policy if exists customers_admin_all on public.customers;
 drop policy if exists customers_seller_select on public.customers;
 drop policy if exists customers_seller_insert on public.customers;
 drop policy if exists customers_seller_update on public.customers;
 create policy customers_admin_all on public.customers
   for all to authenticated
   using (public.current_role() = 'admin')
   with check (public.current_role() = 'admin');
 create policy customers_seller_select on public.customers
   for select to authenticated
   using (public.current_role() = 'seller');
 create policy customers_seller_insert on public.customers
   for insert to authenticated
   with check (public.current_role() = 'seller');
 create policy customers_seller_update on public.customers
   for update to authenticated
   using (public.current_role() = 'seller')
   with check (public.current_role() = 'seller');

-- stock_items
 drop policy if exists stock_items_admin_all on public.stock_items;
 drop policy if exists stock_items_seller_select on public.stock_items;
 drop policy if exists stock_items_seller_insert on public.stock_items;
 drop policy if exists stock_items_seller_update on public.stock_items;
 create policy stock_items_admin_all on public.stock_items
   for all to authenticated
   using (public.current_role() = 'admin')
   with check (public.current_role() = 'admin');
 create policy stock_items_seller_select on public.stock_items
   for select to authenticated
   using (public.current_role() = 'seller');
 create policy stock_items_seller_insert on public.stock_items
   for insert to authenticated
   with check (public.current_role() = 'seller');
 create policy stock_items_seller_update on public.stock_items
   for update to authenticated
   using (public.current_role() = 'seller')
   with check (public.current_role() = 'seller');

-- costs
 drop policy if exists costs_admin_all on public.costs;
 drop policy if exists costs_seller_select on public.costs;
 drop policy if exists costs_seller_insert on public.costs;
 drop policy if exists costs_seller_update on public.costs;
 create policy costs_admin_all on public.costs
   for all to authenticated
   using (public.current_role() = 'admin')
   with check (public.current_role() = 'admin');
 create policy costs_seller_select on public.costs
   for select to authenticated
   using (public.current_role() = 'seller');
 create policy costs_seller_insert on public.costs
   for insert to authenticated
   with check (public.current_role() = 'seller');
 create policy costs_seller_update on public.costs
   for update to authenticated
   using (public.current_role() = 'seller')
   with check (public.current_role() = 'seller');

-- cost_history
 drop policy if exists cost_history_admin_all on public.cost_history;
 drop policy if exists cost_history_seller_select on public.cost_history;
 drop policy if exists cost_history_seller_insert on public.cost_history;
 drop policy if exists cost_history_seller_update on public.cost_history;
 create policy cost_history_admin_all on public.cost_history
   for all to authenticated
   using (public.current_role() = 'admin')
   with check (public.current_role() = 'admin');
 create policy cost_history_seller_select on public.cost_history
   for select to authenticated
   using (public.current_role() = 'seller');
 create policy cost_history_seller_insert on public.cost_history
   for insert to authenticated
   with check (public.current_role() = 'seller');
 create policy cost_history_seller_update on public.cost_history
   for update to authenticated
   using (public.current_role() = 'seller')
   with check (public.current_role() = 'seller');

-- sales
 drop policy if exists sales_admin_all on public.sales;
 drop policy if exists sales_seller_select on public.sales;
 drop policy if exists sales_seller_insert on public.sales;
 drop policy if exists sales_seller_update on public.sales;
 create policy sales_admin_all on public.sales
   for all to authenticated
   using (public.current_role() = 'admin')
   with check (public.current_role() = 'admin');
 create policy sales_seller_select on public.sales
   for select to authenticated
   using (public.current_role() = 'seller');
 create policy sales_seller_insert on public.sales
   for insert to authenticated
   with check (public.current_role() = 'seller');
 create policy sales_seller_update on public.sales
   for update to authenticated
   using (public.current_role() = 'seller')
   with check (public.current_role() = 'seller');

-- sale_items
 drop policy if exists sale_items_admin_all on public.sale_items;
 drop policy if exists sale_items_seller_select on public.sale_items;
 drop policy if exists sale_items_seller_insert on public.sale_items;
 drop policy if exists sale_items_seller_update on public.sale_items;
 create policy sale_items_admin_all on public.sale_items
   for all to authenticated
   using (public.current_role() = 'admin')
   with check (public.current_role() = 'admin');
 create policy sale_items_seller_select on public.sale_items
   for select to authenticated
   using (public.current_role() = 'seller');
 create policy sale_items_seller_insert on public.sale_items
   for insert to authenticated
   with check (public.current_role() = 'seller');
 create policy sale_items_seller_update on public.sale_items
   for update to authenticated
   using (public.current_role() = 'seller')
   with check (public.current_role() = 'seller');

-- payment_methods
 drop policy if exists payment_methods_admin_all on public.payment_methods;
 drop policy if exists payment_methods_seller_select on public.payment_methods;
 drop policy if exists payment_methods_seller_insert on public.payment_methods;
 drop policy if exists payment_methods_seller_update on public.payment_methods;
 create policy payment_methods_admin_all on public.payment_methods
   for all to authenticated
   using (public.current_role() = 'admin')
   with check (public.current_role() = 'admin');
 create policy payment_methods_seller_select on public.payment_methods
   for select to authenticated
   using (public.current_role() = 'seller');
 create policy payment_methods_seller_insert on public.payment_methods
   for insert to authenticated
   with check (public.current_role() = 'seller');
 create policy payment_methods_seller_update on public.payment_methods
   for update to authenticated
   using (public.current_role() = 'seller')
   with check (public.current_role() = 'seller');

-- transactions (admin only)
 drop policy if exists transactions_admin_all on public.transactions;
 create policy transactions_admin_all on public.transactions
   for all to authenticated
   using (public.current_role() = 'admin')
   with check (public.current_role() = 'admin');

-- user_profiles
 drop policy if exists user_profiles_admin_all on public.user_profiles;
 drop policy if exists user_profiles_self_select on public.user_profiles;
 create policy user_profiles_admin_all on public.user_profiles
   for all to authenticated
   using (public.current_role() = 'admin')
   with check (public.current_role() = 'admin');
 create policy user_profiles_self_select on public.user_profiles
   for select to authenticated
   using (auth.uid() = id);

-- 6) Sales trigger for financial + counters
create or replace function public.handle_sale_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
  values (
    'trx_' || replace(gen_random_uuid()::text, '-', ''),
    'IN',
    'Venda',
    coalesce(new.total, 0),
    coalesce(new.date, now()),
    'Venda - ' || coalesce(new.id, ''),
    'Caixa',
    new.id
  );

  if coalesce(new.trade_in_value, 0) > 0 then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Compra',
      coalesce(new.trade_in_value, 0),
      coalesce(new.date, now()),
      'Entrada (Troca) - ' || coalesce(new.id, ''),
      'Caixa',
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

drop trigger if exists trg_sales_after_insert on public.sales;
create trigger trg_sales_after_insert
after insert on public.sales
for each row
execute function public.handle_sale_after_insert();
