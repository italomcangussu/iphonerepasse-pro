-- Orçamentos do PDV: snapshot imutável do que foi oferecido ao cliente
-- (itens do estoque ou manuais, condições de pagamento e validade de 1 a 30 dias).
create table if not exists public.pdv_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number bigint generated always as identity unique,
  store_id text references public.stores(id) on delete set null,
  customer_id text references public.customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  seller_name text,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  payment jsonb not null default '{}'::jsonb check (jsonb_typeof(payment) = 'object'),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  notes text,
  validity_days integer not null default 1 check (validity_days between 1 and 30),
  expires_at timestamptz not null,
  status text not null default 'aberto' check (status in ('aberto', 'cancelado')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pdv_quotes_created_at on public.pdv_quotes (created_at desc);
create index if not exists idx_pdv_quotes_store_id on public.pdv_quotes (store_id);
create index if not exists idx_pdv_quotes_customer_id on public.pdv_quotes (customer_id);
create index if not exists idx_pdv_quotes_created_by on public.pdv_quotes (created_by);

alter table public.pdv_quotes enable row level security;

drop policy if exists pdv_quotes_select on public.pdv_quotes;
create policy pdv_quotes_select on public.pdv_quotes for select to authenticated
  using ((select public.has_app_permission('pdv', 'visible')));

drop policy if exists pdv_quotes_insert on public.pdv_quotes;
create policy pdv_quotes_insert on public.pdv_quotes for insert to authenticated
  with check ((select public.has_app_permission('pdv', 'visible')));

drop policy if exists pdv_quotes_update on public.pdv_quotes;
create policy pdv_quotes_update on public.pdv_quotes for update to authenticated
  using ((select public.has_app_permission('pdv', 'visible')))
  with check ((select public.has_app_permission('pdv', 'visible')));

drop policy if exists pdv_quotes_delete on public.pdv_quotes;
create policy pdv_quotes_delete on public.pdv_quotes for delete to authenticated
  using ((select public.has_app_permission('pdv', 'deletable')));

revoke all on public.pdv_quotes from anon;
grant select, insert, update, delete on public.pdv_quotes to authenticated;
grant all on public.pdv_quotes to service_role;
