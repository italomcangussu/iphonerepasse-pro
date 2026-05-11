begin;

-- Centraliza o cancelamento de venda em uma operação transacional:
-- valida revenda de trade-in, reverte financeiro completo, restaura estoque
-- vendido e remove aparelhos recebidos na entrada.
create or replace function public.handle_sale_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gross_total numeric := coalesce(old.total, 0) + coalesce(old.trade_in_value, 0);
begin
  -- 1. Delete debt_payments that belong to debts from this sale.
  --    Do this first so that handle_debt_payment_after_delete does NOT try to
  --    restore remaining_amount on a debt we are about to delete.
  delete from public.debt_payments
  where debt_id in (
    select id from public.debts where sale_id = old.id
  );

  -- 2. Delete customer debts created by this sale (Devedor payment methods).
  delete from public.debts where sale_id = old.id;

  -- 3. Delete payable debt payments for store debts created by this sale.
  --    Do this before deleting payable_debts so the payment reversal trigger
  --    runs while the payable_debts row is not being deleted by FK cascade.
  delete from public.payable_debt_payments
  where payable_debt_id in (
    select id from public.payable_debts where sale_id = old.id
  );

  -- 4. Delete store payable debts created by trade-in client payment.
  delete from public.payable_debts where sale_id = old.id;

  -- 5. Delete all direct transactions linked to this sale.
  delete from public.transactions where sale_id = old.id;

  -- 6. Restore sold stock items back to 'Disponível'.
  update public.stock_items
  set status = 'Disponível',
      updated_at = now()
  where id in (
    select stock_item_id from public.sale_items where sale_id = old.id
  );

  -- 7. Decrement seller.total_sales (floor at 0).
  if old.seller_id is not null then
    update public.sellers
    set total_sales = greatest(0, coalesce(total_sales, 0) - v_gross_total),
        updated_at = now()
    where id = old.seller_id;
  end if;

  -- 8. Decrement customer.purchases (-1) and customer.total_spent (floor at 0).
  if old.customer_id is not null then
    update public.customers
    set purchases   = greatest(0, coalesce(purchases, 0) - 1),
        total_spent = greatest(0, coalesce(total_spent, 0) - v_gross_total),
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

create or replace function public.cancel_sale(p_sale_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_trade_in_stock_ids text[] := array[]::text[];
  v_resold_labels text;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem cancelar vendas.'
      using errcode = '42501';
  end if;

  select *
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Venda não encontrada: %', p_sale_id
      using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct stock_item_id) filter (where stock_item_id is not null), array[]::text[])
  into v_trade_in_stock_ids
  from public.sale_trade_in_items
  where sale_id = p_sale_id;

  if v_sale.trade_in_id is not null then
    select array_agg(distinct stock_item_id)
    into v_trade_in_stock_ids
    from unnest(v_trade_in_stock_ids || array[v_sale.trade_in_id]) as t(stock_item_id);
  end if;

  if cardinality(v_trade_in_stock_ids) > 0 then
    select string_agg(coalesce(nullif(si.imei, ''), sti.model, resold.stock_item_id), ', ')
    into v_resold_labels
    from (
      select distinct stock_item_id
      from public.sale_items
      where stock_item_id = any(v_trade_in_stock_ids)
        and sale_id <> p_sale_id
    ) resold
    left join public.stock_items si on si.id = resold.stock_item_id
    left join public.sale_trade_in_items sti
      on sti.sale_id = p_sale_id
     and sti.stock_item_id = resold.stock_item_id;

    if v_resold_labels is not null then
      raise exception 'Não é possível cancelar a venda: trade-in já revendido (%).', v_resold_labels
        using errcode = 'P0001';
    end if;
  end if;

  -- The sales delete trigger reverts debts, transactions, payable debts,
  -- customer/seller totals and sold stock status in the same transaction.
  delete from public.sales where id = p_sale_id;

  if cardinality(v_trade_in_stock_ids) > 0 then
    delete from public.stock_items si
    where si.id = any(v_trade_in_stock_ids)
      and not exists (
        select 1
        from public.sale_items sold_item
        where sold_item.stock_item_id = si.id
      );
  end if;
end;
$$;

revoke all on function public.handle_sale_before_delete() from public;
revoke all on function public.handle_sale_before_delete() from anon;
revoke all on function public.handle_sale_before_delete() from authenticated;

revoke all on function public.cancel_sale(text) from public;
revoke all on function public.cancel_sale(text) from anon;
grant execute on function public.cancel_sale(text) to authenticated;

commit;
