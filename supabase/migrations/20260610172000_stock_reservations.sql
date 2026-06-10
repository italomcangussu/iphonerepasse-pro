begin;

create table if not exists public.stock_reservations (
  id text primary key,
  stock_item_id text not null references public.stock_items(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz null,
  deposit_amount numeric(10,2) null,
  deposit_payment_method text null,
  notes text null,
  status text not null default 'active',
  released_at timestamptz null,
  sold_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_reservations_status_check check (status in ('active', 'released', 'sold')),
  constraint stock_reservations_deposit_amount_check check (deposit_amount is null or deposit_amount >= 0)
);

create unique index if not exists idx_stock_reservations_one_active
  on public.stock_reservations (stock_item_id)
  where status = 'active';

create index if not exists idx_stock_reservations_stock_item_id
  on public.stock_reservations (stock_item_id);

create index if not exists idx_stock_reservations_expires_at
  on public.stock_reservations (expires_at)
  where status = 'active' and expires_at is not null;

create or replace function public.tg_set_stock_reservations_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_stock_reservations_set_updated_at on public.stock_reservations;
create trigger trg_stock_reservations_set_updated_at
before update on public.stock_reservations
for each row execute function public.tg_set_stock_reservations_updated_at();

alter table public.stock_reservations enable row level security;

drop policy if exists stock_reservations_store_scope_select on public.stock_reservations;
create policy stock_reservations_store_scope_select on public.stock_reservations
  for select to authenticated
  using (
    exists (
      select 1
      from public.stock_items si
      where si.id = stock_reservations.stock_item_id
        and public.crm_can_access_store(si.store_id)
    )
  );

drop policy if exists stock_reservations_store_scope_insert on public.stock_reservations;
create policy stock_reservations_store_scope_insert on public.stock_reservations
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.stock_items si
      where si.id = stock_reservations.stock_item_id
        and public.crm_can_access_store(si.store_id)
    )
  );

drop policy if exists stock_reservations_store_scope_update on public.stock_reservations;
create policy stock_reservations_store_scope_update on public.stock_reservations
  for update to authenticated
  using (
    exists (
      select 1
      from public.stock_items si
      where si.id = stock_reservations.stock_item_id
        and public.crm_can_access_store(si.store_id)
    )
  )
  with check (
    exists (
      select 1
      from public.stock_items si
      where si.id = stock_reservations.stock_item_id
        and public.crm_can_access_store(si.store_id)
    )
  );

commit;
