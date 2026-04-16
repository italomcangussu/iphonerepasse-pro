begin;

create table if not exists public.sale_trade_in_items (
  id text primary key,
  sale_id text not null references public.sales(id) on delete cascade,
  stock_item_id text null references public.stock_items(id) on delete set null,
  model text not null,
  capacity text null,
  color text null,
  imei text null,
  condition text null,
  received_value numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sale_trade_in_items_received_value_check check (received_value >= 0)
);

create index if not exists idx_sale_trade_in_items_sale_id on public.sale_trade_in_items(sale_id);
create index if not exists idx_sale_trade_in_items_stock_item_id on public.sale_trade_in_items(stock_item_id);

-- Backfill legacy sales that only have sales.trade_in_id / sales.trade_in_value.
insert into public.sale_trade_in_items (
  id,
  sale_id,
  stock_item_id,
  model,
  capacity,
  color,
  imei,
  condition,
  received_value
)
select
  'sti_' || replace(gen_random_uuid()::text, '-', ''),
  s.id,
  s.trade_in_id,
  coalesce(si.model, 'Trade-in'),
  si.capacity,
  si.color,
  si.imei,
  si.condition,
  coalesce(s.trade_in_value, 0)
from public.sales s
left join public.stock_items si on si.id = s.trade_in_id
where coalesce(s.trade_in_value, 0) > 0
  and not exists (
    select 1
    from public.sale_trade_in_items sti
    where sti.sale_id = s.id
  );

alter table public.sale_trade_in_items enable row level security;

drop policy if exists sale_trade_in_items_admin_all on public.sale_trade_in_items;
drop policy if exists sale_trade_in_items_seller_select on public.sale_trade_in_items;
drop policy if exists sale_trade_in_items_seller_insert on public.sale_trade_in_items;
drop policy if exists sale_trade_in_items_seller_update on public.sale_trade_in_items;

create policy sale_trade_in_items_admin_all on public.sale_trade_in_items
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy sale_trade_in_items_seller_select on public.sale_trade_in_items
  for select to authenticated
  using (public.current_role() = 'seller');

create policy sale_trade_in_items_seller_insert on public.sale_trade_in_items
  for insert to authenticated
  with check (public.current_role() = 'seller');

create policy sale_trade_in_items_seller_update on public.sale_trade_in_items
  for update to authenticated
  using (public.current_role() = 'seller')
  with check (public.current_role() = 'seller');

commit;
