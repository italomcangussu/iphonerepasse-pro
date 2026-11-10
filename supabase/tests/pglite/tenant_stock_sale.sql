-- Transferência de aparelhos entre empresas como venda.
-- O snapshot do banco de teste tem só o schema: a empresa principal entra aqui.
insert into public.tenants (id, name, is_primary) values (private.primary_tenant_id(), 'iPhone Repasse', true) on conflict do nothing;

create temp table u as select fab.usuario('dono-venda@x.com') as dono;
grant select on u to authenticated, service_role;
insert into public.user_profiles (id, role) select dono, 'admin' from u;

insert into public.stores (id, name, city) values ('loja_a', 'HDI', 'Fortaleza'), ('loja_a2', 'GR', 'Fortaleza');
insert into public.stock_items (id, type, model, capacity, condition, status, store_id, purchase_price) values
  ('v_1', 'iPhone', 'iPhone 15', '128GB', 'Seminovo', 'Disponível', 'loja_a', 3000),
  ('v_2', 'iPhone', 'iPhone 14', '256GB', 'Seminovo', 'Disponível', 'loja_a', 2000),
  ('v_3', 'iPhone', 'iPhone 13', '128GB', 'Seminovo', 'Disponível', 'loja_a', 1500);
insert into public.costs (id, stock_item_id, description, amount) values ('c_v1', 'v_1', 'Tela', 150);

select fab.como('authenticated', (select dono from u));
do $$
declare v_ctx jsonb;
begin
  v_ctx := public.create_tenant('Empresa Nova');
  perform set_config('mt.b', v_ctx ->> 'id', false);
end $$;
select public.set_active_tenant(current_setting('mt.b')::uuid);
insert into public.stores (id, name, city) values ('loja_b', 'Loja B', 'Sobral');
select public.set_active_tenant(private.primary_tenant_id());

-- O custo listado = compra + custos lançados.
do $$ begin
  assert (select cost from public.tenant_transferable_stock('loja_a') where id = 'v_1') = 3150, 'custo do v_1';
  assert (select cost from public.tenant_transferable_stock('loja_a') where id = 'v_2') = 2000, 'custo do v_2';
end $$;

-- Pedidos de venda inválidos.
select fab.espera_erro($$select public.transfer_stock_items(array['v_1'], 'loja_a2', '{"account":"Cofre","prices":{"v_1":100}}')$$, 'só vale para aparelhos que mudam de empresa');
select fab.espera_erro($$select public.transfer_stock_items(array['v_1'], 'loja_b', '{"account":"Devedores","prices":{"v_1":100}}')$$, 'Escolha a conta');
select fab.espera_erro($$select public.transfer_stock_items(array['v_1','v_2'], 'loja_b', '{"account":"Cofre","prices":{"v_1":100}}')$$, 'Informe o valor');
select fab.espera_erro($$select public.transfer_stock_items(array['v_1'], 'loja_b', '{"account":"Cofre","prices":{"v_1":-1}}')$$, 'Informe o valor');
select fab.espera_erro($$select public.transfer_stock_items(array['v_1'], 'loja_b', '{"account":"Cofre","prices":{"v_1":"abc"}}')$$, 'Informe o valor');

-- Venda com valor editado: origem recebe, destino paga, custos ficam na origem.
do $$
declare v_res jsonb;
begin
  v_res := public.transfer_stock_items(array['v_1','v_2'], 'loja_b',
    '{"account":"Conta Bancária","prices":{"v_1":3500.555,"v_2":2000}}');
  assert (v_res ->> 'moved')::int = 2, 'moveu dois';
  assert (v_res ->> 'saleTotal')::numeric = 5500.56, 'total da venda';
end $$;

select fab.dono();
do $$
declare v_b uuid := current_setting('mt.b')::uuid;
begin
  assert (select purchase_price from public.stock_items where id = 'v_1') = 3500.56, 'compra = valor da venda';
  assert (select tenant_id from public.stock_items where id = 'v_1') = v_b, 'aparelho mudou de empresa';
  assert (select tenant_id from public.costs where id = 'c_v1') = private.primary_tenant_id(), 'custo ficou na origem';
  assert (select count(*) from public.transactions where category = 'Venda entre empresas'
          and type = 'IN' and tenant_id = private.primary_tenant_id() and amount = 5500.56 and account = 'Conta Bancária') = 1, 'receita na origem';
  assert (select count(*) from public.transactions where category = 'Compra entre empresas'
          and type = 'OUT' and tenant_id = v_b and amount = 5500.56 and account = 'Conta Bancária') = 1, 'despesa no destino';
  assert (select description from public.transactions where category = 'Venda entre empresas') like 'Venda para Empresa Nova · %', 'descrição da venda';
  assert (select summary -> 'sale' ->> 'total' from public.tenant_transfers where 'v_1' = any (item_ids))::numeric = 5500.56, 'venda no histórico';
end $$;

-- Sem venda: custos vão junto e nada é lançado.
select fab.como('authenticated', (select dono from u));
select public.transfer_stock_items(array['v_3'], 'loja_b');
select fab.dono();
do $$ begin
  assert (select purchase_price from public.stock_items where id = 'v_3') = 1500, 'compra mantida';
  assert (select count(*) from public.transactions where category in ('Venda entre empresas', 'Compra entre empresas')) = 2, 'sem lançamento novo';
end $$;
