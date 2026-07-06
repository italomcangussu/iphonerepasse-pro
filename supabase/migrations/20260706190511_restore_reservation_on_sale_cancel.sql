begin;

-- Cancelar uma venda de aparelho que estava reservado deve religar a reserva.
--
-- Fluxo: um aparelho reservado por sinal ("Adiantamento de reserva") é vendido;
-- pdv_apply_reservation_deposit_payments marca a reserva status='sold' e grava
-- sold_sale_id. O trigger handle_sale_before_delete (BEFORE DELETE em sales) não
-- conhece reservas: ele apenas devolve o aparelho para 'Disponível'. Resultado
-- atual ao cancelar: o aparelho fica 'Disponível' (não 'Reservado') e a reserva
-- fica órfã em 'sold' (o FK sold_sale_id é `on delete set null`), some do item
-- (o loader só busca status='active') e a decisão de estornar/reter o sinal se
-- perde.
--
-- Correção: capturar as reservas consumidas por esta venda ANTES do delete
-- (senão o FK zera sold_sale_id), e depois do delete religá-las — aparelho volta
-- a 'Reservado' e reserva a 'active'. O sinal (transação com sale_id null) é
-- preservado pelo trigger e volta a constar na reserva; a decisão de estornar ou
-- reter fica para release_stock_reservation(p_stock_item_id, p_refund_deposit).
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
  v_sold_reservation_ids text[] := array[]::text[];
  v_reserved_stock_ids text[] := array[]::text[];
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

  -- Capturar as reservas consumidas por esta venda ANTES do delete: o FK
  -- sold_sale_id é `on delete set null`, então o delete zera essa referência.
  select coalesce(array_agg(id), array[]::text[]),
         coalesce(array_agg(stock_item_id), array[]::text[])
  into v_sold_reservation_ids, v_reserved_stock_ids
  from public.stock_reservations
  where sold_sale_id = p_sale_id
    and status = 'sold';

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

  -- Religar as reservas consumidas: reserva volta a 'active' e o aparelho a
  -- 'Reservado' (sobrepondo o 'Disponível' aplicado pelo trigger de exclusão).
  -- O sinal permanece intacto; estorno/retenção fica para a liberação.
  if cardinality(v_sold_reservation_ids) > 0 then
    update public.stock_reservations
       set status = 'active',
           sold_at = null,
           sold_sale_id = null,
           released_at = null
     where id = any(v_sold_reservation_ids);

    update public.stock_items
       set status = 'Reservado',
           updated_at = now()
     where id = any(v_reserved_stock_ids);
  end if;
end;
$$;

revoke all on function public.cancel_sale(text) from public;
revoke all on function public.cancel_sale(text) from anon;
grant execute on function public.cancel_sale(text) to authenticated;

notify pgrst, 'reload schema';

commit;
