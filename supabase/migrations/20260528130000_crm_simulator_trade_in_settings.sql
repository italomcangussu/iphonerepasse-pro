begin;

create table if not exists public.simulator_trade_in_values (
  id uuid primary key default gen_random_uuid(),
  model text not null check (btrim(model) <> ''),
  capacity text not null check (btrim(capacity) <> ''),
  base_value numeric(12,2) not null check (base_value >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.simulator_trade_in_adjustments (
  id uuid primary key default gen_random_uuid(),
  label text not null check (btrim(label) <> ''),
  model text null,
  capacity text null,
  amount_delta numeric(12,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint simulator_trade_in_adjustments_model_not_blank check (model is null or btrim(model) <> ''),
  constraint simulator_trade_in_adjustments_capacity_not_blank check (capacity is null or btrim(capacity) <> '')
);

create unique index if not exists simulator_trade_in_values_active_unique
  on public.simulator_trade_in_values (lower(btrim(model)), lower(btrim(capacity)))
  where is_active;

create index if not exists simulator_trade_in_values_lookup_idx
  on public.simulator_trade_in_values (lower(btrim(model)), lower(btrim(capacity)));

create index if not exists simulator_trade_in_adjustments_lookup_idx
  on public.simulator_trade_in_adjustments (lower(btrim(coalesce(model, ''))), lower(btrim(coalesce(capacity, ''))))
  where is_active;

create or replace function public.tg_set_simulator_trade_in_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_simulator_trade_in_values_updated_at on public.simulator_trade_in_values;
create trigger set_simulator_trade_in_values_updated_at
before update on public.simulator_trade_in_values
for each row
execute function public.tg_set_simulator_trade_in_updated_at();

drop trigger if exists set_simulator_trade_in_adjustments_updated_at on public.simulator_trade_in_adjustments;
create trigger set_simulator_trade_in_adjustments_updated_at
before update on public.simulator_trade_in_adjustments
for each row
execute function public.tg_set_simulator_trade_in_updated_at();

alter table public.simulator_trade_in_values enable row level security;
alter table public.simulator_trade_in_adjustments enable row level security;

drop policy if exists simulator_trade_in_values_admin_all on public.simulator_trade_in_values;
create policy simulator_trade_in_values_admin_all on public.simulator_trade_in_values
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists simulator_trade_in_values_seller_select on public.simulator_trade_in_values;
create policy simulator_trade_in_values_seller_select on public.simulator_trade_in_values
  for select to authenticated
  using (public.current_role() = 'seller');

drop policy if exists simulator_trade_in_adjustments_admin_all on public.simulator_trade_in_adjustments;
create policy simulator_trade_in_adjustments_admin_all on public.simulator_trade_in_adjustments
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists simulator_trade_in_adjustments_seller_select on public.simulator_trade_in_adjustments;
create policy simulator_trade_in_adjustments_seller_select on public.simulator_trade_in_adjustments
  for select to authenticated
  using (public.current_role() = 'seller');

grant select, insert, update, delete on public.simulator_trade_in_values to authenticated;
grant select, insert, update, delete on public.simulator_trade_in_adjustments to authenticated;

insert into public.simulator_trade_in_values (model, capacity, base_value)
values
  ('iPhone 11', '64GB', 800),
  ('iPhone 11', '128GB', 1100),
  ('iPhone 12', '64GB', 1000),
  ('iPhone 12', '128GB', 1250),
  ('iPhone 13', '128GB', 1700),
  ('iPhone 13', '256GB', 1900),
  ('iPhone 14', '128GB', 1900),
  ('iPhone 14', '256GB', 2100),
  ('iPhone 15', '128GB', 2600),
  ('iPhone 15', '256GB', 2900),
  ('iPhone 15 Pro', '128GB', 3100),
  ('iPhone 15 Pro', '256GB', 3350),
  ('iPhone 15 Pro Max', '256GB', 4100),
  ('iPhone 15 Pro Max', '512GB', 4500),
  ('iPhone 16', '128GB', 3000),
  ('iPhone 16', '256GB', 3300),
  ('iPhone 16 Pro Max', '256GB', 5000)
on conflict do nothing;

commit;
