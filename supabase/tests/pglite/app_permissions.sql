-- A matriz de permissões (app_role_permissions) vale também no banco.
create temp table u as select fab.usuario('adm-perm@x.com') as adm, fab.usuario('ger-perm@x.com') as ger, fab.usuario('vend-perm@x.com') as vend;
grant select on u to authenticated, service_role;
insert into public.user_profiles (id, role) select adm, 'admin' from u;
insert into public.user_profiles (id, role) select ger, 'seller' from u;
insert into public.user_profiles (id, role) select vend, 'seller' from u;
insert into public.user_access_roles (user_id, app_role, display_name, email) select ger, 'manager', 'Gerente', 'ger-perm@x.com' from u;
insert into public.user_access_roles (user_id, app_role, display_name, email) select vend, 'seller', 'Vendedor', 'vend-perm@x.com' from u;

delete from public.app_role_permissions where role in ('manager', 'seller');
insert into public.app_role_permissions (role, permission_key, label, is_visible, is_editable, is_deletable) values
  ('manager', 'card_fees', 'Taxas', true, true, false),
  ('manager', 'pdv', 'PDV', true, true, true),
  ('manager', 'sellers', 'Vendedores', true, false, false),
  ('manager', 'finance', 'Financeiro', false, false, false),
  ('seller', 'card_fees', 'Taxas', true, false, false),
  ('seller', 'pdv', 'PDV', true, false, false);

insert into public.card_fee_settings (id, visa_master_rates, other_rates) select 'default', r, r from (select jsonb_agg(2.5) r from generate_series(1,18)) x on conflict (id) do nothing;
insert into public.sellers (id, name) values ('sel_perm', 'Fulano');
insert into public.transactions (id, type, amount, category, description, date, account)
  select 'trx_perm', 'IN', 10, 'Outros', 'teste', now(), 'Cofre'
  where not exists (select 1 from public.transactions where id = 'trx_perm');

-- Papel operacional segue o AuthContext.
select fab.como('authenticated', (select ger from u));
do $$ begin
  assert public.app_operational_role() = 'manager', 'gerente resolvido por user_access_roles';
  assert public.has_app_permission('pdv', 'deletable'), 'gerente com pdv excluível';
  assert not public.has_app_permission('sellers', 'editable'), 'sellers só visível';
  assert not public.has_app_permission('chave_inexistente', 'visible'), 'sem linha = negado';
end $$;

-- Gerente edita taxa de cartão (liberado na matriz) e não edita vendedor (não liberado).
select fab.espera_afetadas($$update public.card_fee_settings set debit_rate = 2 where id = 'default'$$, 1);
select fab.espera_afetadas($$update public.sellers set name = 'X' where id = 'sel_perm'$$, 0);
-- Financeiro desligado: não enxerga lançamentos.
select fab.espera_linhas($$select 1 from public.transactions where id = 'trx_perm'$$, 0);
-- Matriz de permissões: sem "Permissões e Privacidade" editável não altera nada.
select fab.espera_erro($$insert into public.app_role_permissions (role, permission_key, label, is_visible) values ('manager', 'debtors', 'D', true)$$, 'row-level security');

-- Vendedor: mesma tabela, sem edição de taxa.
select fab.como('authenticated', (select vend from u));
do $$ begin
  assert public.app_operational_role() = 'seller', 'vendedor';
  assert not public.has_app_permission('pdv', 'deletable'), 'vendedor não cancela venda';
end $$;
select fab.espera_afetadas($$update public.card_fee_settings set debit_rate = 3 where id = 'default'$$, 0);
select fab.espera_erro($$select public.cancel_sale('venda_inexistente')$$, 'Sem permissão para cancelar vendas');
select fab.espera_erro($$select public.update_sale_full('venda_inexistente', '{}'::jsonb)$$, 'Sem permissão para editar vendas');

-- Gerente passa da checagem de permissão (cai no "venda não encontrada").
select fab.como('authenticated', (select ger from u));
select fab.espera_erro($$select public.cancel_sale('venda_inexistente')$$, 'Venda não encontrada');
select fab.espera_erro($$select public.cancel_transaction('trx_perm')$$, 'Sem permissão para cancelar lançamentos');

-- Admin continua com tudo.
select fab.como('authenticated', (select adm from u));
do $$ begin
  assert public.has_app_permission('finance', 'deletable'), 'admin total';
end $$;
select fab.espera_linhas($$select 1 from public.transactions where id = 'trx_perm'$$, 1);
select fab.espera_afetadas($$update public.sellers set name = 'Y' where id = 'sel_perm'$$, 1);
