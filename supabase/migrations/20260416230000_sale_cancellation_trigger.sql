begin;

-- =====================================================
-- Sale cancellation: BEFORE DELETE trigger on sales
-- Reverses all financial side-effects created by
-- handle_sale_after_insert + handle_payment_method_after_insert
-- =====================================================

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
  --    (The trigger on debt_payments fires but the debt row still exists at this
  --    point, so it runs cleanly; we then delete the debt in step 2.)
  delete from public.debt_payments
  where debt_id in (
    select id from public.debts where sale_id = old.id
  );

  -- 2. Delete debts created by this sale (Devedor payment methods).
  --    No AFTER DELETE trigger on debts, so this is safe.
  delete from public.debts where sale_id = old.id;

  -- 3. Delete all transactions linked to this sale.
  --    handle_transaction_after_delete may fire for any row whose debt_payment_id
  --    is not null, but since we deleted all debt_payments in step 1, those
  --    deletes are no-ops.
  delete from public.transactions where sale_id = old.id;

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

drop trigger if exists trg_sales_before_delete on public.sales;
create trigger trg_sales_before_delete
before delete on public.sales
for each row
execute function public.handle_sale_before_delete();

commit;
