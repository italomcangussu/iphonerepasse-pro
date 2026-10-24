-- Orçamentos do PDV seguem a matriz de permissões (pdv visible para criar/ler, deletable para excluir).
create temp table u as select fab.usuario('vend-orc@x.com') as vend, fab.usuario('sem-orc@x.com') as sem;
grant select on u to authenticated;
insert into public.user_profiles (id, role) select vend, 'seller' from u;
insert into public.user_profiles (id, role) select sem, 'seller' from u;
insert into public.user_access_roles (user_id, app_role, display_name, email) select vend, 'seller', 'Vendedor', 'vend-orc@x.com' from u;
insert into public.user_access_roles (user_id, app_role, display_name, email) select sem, 'manager', 'Gerente', 'sem-orc@x.com' from u;
delete from public.app_role_permissions where role in ('manager', 'seller');
insert into public.app_role_permissions (role, permission_key, label, is_visible, is_editable, is_deletable) values
  ('seller', 'pdv', 'PDV', true, false, false),
  ('manager', 'pdv', 'PDV', false, false, false);

-- Vendedor com PDV visível cria e lê o orçamento; created_by vem do login.
select fab.como('authenticated', (select vend from u));
insert into public.pdv_quotes (items, subtotal, total, validity_days, expires_at)
  values ('[{"label":"iPhone 15 128GB","price":4000}]', 4000, 4000, 1, now() + interval '1 day');
select fab.espera_linhas($$select 1 from public.pdv_quotes where created_by = (select vend from u) and quote_number > 0$$, 1);
select fab.espera_afetadas($$update public.pdv_quotes set status = 'cancelado'$$, 1);
-- Sem PDV deletável não exclui.
select fab.espera_afetadas($$delete from public.pdv_quotes$$, 0);

-- Regras do documento.
select fab.espera_erro($$insert into public.pdv_quotes (items, subtotal, total, validity_days, expires_at) values ('[{"a":1}]', 1, 1, 31, now())$$, 'pdv_quotes_validity_days_check');
select fab.espera_erro($$insert into public.pdv_quotes (items, subtotal, total, validity_days, expires_at) values ('[]', 1, 1, 1, now())$$, 'pdv_quotes_items_check');

-- Sem PDV visível não vê nem cria.
select fab.como('authenticated', (select sem from u));
select fab.espera_linhas($$select 1 from public.pdv_quotes$$, 0);
select fab.espera_erro($$insert into public.pdv_quotes (items, subtotal, total, expires_at) values ('[{"a":1}]', 1, 1, now())$$, 'row-level security');

-- Visitante não acessa.
select fab.como('anon');
select fab.espera_erro($$select 1 from public.pdv_quotes$$, 'permission denied');
