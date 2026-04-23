begin;

alter table public.sales
  add column if not exists store_id text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_store_id_fkey'
      and conrelid = 'public.sales'::regclass
  ) then
    alter table public.sales
      add constraint sales_store_id_fkey
      foreign key (store_id) references public.stores(id) on delete set null;
  end if;
end $$;

create index if not exists idx_sales_store_id on public.sales (store_id);

update public.sales s
set store_id = si_store.store_id
from (
  select distinct on (sale_id)
    sale_id,
    stock.store_id
  from public.sale_items item
  join public.stock_items stock on stock.id = item.stock_item_id
  where stock.store_id is not null
  order by sale_id, item.id
) si_store
where s.id = si_store.sale_id
  and s.store_id is null;

commit;
