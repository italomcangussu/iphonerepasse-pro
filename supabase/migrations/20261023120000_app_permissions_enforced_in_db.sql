-- A matriz de permissões (app_role_permissions, editada em Configurações >
-- Permissões por função) só valia na interface: as regras de acesso do banco e
-- as funções de venda/financeiro exigiam current_role() = 'admin'. Resultado: o
-- admin liberava algo para o gerente, a tela até mostrava, mas o banco recusava.
--
-- Aqui o banco passa a ler a mesma matriz. Admin continua com acesso total;
-- os demais papéis ganham só o que a matriz liberar. Nada é retirado de quem já
-- tinha acesso: as regras novas são "admin OU permissão na matriz".

-- Papel operacional: user_profiles.role guarda só admin/seller; o gerente é um
-- seller com app_role = 'manager' em user_access_roles (mesma regra do
-- AuthContext no front).
create or replace function public.app_operational_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when up.role = 'admin' then 'admin'
    when uar.app_role in ('manager', 'seller') then uar.app_role
    else up.role
  end
  from public.user_profiles up
  left join public.user_access_roles uar on uar.user_id = up.id
  where up.id = auth.uid()
  limit 1;
$$;

-- p_action: 'visible' | 'editable' | 'deletable'. Sem linha na matriz = negado.
create or replace function public.has_app_permission(p_key text, p_action text default 'visible')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.app_operational_role() = 'admin' then true
    else coalesce((
      select case p_action
        when 'visible' then arp.is_visible
        when 'editable' then arp.is_editable
        when 'deletable' then arp.is_deletable
        else false
      end
      from public.app_role_permissions arp
      where arp.role = public.app_operational_role()
        and arp.permission_key = p_key
      limit 1
    ), false)
  end;
$$;

revoke all on function public.app_operational_role() from public, anon;
revoke all on function public.has_app_permission(text, text) from public, anon;
grant execute on function public.app_operational_role() to authenticated, service_role;
grant execute on function public.has_app_permission(text, text) to authenticated, service_role;

-- Ajudante só desta migration: recria uma política com a expressão dada.
create or replace function pg_temp.set_policy(p_table text, p_name text, p_cmd text, p_expr text)
returns void
language plpgsql
as $$
begin
  execute format('drop policy if exists %I on public.%I', p_name, p_table);
  if p_cmd = 'INSERT' then
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p_name, p_table, p_expr);
  elsif p_cmd in ('SELECT', 'DELETE') then
    execute format('create policy %I on public.%I for %s to authenticated using (%s)', p_name, p_table, lower(p_cmd), p_expr);
  else
    execute format('create policy %I on public.%I for %s to authenticated using (%s) with check (%s)', p_name, p_table, lower(p_cmd), p_expr, p_expr);
  end if;
end;
$$;

create or replace function pg_temp.can(p_key text, p_action text)
returns text
language sql
immutable
as $$ select format('(select public.has_app_permission(%L, %L))', p_key, p_action) $$;

