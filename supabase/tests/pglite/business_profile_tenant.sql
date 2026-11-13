-- Perfil da Loja por empresa: o upsert da tela (`updateBusinessProfile` em
-- services/dataContext.tsx) manda só `id: '1'`, sem tenant_id. O PostgREST
-- resolve o conflito pela chave primária (tenant_id, id) e o gatilho
-- zz_tenant_fill preenche o tenant da empresa ativa antes da checagem.
insert into public.tenants (id, name, is_primary) values (private.primary_tenant_id(), 'iPhone Repasse', true) on conflict do nothing;

create temp table u as select fab.usuario('dono-bp@x.com') as dono;
grant select on u to authenticated, service_role;
insert into public.user_profiles (id, role) select dono, 'admin' from u;

insert into public.business_profile (id, name, cnpj, phone, address, logo_url)
  values ('1', 'iPhone Repasse', '00.000.000/0001-00', '85999990000', 'Rua A, 1', 'https://x/logos/iphone.png');

select fab.como('authenticated', (select dono from u));
do $$
declare v_ctx jsonb;
begin
  v_ctx := public.create_tenant('Garçom Repasse');
  perform set_config('bp.g', v_ctx ->> 'id', false);
end $$;
select public.set_active_tenant(current_setting('bp.g')::uuid);

-- O mesmo SQL que o PostgREST gera para o upsert da tela.
insert into public.business_profile (id, name, cnpj, phone, email, address, instagram, logo_url, primary_color)
  values ('1', 'Garmin Repasse', null, null, null, null, null, 'https://x/logos/garmin.png', null)
  on conflict (tenant_id, id) do update set
    name = excluded.name, cnpj = excluded.cnpj, phone = excluded.phone, email = excluded.email,
    address = excluded.address, instagram = excluded.instagram, logo_url = excluded.logo_url,
    primary_color = excluded.primary_color;

do $$ begin
  assert (select count(*) from public.business_profile) = 1, 'a empresa ativa só enxerga o próprio perfil';
  assert (select name from public.business_profile) = 'Garmin Repasse', 'nome gravado na empresa ativa';
  assert (select logo_url from public.business_profile) = 'https://x/logos/garmin.png', 'logo gravada na empresa ativa';
end $$;

select fab.dono();
do $$ begin
  assert (select count(*) from public.business_profile) = 2, 'uma linha por empresa, nenhuma nova';
  assert (select name || '|' || cnpj || '|' || phone || '|' || address || '|' || logo_url
          from public.business_profile where tenant_id = private.primary_tenant_id())
    = 'iPhone Repasse|00.000.000/0001-00|85999990000|Rua A, 1|https://x/logos/iphone.png', 'principal intacta';
  assert (select tenant_id from public.business_profile where name = 'Garmin Repasse') = current_setting('bp.g')::uuid,
    'perfil da Garmin na empresa dela';
end $$;
