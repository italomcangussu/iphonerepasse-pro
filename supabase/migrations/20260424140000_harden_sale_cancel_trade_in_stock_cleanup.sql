begin;

-- Keep sale cancellation idempotent for both current sale_trade_in_items rows
-- and legacy sales.trade_in_id references. The sold device returns to inventory;
-- devices received as trade-in are returned to the customer and must leave stock.
create or replace function public.handle_sale_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Delete debt_payments that belong to debts from this sale.
  --    Do this first so that handle_debt_payment_after_delete does NOT try to
  --    restore remaining_amount on a debt we are about to delete.
  delete from public.debt_payments
  where debt_id in (
    select id from public.debts where sale_id = old.id
  );

  -- 2. Delete debts created by this sale (Devedor payment methods).
  delete from public.debts where sale_id = old.id;

  -- 3. Delete all transactions linked to this sale.
  delete from public.transactions where sale_id = old.id;

  -- 4. Remove stock records for devices received as trade-in on this sale.
  --    If a trade-in device was already used in another sale, keep the stock row
  --    to preserve that later sale history.
  delete from public.stock_items si
  where si.id in (
    select sti.stock_item_id
    from public.sale_trade_in_items sti
    where sti.sale_id = old.id
      and sti.stock_item_id is not null
    union
    select old.trade_in_id
    where old.trade_in_id is not null
  )
    and not exists (
      select 1
      from public.sale_items sold_item
      where sold_item.stock_item_id = si.id
    );

  -- 5. Restore sold stock items back to 'Disponível'.
  update public.stock_items
  set status = 'Disponível',
      updated_at = now()
  where id in (
    select stock_item_id from public.sale_items where sale_id = old.id
  );

  -- 6. Decrement seller.total_sales (floor at 0).
  if old.seller_id is not null then
    update public.sellers
    set total_sales = greatest(0, coalesce(total_sales, 0) - coalesce(old.total, 0)),
        updated_at = now()
    where id = old.seller_id;
  end if;

  -- 7. Decrement customer.purchases (-1) and customer.total_spent (floor at 0).
  if old.customer_id is not null then
    update public.customers
    set purchases   = greatest(0, coalesce(purchases, 0) - 1),
        total_spent = greatest(0, coalesce(total_spent, 0) - coalesce(old.total, 0)),
        updated_at  = now()
    where id = old.customer_id;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_sales_before_delete on public.sales;
create trigger trg_sales_before_delete
before delete on public.sales
for each row
execute function public.handle_sale_before_delete();

commit;
