-- Multiempresa: isolamento, papéis por empresa, criação de empresa e transferências.
-- O snapshot do banco de teste tem só o schema: a empresa principal entra aqui.
insert into public.tenants (id, name, is_primary) values (private.primary_tenant_id(), 'iPhone Repasse', true) on conflict do nothing;

create temp table u as select
  fab.usuario('dono-mt@x.com') as dono,
  fab.usuario('adm-b-mt@x.com') as adm_b,
  fab.usuario('vend-mt@x.com') as vend,
  fab.usuario('ger-mt@x.com') as ger;
grant select on u to authenticated, service_role;

insert into public.user_profiles (id, role) select dono, 'admin' from u;
insert into public.user_profiles (id, role) select vend, 'seller' from u;
insert into public.user_profiles (id, role) select ger, 'seller' from u;
insert into public.user_access_roles (user_id, app_role, display_name, email) select ger, 'manager', 'Gerente', 'ger-mt@x.com' from u;
insert into public.user_access_roles (user_id, app_role, display_name, email) select adm_b, 'seller', 'Admin B', 'adm-b-mt@x.com' from u;

-- Dados atuais (sem usuário) caem na empresa principal.
insert into public.app_role_permissions (role, permission_key, label, is_visible, is_editable, is_deletable)
  values ('seller', 'inventory', 'Estoque', true, false, false) on conflict do nothing;
insert into public.card_fee_settings (id, visa_master_rates, other_rates)
  select 'default', r, r from (select jsonb_agg(2.5) r from generate_series(1,18)) x on conflict do nothing;
insert into public.crm_settings (id, value_bool, value_text) values ('default_crm_store_id', false, 'loja_hdi') on conflict do nothing;
insert into public.stores (id, name, city) values ('loja_hdi', 'HDI', 'Fortaleza'), ('loja_gr', 'GR Imports', 'Fortaleza');
insert into public.stock_items (id, type, model, condition, status, store_id) values
  ('it_1', 'iPhone', 'iPhone 15', 'Seminovo', 'Disponível', 'loja_gr'),
  ('it_2', 'iPhone', 'iPhone 14', 'Seminovo', 'Disponível', 'loja_gr'),
  ('it_vendido', 'iPhone', 'iPhone 13', 'Seminovo', 'Vendido', 'loja_gr'),
  ('it_res', 'iPhone', 'iPhone 12', 'Seminovo', 'Disponível', 'loja_hdi');
insert into public.costs (id, stock_item_id, description, amount) values ('custo_1', 'it_1', 'Tela', 100);
insert into public.stock_reservations (id, stock_item_id, customer_name, customer_phone, status)
  values ('res_1', 'it_res', 'Cliente', '85999990000', 'active');
insert into public.crm_leads (id, store_id, phone) values ('lead_gr', 'loja_gr', '85988880000');

do $$ begin
  assert (select tenant_id from public.stock_items where id = 'it_1') = private.primary_tenant_id(), 'item herda empresa principal';
  assert (select tenant_id from public.costs where id = 'custo_1') = private.primary_tenant_id(), 'custo herda do item';
  assert (select role from public.tenant_members where user_id = (select ger from u)) = 'manager', 'gerente pelo user_access_roles';
  assert (select role from public.tenant_members where user_id = (select dono from u)) = 'admin', 'dono admin da principal';
end $$;

-- Vendedor não cria empresa; o dono cria.
select fab.como('authenticated', (select vend from u));
select fab.espera_erro($$select public.create_tenant('Outra')$$, 'Apenas administradores da empresa principal');

select fab.como('authenticated', (select dono from u));
do $$
declare v_ctx jsonb;
begin
  v_ctx := public.create_tenant('Nova Empresa');
  perform set_config('mt.b', v_ctx ->> 'id', false);
  assert public.my_tenant_context() -> 'tenants' @> '[{"name":"Nova Empresa","role":"admin"}]', 'dono vira admin da nova';
end $$;
select fab.espera_erro($$select public.create_tenant('nova empresa')$$, 'Já existe uma empresa');

-- A nova empresa nasce com a configuração copiada (menos a loja padrão do CRM).
select fab.dono();
do $$ begin
  assert exists (select 1 from public.app_role_permissions where tenant_id = current_setting('mt.b')::uuid and permission_key = 'inventory'), 'permissões copiadas';
  assert exists (select 1 from public.card_fee_settings where tenant_id = current_setting('mt.b')::uuid and id = 'default'), 'taxas copiadas';
  assert not exists (select 1 from public.crm_settings where tenant_id = current_setting('mt.b')::uuid and id = 'default_crm_store_id'), 'loja padrão não copiada';
  assert (select name from public.business_profile where tenant_id = current_setting('mt.b')::uuid) = 'Nova Empresa', 'perfil com o nome novo';
end $$;

-- Admin da nova empresa: só por e-mail de usuário existente.
select fab.como('authenticated', (select dono from u));
select fab.espera_erro($$select public.tenant_add_member(current_setting('mt.b')::uuid, 'ninguem@x.com')$$, 'Nenhum usuário com esse e-mail');
select public.tenant_add_member(current_setting('mt.b')::uuid, 'adm-b-mt@x.com', 'admin');
select public.tenant_remove_member(current_setting('mt.b')::uuid, (select adm_b from u));
select fab.espera_erro($$select public.tenant_remove_member(current_setting('mt.b')::uuid, (select dono from u))$$, 'pelo menos um administrador');
select public.tenant_add_member(current_setting('mt.b')::uuid, 'adm-b-mt@x.com', 'admin');

