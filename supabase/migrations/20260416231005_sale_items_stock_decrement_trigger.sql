begin;

create or replace function public.handle_sale_item_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.stock_items
  set status = 'Vendido'
  where id = new.stock_item_id
    and status is distinct from 'Vendido';

  return new;
end;
$$;

drop trigger if exists trg_sale_items_after_insert on public.sale_items;
create trigger trg_sale_items_after_insert
after insert on public.sale_items
for each row
execute function public.handle_sale_item_after_insert();

-- Backfill historical sales with stock not yet marked as sold.
update public.stock_items si
set status = 'Vendido'
where si.status is distinct from 'Vendido'
  and exists (
    select 1
    from public.sale_items sai
    where sai.stock_item_id = si.id
  );

commit;;
