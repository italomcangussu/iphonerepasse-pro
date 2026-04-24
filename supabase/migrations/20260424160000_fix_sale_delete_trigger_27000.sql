begin;

-- Fix error 27000 (triggered_data_change_violation) on sale cancellation.
--
-- Root cause: the BEFORE DELETE trigger on `sales` was deleting from `stock_items`
-- inside the trigger body. This triggered the FK ON DELETE SET NULL on
-- sale_trade_in_items.stock_item_id, which caused PostgreSQL to UPDATE
-- sale_trade_in_items and then re-check the FK sale_trade_in_items.sale_id → sales.
-- That FK check acquired a KEY SHARE lock on the `sales` row currently being deleted.
-- PostgreSQL interpreted this lock as a self-modification (HeapTupleSelfUpdated),
-- raising error 27000 with hint "Consider using an AFTER trigger instead".
--
-- Fix:
--   1. Remove the DELETE FROM stock_items step from the BEFORE trigger entirely.
--      (The FK chain BEFORE → DELETE stock_items → SET NULL → FK KEY SHARE on sales is the bug.)
--   2. Add a new AFTER DELETE trigger on `sales` to clean up the legacy trade_in_id
--      stock item. AFTER triggers fire after the row is already deleted, so there is
--      no live tuple to lock, and no self-modification can occur.
--   3. Multi-item trade-in stock cleanup (sale_trade_in_items) is handled by the
--      app layer (removeSale in dataContext.tsx), which runs after the delete succeeds.

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

  -- NOTE: The step that deleted trade-in stock items was removed from this BEFORE
  -- trigger because it caused error 27000. Specifically:
  --   DELETE stock_items
  --   → ON DELETE SET NULL on sale_trade_in_items.stock_item_id
  --   → UPDATE sale_trade_in_items
  --   → FK check sale_trade_in_items.sale_id → sales (KEY SHARE lock on the row being deleted)
  --   → TM_SelfModified → 27000
  -- Legacy trade_in_id cleanup is now handled by handle_sale_after_delete_cleanup()
  -- (AFTER trigger, safe). Multi-item trade-in cleanup is done by the app layer.

  -- 4. Restore sold stock items back to 'Disponível'.
  update public.stock_items
  set status = 'Disponível',
      updated_at = now()
  where id in (
    select stock_item_id from public.sale_items where sale_id = old.id
  );

  -- 5. Decrement seller.total_sales (floor at 0).
  if old.seller_id is not null then
    update public.sellers
    set total_sales = greatest(0, coalesce(total_sales, 0) - coalesce(old.total, 0)),
        updated_at = now()
    where id = old.seller_id;
  end if;

  -- 6. Decrement customer.purchases (-1) and customer.total_spent (floor at 0).
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

-- Clean up legacy single-trade-in stock item after the sale row is deleted.
-- This runs in the AFTER phase: the sales row no longer exists, so there is no
-- live tuple to acquire a KEY SHARE lock on, and error 27000 cannot occur.
create or replace function public.handle_sale_after_delete_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete the legacy trade_in_id stock item only if it was not resold in another sale.
  if old.trade_in_id is not null then
    delete from public.stock_items
    where id = old.trade_in_id
      and not exists (
        select 1
        from public.sale_items
        where stock_item_id = old.trade_in_id
      );
  end if;

  return old;
end;
$$;

drop trigger if exists trg_sales_after_delete_cleanup on public.sales;
create trigger trg_sales_after_delete_cleanup
after delete on public.sales
for each row
execute function public.handle_sale_after_delete_cleanup();

commit;