-- Tabelas de cadastro: leitura segue como estava; escrita/exclusão pela matriz.
select pg_temp.set_policy('business_profile', 'business_profile_insert', 'INSERT', pg_temp.can('profile_store', 'editable'));
select pg_temp.set_policy('business_profile', 'business_profile_update', 'UPDATE', pg_temp.can('profile_store', 'editable'));
select pg_temp.set_policy('card_fee_settings', 'card_fee_settings_insert', 'INSERT', pg_temp.can('card_fees', 'editable'));
select pg_temp.set_policy('card_fee_settings', 'card_fee_settings_update', 'UPDATE', pg_temp.can('card_fees', 'editable'));
select pg_temp.set_policy('customers', 'customers_delete', 'DELETE', pg_temp.can('clients', 'deletable'));
select pg_temp.set_policy('stock_items', 'stock_items_delete', 'DELETE', pg_temp.can('inventory', 'deletable'));
select pg_temp.set_policy('costs', 'costs_delete', 'DELETE', pg_temp.can('inventory', 'deletable'));
select pg_temp.set_policy('cost_history', 'cost_history_delete', 'DELETE', pg_temp.can('inventory', 'deletable'));
select pg_temp.set_policy('device_catalog', 'device_catalog_update', 'UPDATE', pg_temp.can('inventory', 'editable'));
select pg_temp.set_policy('device_catalog', 'device_catalog_delete', 'DELETE', pg_temp.can('inventory', 'deletable'));
select pg_temp.set_policy('parts_inventory', 'parts_inventory_delete', 'DELETE', pg_temp.can('parts_stock', 'deletable'));
select pg_temp.set_policy('sales', 'sales_delete', 'DELETE', pg_temp.can('pdv', 'deletable'));
select pg_temp.set_policy('sale_items', 'sale_items_delete', 'DELETE', pg_temp.can('pdv', 'deletable'));
select pg_temp.set_policy('sale_trade_in_items', 'sale_trade_in_items_delete', 'DELETE', pg_temp.can('pdv', 'deletable'));
select pg_temp.set_policy('sellers', 'sellers_insert', 'INSERT', pg_temp.can('sellers', 'editable'));
select pg_temp.set_policy('sellers', 'sellers_update', 'UPDATE', pg_temp.can('sellers', 'editable'));
select pg_temp.set_policy('sellers', 'sellers_delete', 'DELETE', pg_temp.can('sellers', 'deletable'));
select pg_temp.set_policy('stores', 'stores_insert', 'INSERT', pg_temp.can('stores', 'editable'));
select pg_temp.set_policy('stores', 'stores_update', 'UPDATE', pg_temp.can('stores', 'editable'));
select pg_temp.set_policy('stores', 'stores_delete', 'DELETE', pg_temp.can('stores', 'deletable'));
select pg_temp.set_policy('warranty_public_tokens', 'warranty_public_tokens_insert', 'INSERT', pg_temp.can('warranties', 'editable'));
select pg_temp.set_policy('warranty_public_tokens', 'warranty_public_tokens_update', 'UPDATE', pg_temp.can('warranties', 'editable'));
select pg_temp.set_policy('warranty_public_tokens', 'warranty_public_tokens_delete', 'DELETE', pg_temp.can('warranties', 'deletable'));
select pg_temp.set_policy('finance_categories', 'finance_categories_insert', 'INSERT', pg_temp.can('finance', 'editable'));
select pg_temp.set_policy('finance_categories', 'finance_categories_update', 'UPDATE', pg_temp.can('finance', 'editable'));
select pg_temp.set_policy('finance_categories', 'finance_categories_delete', 'DELETE', pg_temp.can('finance', 'deletable'));
select pg_temp.set_policy('app_user_activity_logs', 'app_user_activity_logs_select', 'SELECT', pg_temp.can('user_logs', 'visible'));

-- Lista de usuários: o log de usuários e a tela de permissões precisam dela.
select pg_temp.set_policy('user_access_roles', 'user_access_roles_select', 'SELECT',
  '(select auth.uid()) = user_id or ' || pg_temp.can('user_logs', 'visible') || ' or ' || pg_temp.can('permissions_privacy', 'visible'));

-- Matriz: quem tem "Permissões e Privacidade" editável altera gerente/vendedor,
-- nunca a linha do admin.
select pg_temp.set_policy('app_role_permissions', 'app_role_permissions_insert', 'INSERT',
  '(select public.app_operational_role()) = ''admin'' or (role <> ''admin'' and ' || pg_temp.can('permissions_privacy', 'editable') || ')');
select pg_temp.set_policy('app_role_permissions', 'app_role_permissions_update', 'UPDATE',
  '(select public.app_operational_role()) = ''admin'' or (role <> ''admin'' and ' || pg_temp.can('permissions_privacy', 'editable') || ')');

