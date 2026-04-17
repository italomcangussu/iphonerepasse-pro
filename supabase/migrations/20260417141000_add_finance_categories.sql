begin;

create table if not exists public.finance_categories (
  id text primary key,
  name text not null,
  type text not null check (type in ('IN', 'OUT')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.finance_categories enable row level security;

do $$
begin
  drop policy if exists "finance_categories_admin_all" on public.finance_categories;
  drop policy if exists "finance_categories_staff_select" on public.finance_categories;
end $$;

create policy "finance_categories_admin_all" on public.finance_categories
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "finance_categories_staff_select" on public.finance_categories
  for select to authenticated
  using (true);

-- Functions
create or replace function public.tg_set_finance_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_finance_categories_updated_at on public.finance_categories;
create trigger set_finance_categories_updated_at
before update on public.finance_categories
for each row
execute function public.tg_set_finance_categories_updated_at();

-- Seed initial categories based on current hardcoded values
insert into public.finance_categories (id, name, type, is_default)
values
  ('cat_in_venda', 'Venda', 'IN', true),
  ('cat_in_aporte', 'Aporte', 'IN', false),
  ('cat_in_servico', 'Serviço', 'IN', false),
  ('cat_out_compra', 'Compra', 'OUT', false),
  ('cat_out_insumo', 'Insumo', 'OUT', false),
  ('cat_out_retirada', 'Retirada', 'OUT', false),
  ('cat_out_servico', 'Serviço', 'OUT', false)
on conflict (id) do nothing;

commit;
