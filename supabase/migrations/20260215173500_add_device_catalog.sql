create table if not exists public.device_catalog (
  id text primary key,
  type text not null check (type in ('iPhone', 'iPad', 'Macbook', 'Apple Watch', 'Acessório')),
  model text not null check (char_length(trim(model)) > 0),
  color text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, model, color)
);

create index if not exists device_catalog_type_model_idx
  on public.device_catalog (type, model);

create or replace function public.tg_set_device_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_device_catalog_updated_at on public.device_catalog;
create trigger set_device_catalog_updated_at
before update on public.device_catalog
for each row
execute function public.tg_set_device_catalog_updated_at();

grant select, insert, update, delete on table public.device_catalog to authenticated;

alter table public.device_catalog enable row level security;

drop policy if exists device_catalog_admin_all on public.device_catalog;
drop policy if exists device_catalog_read_all_auth on public.device_catalog;
drop policy if exists device_catalog_seller_insert on public.device_catalog;

create policy device_catalog_admin_all on public.device_catalog
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy device_catalog_read_all_auth on public.device_catalog
  for select to authenticated
  using (public.current_role() in ('admin', 'seller'));

create policy device_catalog_seller_insert on public.device_catalog
  for insert to authenticated
  with check (public.current_role() = 'seller');