-- Tabelas financeiras tinham uma política única "admin_all"; viram quatro.
create or replace function pg_temp.set_crud_policies(p_table text, p_read text, p_write text, p_delete text)
returns void
language plpgsql
as $$
begin
  execute format('drop policy if exists %I on public.%I', p_table || '_admin_all', p_table);
  perform pg_temp.set_policy(p_table, p_table || '_select', 'SELECT', p_read);
  perform pg_temp.set_policy(p_table, p_table || '_insert', 'INSERT', p_write);
  perform pg_temp.set_policy(p_table, p_table || '_update', 'UPDATE', p_write);
  perform pg_temp.set_policy(p_table, p_table || '_delete', 'DELETE', p_delete);
end;
$$;

-- Devedores aparecem tanto em /debtors quanto no Financeiro.
select pg_temp.set_crud_policies('debts',
  pg_temp.can('debtors', 'visible') || ' or ' || pg_temp.can('finance', 'visible'),
  pg_temp.can('debtors', 'editable') || ' or ' || pg_temp.can('finance', 'editable'),
  pg_temp.can('debtors', 'deletable') || ' or ' || pg_temp.can('finance', 'deletable'));
select pg_temp.set_crud_policies('debt_payments',
  pg_temp.can('debtors', 'visible') || ' or ' || pg_temp.can('finance', 'visible'),
  pg_temp.can('debtors', 'editable') || ' or ' || pg_temp.can('finance', 'editable'),
  pg_temp.can('debtors', 'deletable') || ' or ' || pg_temp.can('finance', 'deletable'));
select pg_temp.set_crud_policies('transactions',
  pg_temp.can('finance', 'visible'), pg_temp.can('finance', 'editable'), pg_temp.can('finance', 'deletable'));
select pg_temp.set_crud_policies('creditors',
  pg_temp.can('payable_debts', 'visible'), pg_temp.can('payable_debts', 'editable'), pg_temp.can('payable_debts', 'deletable'));
select pg_temp.set_crud_policies('payable_debts',
  pg_temp.can('payable_debts', 'visible'), pg_temp.can('payable_debts', 'editable'), pg_temp.can('payable_debts', 'deletable'));
select pg_temp.set_crud_policies('payable_debt_payments',
  pg_temp.can('payable_debts', 'visible'), pg_temp.can('payable_debts', 'editable'), pg_temp.can('payable_debts', 'deletable'));

-- Funções que travavam em admin: troca só a checagem, o resto do corpo fica igual.
create or replace function pg_temp.swap_admin_check(p_fn regprocedure, p_old text, p_new text)
returns void
language plpgsql
as $$
declare
  v_def text := pg_get_functiondef(p_fn);
begin
  if position(p_old in v_def) = 0 then
    raise exception 'Checagem de admin não encontrada em %', p_fn;
  end if;
  execute replace(v_def, p_old, p_new);
end;
$$;

select pg_temp.swap_admin_check('public.cancel_sale(text)',
  $$if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem cancelar vendas.'$$,
  $$if not public.has_app_permission('pdv', 'deletable') then
    raise exception 'Sem permissão para cancelar vendas.'$$);

select pg_temp.swap_admin_check('public.update_sale_full(text, jsonb)',
  $$if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem editar vendas.'$$,
  $$if not public.has_app_permission('pdv', 'editable') then
    raise exception 'Sem permissão para editar vendas.'$$);

select pg_temp.swap_admin_check('public.cancel_transaction(text)',
  $$if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem cancelar lançamentos.'$$,
  $$if not public.has_app_permission('finance', 'deletable') then
    raise exception 'Sem permissão para cancelar lançamentos.'$$);

select pg_temp.swap_admin_check('public.delete_debt_cascade(text)',
  $$if public.current_role() <> 'admin' then
    raise exception 'Only admins can delete debts.'$$,
  $$if not (public.has_app_permission('debtors', 'deletable') or public.has_app_permission('finance', 'deletable')) then
    raise exception 'Sem permissão para excluir dívidas.'$$);
