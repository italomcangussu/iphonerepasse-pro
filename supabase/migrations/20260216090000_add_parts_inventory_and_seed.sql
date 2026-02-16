create table if not exists public.parts_inventory (
  id text primary key,
  name text not null check (char_length(trim(name)) > 0),
  quantity integer not null check (quantity >= 0),
  unit_cost numeric not null check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'parts_inventory_name_key'
      and conrelid = 'public.parts_inventory'::regclass
  ) then
    alter table public.parts_inventory add constraint parts_inventory_name_key unique (name);
  end if;
end $$;

create index if not exists parts_inventory_name_idx on public.parts_inventory (name);

create or replace function public.tg_set_parts_inventory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_parts_inventory_updated_at on public.parts_inventory;
create trigger set_parts_inventory_updated_at
before update on public.parts_inventory
for each row
execute function public.tg_set_parts_inventory_updated_at();

grant select, insert, update, delete on table public.parts_inventory to authenticated;

alter table public.parts_inventory enable row level security;

drop policy if exists parts_inventory_admin_all on public.parts_inventory;
drop policy if exists parts_inventory_seller_select on public.parts_inventory;
drop policy if exists parts_inventory_seller_insert on public.parts_inventory;
drop policy if exists parts_inventory_seller_update on public.parts_inventory;

create policy parts_inventory_admin_all on public.parts_inventory
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy parts_inventory_seller_select on public.parts_inventory
  for select to authenticated
  using (public.current_role() = 'seller');

create policy parts_inventory_seller_insert on public.parts_inventory
  for insert to authenticated
  with check (public.current_role() = 'seller');

create policy parts_inventory_seller_update on public.parts_inventory
  for update to authenticated
  using (public.current_role() = 'seller')
  with check (public.current_role() = 'seller');

insert into public.parts_inventory (id, name, quantity, unit_cost)
values
  ('part-seed-bat-15pm-decod', 'BATERIA 15PM DECOD', 2, 220.00),
  ('part-seed-bat-15-pro-decode', 'BATERIA 15 PRO DECODE', 1, 200.00),
  ('part-seed-bat-14pm-decode', 'BATERIA 14PM DECODE', 8, 180.00),
  ('part-seed-bat-13pm-decode', 'BATERIA 13PM DECODE', 5, 145.00),
  ('part-seed-bat-14-pro-decode', 'BATERIA 14 PRO DECODE', 1, 180.00),
  ('part-seed-bat-13-pro-decode', 'BATERIA 13 PRO DECODE', 2, 135.00),
  ('part-seed-bat-13-decode', 'BATERIA 13 DECODE', 4, 145.00),
  ('part-seed-bat-12pm-decode', 'BATERIA 12PM DECODE', 1, 135.00),
  ('part-seed-bat-12-decode', 'BATERIA 12 DECODE', 5, 130.00),
  ('part-seed-bat-13-pro-celula', 'BATERIA 13 PRO CÉLULA', 1, 130.00)
on conflict (name) do update
set
  quantity = excluded.quantity,
  unit_cost = excluded.unit_cost,
  updated_at = now();
