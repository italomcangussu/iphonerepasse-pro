-- Funcionários da iPhone Repasse liberados em outra empresa, com o papel acompanhando a principal.
insert into public.tenants (id, name, is_primary) values (private.primary_tenant_id(), 'iPhone Repasse', true) on conflict do nothing;

create temp table u as select
  fab.usuario('dono-sh@x.com') as dono,
  fab.usuario('vend-sh@x.com') as vend,
  fab.usuario('ger-sh@x.com') as ger,
  fab.usuario('fora-sh@x.com') as fora;
grant select on u to authenticated, service_role;

insert into public.user_profiles (id, role) select dono, 'admin' from u;
insert into public.user_profiles (id, role) select vend, 'seller' from u;
insert into public.user_profiles (id, role) select ger, 'seller' from u;
insert into public.user_access_roles (user_id, app_role, display_name, email) select ger, 'manager', 'Gerente', 'ger-sh@x.com' from u;
insert into public.user_access_roles (user_id, app_role, display_name, email) select vend, 'seller', 'Vendedor', 'vend-sh@x.com' from u;
insert into public.tenants (id, name) values ('00000000-0000-4000-8000-0000000000b2', 'Loja B');
insert into public.tenant_members (tenant_id, user_id, role) select '00000000-0000-4000-8000-0000000000b2', dono, 'admin' from u;
insert into public.tenant_members (tenant_id, user_id, role) select '00000000-0000-4000-8000-0000000000b2', fora, 'admin' from u;

-- Só admin da principal e da empresa libera; a principal não é destino.
select fab.como('authenticated', (select vend from u));
select fab.espera_erro($$select * from public.tenant_shareable_members('00000000-0000-4000-8000-0000000000b2')$$, 'Apenas administradores');
select fab.como('authenticated', (select fora from u));
select fab.espera_erro($$select * from public.tenant_shareable_members('00000000-0000-4000-8000-0000000000b2')$$, 'Apenas administradores');
select fab.como('authenticated', (select dono from u));
select fab.espera_erro($$select * from public.tenant_shareable_members(private.primary_tenant_id())$$, 'empresa de origem');
select fab.espera_erro($$select public.tenant_share_members('00000000-0000-4000-8000-0000000000b2', array[(select fora from u)])$$, 'quem faz parte da iPhone Repasse');

-- Lista da principal com o status na Loja B.
select fab.espera_linhas($$select 1 from public.tenant_shareable_members('00000000-0000-4000-8000-0000000000b2')$$, 3);
do $$ begin
  assert (select access from public.tenant_shareable_members('00000000-0000-4000-8000-0000000000b2') where user_id = (select dono from u)) = 'member', 'dono já está na B';
  assert (select access from public.tenant_shareable_members('00000000-0000-4000-8000-0000000000b2') where user_id = (select ger from u)) is null, 'gerente sem acesso';
end $$;

-- Liberar: mesmo papel, cadastro de vendedor na B, e aparece no seletor da pessoa.
select public.tenant_share_members('00000000-0000-4000-8000-0000000000b2', array[(select ger from u), (select vend from u)]);
do $$ begin
  assert (select role from public.tenant_members where tenant_id = '00000000-0000-4000-8000-0000000000b2' and user_id = (select ger from u)) = 'manager', 'gerente continua gerente';
  assert (select follows_primary from public.tenant_members where tenant_id = '00000000-0000-4000-8000-0000000000b2' and user_id = (select ger from u)), 'segue a principal';
  assert (select follows_primary from public.tenant_members_list('00000000-0000-4000-8000-0000000000b2') where user_id = (select vend from u)), 'lista mostra quem segue';
end $$;

select fab.como('authenticated', (select ger from u));
do $$ begin
  assert jsonb_array_length(public.my_tenant_context() -> 'tenants') = 2, 'gerente vê as duas empresas no seletor';
  perform public.set_active_tenant('00000000-0000-4000-8000-0000000000b2');
  assert public.app_operational_role() = 'manager', 'mesmos poderes na B';
end $$;

-- Mudou o papel na principal → muda na B.
select fab.dono();
do $$ begin
  assert (select s.tenant_id from public.tenant_members m join public.sellers s on s.id = m.seller_id
          where m.tenant_id = '00000000-0000-4000-8000-0000000000b2' and m.user_id = (select vend from u)) = '00000000-0000-4000-8000-0000000000b2', 'vendedor da B';
end $$;
update public.user_access_roles set app_role = 'seller' where user_id = (select ger from u);
do $$ begin
  assert (select role from public.tenant_members where tenant_id = '00000000-0000-4000-8000-0000000000b2' and user_id = (select ger from u)) = 'seller', 'papel acompanhou a principal';
end $$;
update public.user_profiles set role = 'admin' where id = (select vend from u);
do $$ begin
  assert (select role from public.tenant_members where tenant_id = '00000000-0000-4000-8000-0000000000b2' and user_id = (select vend from u)) = 'admin', 'virou admin na B também';
end $$;

-- Adicionado à mão com outro papel deixa de seguir.
select fab.como('authenticated', (select dono from u));
select public.tenant_add_member('00000000-0000-4000-8000-0000000000b2', 'vend-sh@x.com', 'seller');
do $$ begin
  assert not (select follows_primary from public.tenant_members where tenant_id = '00000000-0000-4000-8000-0000000000b2' and user_id = (select vend from u)), 'manual não segue';
end $$;

-- Saiu da principal → sai da B (o seletor some) e o vínculo manual fica.
select fab.dono();
delete from public.tenant_members where tenant_id = private.primary_tenant_id() and user_id in ((select ger from u), (select vend from u));
do $$ begin
  assert not exists (select 1 from public.tenant_members where tenant_id = '00000000-0000-4000-8000-0000000000b2' and user_id = (select ger from u)), 'gerente saiu da B';
  assert (select active_tenant_id from public.user_profiles where id = (select ger from u)) is null, 'empresa ativa limpa';
  assert exists (select 1 from public.tenant_members where tenant_id = '00000000-0000-4000-8000-0000000000b2' and user_id = (select vend from u)), 'manual continua';
end $$;