-- Admin B só enxerga a nova empresa, vazia; não troca para a principal.
select fab.como('authenticated', (select adm_b from u));
do $$ begin
  assert public.current_tenant_id() = current_setting('mt.b')::uuid, 'empresa ativa = única empresa';
  assert public.app_operational_role() = 'admin', 'admin na nova';
  assert public."current_role"() = 'admin', 'current_role por empresa';
end $$;
select fab.espera_linhas($$select 1 from public.stock_items$$, 0);
select fab.espera_linhas($$select 1 from public.stores$$, 0);
select fab.espera_erro($$select public.set_active_tenant(private.primary_tenant_id())$$, 'não faz parte');
select fab.espera_erro($$select public.create_tenant('Terceira')$$, 'Apenas administradores da empresa principal');
-- Nem forçando tenant_id da principal.
select fab.espera_erro($$insert into public.customers (id, name, tenant_id) values ('cli_x', 'X', private.primary_tenant_id())$$, 'row-level security');
-- Função com p_store_id recusa loja de outra empresa; função SQL só não devolve nada.
select fab.espera_erro($$select public.get_crm_statistics('loja_gr')$$, 'Loja não encontrada nesta empresa');
select fab.espera_linhas($$select * from public.get_cashback_summary('loja_gr')$$, 0);
select fab.espera_erro($$select public.transfer_stock_items(array['it_1'], 'loja_gr')$$, 'Apenas administradores');

-- Loja criada na nova empresa fica nela; o cpf pode repetir entre empresas.
insert into public.stores (id, name, city) values ('loja_b', 'Loja B', 'Sobral');
insert into public.customers (id, name, cpf) values ('cli_b', 'Cliente B', '11122233344');
select fab.espera_linhas($$select 1 from public.stores where id = 'loja_b'$$, 1);

-- Dono vê as duas empresas e alterna.
select fab.como('authenticated', (select dono from u));
do $$ begin
  assert public.current_tenant_id() = private.primary_tenant_id(), 'dono começa na principal';
  assert jsonb_array_length(public.my_tenant_context() -> 'tenants') = 2, 'dono vê duas empresas';
end $$;
insert into public.customers (id, name, cpf) values ('cli_a', 'Cliente A', '11122233344');
select fab.espera_linhas($$select 1 from public.stores where id = 'loja_b'$$, 0);
select fab.espera_erro($$update public.stock_items set tenant_id = current_setting('mt.b')::uuid where id = 'it_1'$$, 'Use a transferência');

-- Transferir aparelhos: só disponíveis e sem reserva.
select fab.espera_erro($$select public.transfer_stock_items(array['it_vendido'], 'loja_b')$$, 'Só aparelhos disponíveis');
select fab.espera_erro($$select public.transfer_stock_items(array['it_res'], 'loja_b')$$, 'Só aparelhos disponíveis');
do $$ begin
  assert (select count(*) from public.tenant_transferable_stock('loja_gr')) = 2, 'GR tem dois transferíveis';
  assert (public.transfer_stock_items(array['it_2'], 'loja_b') ->> 'moved')::int = 1, 'moveu um';
end $$;
select fab.espera_linhas($$select 1 from public.stock_items where id = 'it_2'$$, 0);

-- E volta (vice-versa), a partir da empresa nova.
select public.set_active_tenant(current_setting('mt.b')::uuid);
select fab.espera_linhas($$select 1 from public.stock_items where id = 'it_2' and store_id = 'loja_b'$$, 1);
do $$ begin
  assert (public.transfer_stock_items(array['it_2'], 'loja_hdi') ->> 'moved')::int = 1, 'voltou';
end $$;
select fab.espera_linhas($$select 1 from public.stock_items where id = 'it_2'$$, 0);
select public.set_active_tenant(private.primary_tenant_id());
select fab.espera_linhas($$select 1 from public.stock_items where id = 'it_2' and store_id = 'loja_hdi'$$, 1);

-- Loja com reserva ativa não sai; GR sai inteira com estoque disponível, custos e CRM.
select fab.espera_erro($$select public.transfer_store_to_tenant('loja_hdi', current_setting('mt.b')::uuid)$$, 'aparelhos reservados');
do $$
declare v_res jsonb;
begin
  v_res := public.transfer_store_to_tenant('loja_gr', current_setting('mt.b')::uuid);
  assert (v_res ->> 'movedItems')::int = 1, 'só o disponível vai junto';
  assert (v_res -> 'moved' ->> 'crm_leads')::int = 1, 'lead da loja vai junto';
end $$;
select fab.dono();
do $$ begin
  assert (select tenant_id from public.stores where id = 'loja_gr') = current_setting('mt.b')::uuid, 'loja mudou';
  assert (select tenant_id from public.costs where id = 'custo_1') = current_setting('mt.b')::uuid, 'custo foi junto';
  assert (select tenant_id from public.stock_items where id = 'it_vendido') = private.primary_tenant_id(), 'vendido fica como histórico';
  assert (select count(*) from public.tenant_transfers) = 3, 'três transferências registradas';
end $$;
select fab.como('authenticated', (select dono from u));
select fab.espera_erro($$select public.transfer_store_to_tenant('loja_gr', current_setting('mt.b')::uuid)$$, 'já pertence');

-- Permissões por empresa: vendedor da principal segue a matriz da principal.
select fab.como('authenticated', (select vend from u));
do $$ begin
  assert public.has_app_permission('inventory', 'visible'), 'matriz da principal';
  assert not public.has_app_permission('inventory', 'editable'), 'sem edição';
end $$;
select fab.espera_linhas($$select 1 from public.tenants$$, 1);
