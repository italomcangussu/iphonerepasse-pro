-- Transferir aparelhos entre empresas como venda.
--
-- Na transferência de aparelhos para OUTRA empresa, o admin pode escolher
-- "vender": a empresa de origem recebe o valor (receita "Venda entre empresas")
-- e a de destino registra a compra (despesa "Compra entre empresas") na mesma
-- conta. O valor de cada aparelho começa no custo dele (compra + custos
-- lançados) e pode ser editado. Na venda, o aparelho chega ao destino com o
-- valor de compra = valor da venda, e os custos lançados ficam na origem (ela
-- já foi ressarcida por eles). Sem venda, nada muda: aparelho e custos vão
-- juntos, sem lançamento.

-- O custo entra na lista de aparelhos transferíveis (muda o tipo de retorno).
drop function if exists public.tenant_transferable_stock(text);

create function public.tenant_transferable_stock(p_store_id text)
returns table (
  id text, type text, model text, color text, capacity text, imei text,
  condition text, status text, battery_health integer, sell_price numeric,
  cost numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform private.assert_tenant_admin((select s.tenant_id from public.stores s where s.id = p_store_id));

  return query
  select si.id, si.type, si.model, si.color, si.capacity, si.imei,
         si.condition, si.status, si.battery_health, si.sell_price,
         coalesce(si.purchase_price, 0)
           + coalesce((select sum(c.amount) from public.costs c where c.stock_item_id = si.id), 0)
  from public.stock_items si
  where si.store_id = p_store_id
    and si.tenant_id = (select s.tenant_id from public.stores s where s.id = p_store_id)
    and private.stock_item_is_transferable(si)
  order by si.model, si.capacity, si.id;
end;
$$;

-- Valida o pedido de venda e devolve o preço de cada aparelho.
create or replace function private.stock_sale_prices(p_sale jsonb, p_item_ids text[])
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  v_id text;
  v_price numeric;
  v_prices jsonb := '{}'::jsonb;
begin
  if coalesce(p_sale ->> 'account', '') not in ('Conta Bancária', 'Cofre') then
    raise exception 'Escolha a conta da venda: Conta Bancária ou Cofre.' using errcode = '22023';
  end if;

  foreach v_id in array p_item_ids loop
    begin
      v_price := round((p_sale -> 'prices' ->> v_id)::numeric, 2);
    exception when others then
      v_price := null;
    end;
    if v_price is null or v_price < 0 then
      raise exception 'Informe o valor de venda de cada aparelho (zero ou mais).' using errcode = '22023';
    end if;
    v_prices := v_prices || jsonb_build_object(v_id, v_price);
  end loop;

  return v_prices;
end;
$$;

-- Lança a venda entre empresas: receita na origem e despesa no destino.
create or replace function private.book_stock_sale(
  p_from uuid, p_to uuid, p_item_ids text[], p_prices jsonb, p_account text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_total numeric;
  v_items text;
  v_from_name text;
  v_to_name text;
  v_in_id text := 'trx_' || replace(gen_random_uuid()::text, '-', '');
  v_out_id text := 'trx_' || replace(gen_random_uuid()::text, '-', '');
begin
  select coalesce(sum((p_prices ->> id)::numeric), 0) into v_total
  from unnest(p_item_ids) as id;

  select string_agg(concat_ws(' ', si.model, si.capacity), ', ' order by si.model) into v_items
  from public.stock_items si where si.id = any (p_item_ids);

  select name into v_from_name from public.tenants where id = p_from;
  select name into v_to_name from public.tenants where id = p_to;

  update public.stock_items si
  set purchase_price = (p_prices ->> si.id)::numeric
  where si.id = any (p_item_ids);

  insert into public.transactions (id, type, category, amount, date, description, account, tenant_id)
  values
    (v_in_id, 'IN', 'Venda entre empresas', v_total, now(),
     format('Venda para %s · %s', v_to_name, v_items), p_account, p_from),
    (v_out_id, 'OUT', 'Compra entre empresas', v_total, now(),
     format('Compra da %s · %s', v_from_name, v_items), p_account, p_to);

  return jsonb_build_object(
    'account', p_account, 'total', v_total, 'prices', p_prices,
    'inTransactionId', v_in_id, 'outTransactionId', v_out_id
  );
end;
$$;

drop function if exists public.transfer_stock_items(text[], text);

-- p_sale (opcional, só entre empresas): {"account": "Conta Bancária" | "Cofre",
-- "prices": {"<id do aparelho>": valor}}.
create function public.transfer_stock_items(
  p_item_ids text[], p_target_store_id text, p_sale jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_target_tenant uuid;
  v_from record;
  v_blocked integer;
  v_total integer := 0;
  v_prices jsonb;
  v_sale jsonb;
  v_sale_total numeric := 0;
begin
  if coalesce(cardinality(p_item_ids), 0) = 0 then
    raise exception 'Escolha pelo menos um aparelho.' using errcode = '22023';
  end if;

  select tenant_id into v_target_tenant from public.stores where id = p_target_store_id;
  if v_target_tenant is null then
    raise exception 'Loja de destino não encontrada.' using errcode = 'P0002';
  end if;
  perform private.assert_tenant_admin(v_target_tenant);

  if (select count(*) from public.stock_items where id = any (p_item_ids)) <> cardinality(p_item_ids) then
    raise exception 'Algum aparelho não foi encontrado.' using errcode = 'P0002';
  end if;

  select count(*) into v_blocked
  from public.stock_items si
  where si.id = any (p_item_ids)
    and (not public.is_tenant_admin(si.tenant_id) or not private.stock_item_is_transferable(si));
  if v_blocked > 0 then
    raise exception 'Só aparelhos disponíveis, sem reserva, de empresas que você administra podem ser transferidos.' using errcode = '42501';
  end if;

  if p_sale is not null then
    if exists (select 1 from public.stock_items where id = any (p_item_ids) and tenant_id = v_target_tenant) then
      raise exception 'A venda só vale para aparelhos que mudam de empresa.' using errcode = '22023';
    end if;
    v_prices := private.stock_sale_prices(p_sale, p_item_ids);
  end if;

  perform set_config('app.tenant_transfer', 'on', true);

  for v_from in
    select si.tenant_id, si.store_id, array_agg(si.id) as ids
    from public.stock_items si
    where si.id = any (p_item_ids)
    group by si.tenant_id, si.store_id
  loop
    v_sale := null;
    if v_prices is not null then
      v_sale := private.book_stock_sale(v_from.tenant_id, v_target_tenant, v_from.ids, v_prices, p_sale ->> 'account');
      v_sale_total := v_sale_total + (v_sale ->> 'total')::numeric;
    else
      -- Sem venda, os custos lançados acompanham o aparelho.
      update public.costs set tenant_id = v_target_tenant where stock_item_id = any (v_from.ids);
    end if;

    update public.stock_items
    set tenant_id = v_target_tenant, store_id = p_target_store_id, updated_at = now()
    where id = any (v_from.ids);
    v_total := v_total + cardinality(v_from.ids);

    insert into public.tenant_transfers (kind, from_tenant_id, to_tenant_id, store_id, target_store_id, item_ids, summary, performed_by)
    values ('stock', v_from.tenant_id, v_target_tenant, v_from.store_id, p_target_store_id, v_from.ids,
            case when v_sale is null then '{}'::jsonb else jsonb_build_object('sale', v_sale) end,
            auth.uid());
  end loop;

  perform set_config('app.tenant_transfer', 'off', true);

  return jsonb_build_object(
    'moved', v_total,
    'targetStoreId', p_target_store_id,
    'saleTotal', case when v_prices is null then null else v_sale_total end
  );
end;
$$;

revoke all on function private.stock_sale_prices(jsonb, text[]) from public, anon, authenticated;
revoke all on function private.book_stock_sale(uuid, uuid, text[], jsonb, text) from public, anon, authenticated;
revoke all on function public.tenant_transferable_stock(text) from public, anon;
revoke all on function public.transfer_stock_items(text[], text, jsonb) from public, anon;
grant execute on function public.tenant_transferable_stock(text) to authenticated, service_role;
grant execute on function public.transfer_stock_items(text[], text, jsonb) to authenticated, service_role;
