begin;

create or replace function public.pdv_hydrate_sale_json(p_sale_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(s)
    || jsonb_build_object(
      'sale_items', coalesce((
        select jsonb_agg(to_jsonb(si) || jsonb_build_object('stock_item', to_jsonb(st)))
        from public.sale_items si
        left join public.stock_items st on st.id = si.stock_item_id
        where si.sale_id = s.id
      ), '[]'::jsonb),
      'payment_methods', coalesce((
        select jsonb_agg(to_jsonb(pm))
        from public.payment_methods pm
        where pm.sale_id = s.id
      ), '[]'::jsonb),
      'sale_trade_in_items', coalesce((
        select jsonb_agg(to_jsonb(sti))
        from public.sale_trade_in_items sti
        where sti.sale_id = s.id
      ), '[]'::jsonb)
    )
  from public.sales s
  where s.id = p_sale_id;
$$;

create or replace function public.pdv_insert_sale_full_payload(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'pdv_insert_sale_full_payload ainda não implementada.' using errcode = '0A000';
end;
$$;

create or replace function public.pdv_rebuild_sale_full_payload(p_sale_id text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'pdv_rebuild_sale_full_payload ainda não implementada.' using errcode = '0A000';
end;
$$;

create or replace function public.create_sale_full(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id text := p_payload->>'id';
  v_existing public.sales%rowtype;
  v_result jsonb;
begin
  if public.current_role() not in ('admin', 'seller') then
    raise exception 'Usuário sem permissão para criar venda.' using errcode = '42501';
  end if;

  if coalesce(v_sale_id, '') = '' then
    raise exception 'ID da venda é obrigatório.' using errcode = '22023';
  end if;

  select * into v_existing from public.sales where id = v_sale_id for update;

  if found then
    delete from public.debt_payments where debt_id in (select id from public.debts where sale_id = v_sale_id);
    delete from public.debts where sale_id = v_sale_id;
    delete from public.payable_debt_payments where payable_debt_id in (select id from public.payable_debts where sale_id = v_sale_id);
    delete from public.payable_debts where sale_id = v_sale_id;
    delete from public.transactions where sale_id = v_sale_id;
    delete from public.sale_trade_in_items where sale_id = v_sale_id;
    delete from public.payment_methods where sale_id = v_sale_id;
    delete from public.sale_items where sale_id = v_sale_id;
    delete from public.sales where id = v_sale_id;
  end if;

  perform public.pdv_insert_sale_full_payload(p_payload);
  v_result := public.pdv_hydrate_sale_json(v_sale_id);

  return v_result;
end;
$$;

create or replace function public.update_sale_full(p_sale_id text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.sales%rowtype;
  v_result jsonb;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem editar vendas.' using errcode = '42501';
  end if;

  select * into v_existing from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda não encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  perform public.pdv_rebuild_sale_full_payload(p_sale_id, p_payload);
  v_result := public.pdv_hydrate_sale_json(p_sale_id);

  return v_result;
end;
$$;

revoke all on function public.create_sale_full(jsonb) from public;
revoke all on function public.create_sale_full(jsonb) from anon;
grant execute on function public.create_sale_full(jsonb) to authenticated;

revoke all on function public.update_sale_full(text, jsonb) from public;
revoke all on function public.update_sale_full(text, jsonb) from anon;
grant execute on function public.update_sale_full(text, jsonb) to authenticated;

commit;
