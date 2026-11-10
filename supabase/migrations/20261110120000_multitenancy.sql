-- Multiempresa (tenants).
--
-- Cada "empresa" (tenant) tem as próprias lojas, estoque, clientes, vendas,
-- financeiro, CRM e configurações. Todo dado atual passa a pertencer à
-- empresa principal. Um usuário pode ser membro de várias empresas, com um
-- papel em cada uma, e escolhe a empresa ativa no cabeçalho do app.
--
-- Como o isolamento funciona:
--   * toda tabela de negócio ganha tenant_id (preenchido sozinho no insert,
--     a partir do registro pai ou da empresa ativa) e uma política RLS
--     RESTRICTIVE que só deixa ver/escrever linhas da empresa ativa;
--   * current_role(), app_operational_role() e has_app_permission() passam a
--     responder pelo papel do usuário NA empresa ativa;
--   * funções SECURITY DEFINER que recebem p_store_id recusam loja de outra
--     empresa.
--   * mover dados entre empresas só acontece pelas RPCs de transferência.

-- ---------------------------------------------------------------------------
-- 1. Empresas e membros
-- ---------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  is_primary boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index tenants_one_primary on public.tenants (is_primary) where is_primary;

create table public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'manager', 'seller')),
  seller_id text references public.sellers(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_members_user_idx on public.tenant_members (user_id);

create table public.tenant_transfers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('store', 'stock')),
  from_tenant_id uuid not null references public.tenants(id) on delete cascade,
  to_tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id text,
  target_store_id text,
  item_ids text[] not null default '{}',
  summary jsonb not null default '{}'::jsonb,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.user_profiles
  add column active_tenant_id uuid references public.tenants(id) on delete set null;

-- A empresa principal tem id fixo: migrations e funções podem citá-la.
insert into public.tenants (id, name, is_primary)
values (
  '00000000-0000-4000-8000-000000000001',
  coalesce((select nullif(btrim(name), '') from public.business_profile order by id limit 1), 'iPhone Repasse'),
  true
);

create or replace function private.primary_tenant_id()
returns uuid
language sql
immutable
as $$ select '00000000-0000-4000-8000-000000000001'::uuid $$;

-- Papel de hoje vira o papel na empresa principal (mesma regra de app_operational_role).
insert into public.tenant_members (tenant_id, user_id, role, seller_id)
select
  private.primary_tenant_id(),
  up.id,
  case
    when up.role = 'admin' then 'admin'
    when uar.app_role in ('manager', 'seller') then uar.app_role
    else 'seller'
  end,
  up.seller_id
from public.user_profiles up
join auth.users au on au.id = up.id
left join public.user_access_roles uar on uar.user_id = up.id;

-- ---------------------------------------------------------------------------
-- 2. Empresa ativa e papéis por empresa
-- ---------------------------------------------------------------------------

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (
      select m.tenant_id
      from public.user_profiles up
      join public.tenant_members m on m.user_id = up.id and m.tenant_id = up.active_tenant_id
      where up.id = auth.uid()
    ),
    (
      select m.tenant_id
      from public.tenant_members m
      join public.tenants t on t.id = m.tenant_id
      where m.user_id = auth.uid()
      order by t.is_primary desc, t.created_at, t.id
      limit 1
    )
  );
$$;

create or replace function public.tenant_role(p_tenant_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select m.role
  from public.tenant_members m
  where m.tenant_id = p_tenant_id
    and m.user_id = auth.uid();
$$;

create or replace function public.is_tenant_admin(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(public.tenant_role(p_tenant_id) = 'admin', false);
$$;

create or replace function public.app_operational_role()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.tenant_role(public.current_tenant_id());
$$;

-- Papel de banco ('admin' | 'seller') usado pelas políticas antigas.
create or replace function public."current_role"()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select case public.app_operational_role()
    when 'admin' then 'admin'
    when 'manager' then 'seller'
    when 'seller' then 'seller'
  end;
$$;

create or replace function public.current_store_id()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.store_id
  from public.tenant_members m
  join public.sellers s on s.id = m.seller_id
  where m.user_id = auth.uid()
    and m.tenant_id = public.current_tenant_id()
  limit 1;
$$;

-- Na empresa principal o papel continua vindo de user_profiles.role +
-- user_access_roles.app_role (tela Usuários de hoje). Usuário novo sem nenhuma
-- empresa entra na principal; quem foi criado direto em outra empresa (membro
-- inserido antes do perfil) não.
create or replace function private.legacy_membership_role(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when up.role = 'admin' then 'admin'
    when uar.app_role in ('manager', 'seller') then uar.app_role
    else 'seller'
  end
  from public.user_profiles up
  left join public.user_access_roles uar on uar.user_id = up.id
  where up.id = p_user_id;
$$;

create or replace function private.sync_primary_membership()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := coalesce(to_jsonb(new) ->> 'user_id', to_jsonb(new) ->> 'id')::uuid;
  v_role text := private.legacy_membership_role(v_user_id);
begin
  if v_role is null then
    return new;
  end if;

  if tg_table_name = 'user_profiles' and tg_op = 'INSERT'
     and not exists (select 1 from public.tenant_members where user_id = v_user_id) then
    insert into public.tenant_members (tenant_id, user_id, role, seller_id)
    values (private.primary_tenant_id(), v_user_id, v_role, to_jsonb(new) ->> 'seller_id')
    on conflict do nothing;
    return new;
  end if;

  update public.tenant_members m
  set role = v_role,
      seller_id = coalesce(to_jsonb(new) ->> 'seller_id', m.seller_id)
  where m.user_id = v_user_id
    and m.tenant_id = private.primary_tenant_id();
  return new;
end;
$$;

create trigger sync_primary_membership
after insert or update of role, seller_id on public.user_profiles
for each row execute function private.sync_primary_membership();

create trigger sync_primary_membership
after insert or update of app_role on public.user_access_roles
for each row execute function private.sync_primary_membership();

-- ---------------------------------------------------------------------------
-- 3. tenant_id em toda tabela de negócio
-- ---------------------------------------------------------------------------

-- Tabelas que continuam globais: identidade do usuário, infraestrutura do
-- servidor, o catálogo de aparelhos e as etapas de funil (definições comuns).
create or replace function private.tenant_global_tables()
returns text[]
language sql
immutable
as $$
  select array[
    'tenants', 'tenant_members', 'tenant_transfers',
    'user_profiles', 'user_access_roles', 'user_consents', 'account_deletion_requests',
    'crm_auth_handoffs', 'crm_dispatch_runtime', 'crm_funnel_stages',
    'device_catalog',
    'admin_agent_audit_log', 'admin_agent_numbers', 'admin_agent_pending_actions'
  ]::text[];
$$;

-- Preenche tenant_id no insert: herda do registro pai (pares coluna/tabela/tipo
-- em TG_ARGV, na ordem de prioridade); sem pai, usa a empresa ativa; sem
-- usuário (service role, cron), a empresa principal.
create or replace function private.tenant_fill()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_index integer := 0;
  v_parent_id text;
  v_tenant uuid;
begin
  if new.tenant_id is not null then
    return new;
  end if;

  while v_index < tg_nargs loop
    v_parent_id := to_jsonb(new) ->> tg_argv[v_index];
    if v_parent_id is not null then
      execute format('select tenant_id from public.%I where id = $1::%s', tg_argv[v_index + 1], tg_argv[v_index + 2])
        into v_tenant
        using v_parent_id;
      if v_tenant is not null then
        new.tenant_id := v_tenant;
        return new;
      end if;
    end if;
    v_index := v_index + 3;
  end loop;

  new.tenant_id := coalesce(public.current_tenant_id(), private.primary_tenant_id());
  return new;
end;
$$;

-- tenant_id só muda dentro das RPCs de transferência.
create or replace function private.tenant_guard()
returns trigger
language plpgsql
as $$
begin
  if new.tenant_id is null then
    new.tenant_id := old.tenant_id;
  end if;

  if new.tenant_id is distinct from old.tenant_id
     and coalesce(current_setting('app.tenant_transfer', true), '') <> 'on' then
    raise exception 'Não é possível mudar a empresa de um registro diretamente. Use a transferência entre empresas.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
  v_parent record;
  v_args text;
  v_primary constant text := '00000000-0000-4000-8000-000000000001';
begin
  for v_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname <> all (private.tenant_global_tables())
    order by c.relname
  loop
    execute format(
      'alter table public.%I add column tenant_id uuid not null default %L references public.tenants(id)',
      v_table, v_primary
    );
    execute format('alter table public.%I alter column tenant_id drop default', v_table);
    execute format('create index %I on public.%I (tenant_id)', v_table || '_tenant_idx', v_table);
    execute format('alter table public.%I enable row level security', v_table);
  end loop;

  -- Depois que todas têm tenant_id: gatilhos (precisam saber quais pais são de empresa) e política.
  for v_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname <> all (private.tenant_global_tables())
    order by c.relname
  loop
    v_args := '';
    for v_parent in
      select a.attname as column_name, pc.relname as parent_table, format_type(a.atttypid, a.atttypmod) as column_type
      from pg_constraint con
      join pg_class tc on tc.oid = con.conrelid
      join pg_class pc on pc.oid = con.confrelid
      join pg_namespace pn on pn.oid = pc.relnamespace
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
      join pg_attribute pa on pa.attrelid = con.confrelid and pa.attnum = con.confkey[1]
      where con.contype = 'f'
        and tc.relname = v_table
        and tc.relnamespace = 'public'::regnamespace
        and pn.nspname = 'public'
        and pc.relname <> all (private.tenant_global_tables())
        and pc.relname <> v_table
        and cardinality(con.conkey) = 1
        and pa.attname = 'id'
        and a.attname <> 'tenant_id'
      order by
        array_position(
          array['store_id', 'sale_id', 'stock_item_id', 'contract_id', 'lead_id', 'conversation_id', 'channel_id', 'debt_id', 'payable_debt_id'],
          a.attname::text
        ) nulls last,
        a.attname
    loop
      v_args := v_args || format('%L, %L, %L, ', v_parent.column_name, v_parent.parent_table, v_parent.column_type);
    end loop;
    v_args := rtrim(v_args, ', ');

    execute format(
      'create trigger zz_tenant_fill before insert on public.%I for each row execute function private.tenant_fill(%s)',
      v_table, v_args
    );
    execute format(
      'create trigger zz_tenant_guard before update of tenant_id on public.%I for each row execute function private.tenant_guard()',
      v_table
    );
    execute format(
      'create policy tenant_isolation on public.%I as restrictive for all to authenticated '
      'using (tenant_id = (select public.current_tenant_id())) '
      'with check (tenant_id = (select public.current_tenant_id()))',
      v_table
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Unicidade por empresa
-- ---------------------------------------------------------------------------

alter table public.customers drop constraint customers_cpf_key;
alter table public.customers add constraint customers_tenant_cpf_key unique (tenant_id, cpf);

alter table public.parts_inventory drop constraint parts_inventory_name_key;
alter table public.parts_inventory add constraint parts_inventory_tenant_name_key unique (tenant_id, name);

alter table public.sellers drop constraint sellers_email_key;
alter table public.sellers add constraint sellers_tenant_email_key unique (tenant_id, email);
alter table public.sellers drop constraint sellers_auth_user_id_key;
alter table public.sellers add constraint sellers_tenant_auth_user_key unique (tenant_id, auth_user_id);

drop index public.simulator_trade_in_values_active_unique;
create unique index simulator_trade_in_values_active_unique
  on public.simulator_trade_in_values (tenant_id, lower(btrim(model)), lower(btrim(capacity)))
  where is_active;

drop index public.care_model_rules_key;
create unique index care_model_rules_key
  on public.care_model_rules (tenant_id, lower(btrim(model)), condition);

alter table public.app_role_permissions drop constraint app_role_permissions_pkey;
alter table public.app_role_permissions add primary key (tenant_id, role, permission_key);

alter table public.care_condition_rules drop constraint care_condition_rules_pkey;
alter table public.care_condition_rules add primary key (tenant_id, condition);

-- Configurações de linha única passam a ser uma linha por empresa.
do $$
declare
  v_table text;
begin
  foreach v_table in array array['business_profile', 'card_fee_settings', 'reservation_message_settings', 'care_settings', 'crm_settings']
  loop
    execute format('alter table public.%I drop constraint %I', v_table, v_table || '_pkey');
    execute format('alter table public.%I add primary key (tenant_id, id)', v_table);
  end loop;
end;
$$;

-- Usuários: cada empresa só enxerga quem é membro dela.
create policy tenant_isolation on public.user_access_roles
  as restrictive for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.tenant_members m
      where m.user_id = user_access_roles.user_id
        and m.tenant_id = (select public.current_tenant_id())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Funções que olham dados por loja
-- ---------------------------------------------------------------------------

create or replace function public.has_app_permission(p_key text, p_action text default 'visible')
returns boolean
language sql
stable
security definer
set search_path to 'public'
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
      where arp.tenant_id = public.current_tenant_id()
        and arp.role = public.app_operational_role()
        and arp.permission_key = p_key
      limit 1
    ), false)
  end;
$$;

create or replace function public.resolve_crm_default_store_id()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  with scope as (
    select coalesce(public.current_tenant_id(), private.primary_tenant_id()) as tenant_id
  )
  select coalesce(
    (
      select s.id
      from public.crm_settings cs
      join public.stores s on s.id = nullif(btrim(cs.value_text), '') and s.tenant_id = cs.tenant_id
      where cs.id = 'default_crm_store_id'
        and cs.tenant_id = (select tenant_id from scope)
      limit 1
    ),
    (
      select s.id
      from public.stores s
      where s.tenant_id = (select tenant_id from scope)
      order by s.name asc, s.id asc
      limit 1
    )
  );
$$;

create or replace function public.crm_can_access_store(p_store_id text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_centralized boolean;
begin
  if p_store_id is not null and not exists (
    select 1 from public.stores s
    where s.id = p_store_id
      and s.tenant_id = public.current_tenant_id()
  ) then
    return false;
  end if;

  if public.current_role() = 'admin' then
    return true;
  end if;

  if public.current_role() = 'seller' then
    select value_bool
      into v_centralized
    from public.crm_settings
    where id = 'centralized_service'
      and tenant_id = public.current_tenant_id()
    limit 1;

    if coalesce(v_centralized, true) is true then
      return true;
    end if;

    return p_store_id is not null and p_store_id = public.current_store_id();
  end if;

  return false;
end;
$$;

-- Recusa loja de outra empresa. Chamadas sem usuário (service role) passam.
create or replace function private.assert_store_in_active_tenant(p_store_id text)
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if p_store_id is null or (auth.uid() is null and coalesce(auth.role(), '') <> 'anon') then
    return;
  end if;

  if not exists (
    select 1 from public.stores s
    where s.id = p_store_id
      and s.tenant_id = public.current_tenant_id()
  ) then
    raise exception 'Loja não encontrada nesta empresa.' using errcode = '42501';
  end if;
end;
$$;

-- As funções SECURITY DEFINER com p_store_id que não passavam por
-- crm_can_access_store ganham a checagem logo no início do corpo.
do $$
declare
  v_fn record;
  v_def text;
  v_split integer;
begin
  for v_fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and p.prosecdef
      and l.lanname = 'plpgsql'
      and 'p_store_id' = any (p.proargnames)
      and p.proname not in ('crm_can_access_store', 'tenant_transferable_stock', 'transfer_store_to_tenant')
      and p.prosrc !~* 'crm_can_access_store|assert_store_in_active_tenant'
  loop
    v_def := pg_get_functiondef(v_fn.oid);
    v_split := strpos(v_def, '$function$');
    v_def := left(v_def, v_split - 1)
      || regexp_replace(
        substr(v_def, v_split),
        '\mbegin\M',
        E'begin\n  perform private.assert_store_in_active_tenant(p_store_id);',
        'i'
      );
    execute v_def;
  end loop;
end;
$$;

-- Funções SQL com p_store_id (leitura de uma tabela só): filtro em vez de erro.
create or replace function private.store_visible(p_store_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (auth.uid() is null and coalesce(auth.role(), '') <> 'anon')
    or exists (
      select 1 from public.stores s
      where s.id = p_store_id
        and s.tenant_id = public.current_tenant_id()
    );
$$;

do $$
declare
  v_fn record;
  v_def text;
  v_split integer;
begin
  for v_fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and p.prosecdef
      and l.lanname = 'sql'
      and 'p_store_id' = any (p.proargnames)
      and p.prosrc !~* 'store_visible'
  loop
    v_def := pg_get_functiondef(v_fn.oid);
    v_split := strpos(v_def, '$function$');
    v_def := left(v_def, v_split - 1)
      || regexp_replace(substr(v_def, v_split), '\mwhere\M', 'where private.store_visible(p_store_id) and', 'i');
    execute v_def;
  end loop;
end;
$$;

-- O painel do Repasse Care soma contratos: como invoker, a RLS já limita à empresa ativa.
alter function public.care_dashboard(date, date) security invoker;

-- ---------------------------------------------------------------------------
-- 6. RLS das tabelas de empresa
-- ---------------------------------------------------------------------------

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_transfers enable row level security;

create policy tenants_select on public.tenants
  for select to authenticated
  using (public.tenant_role(id) is not null);

create policy tenant_members_select on public.tenant_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_tenant_admin(tenant_id));

create policy tenant_transfers_select on public.tenant_transfers
  for select to authenticated
  using (public.is_tenant_admin(from_tenant_id) or public.is_tenant_admin(to_tenant_id));

grant select on public.tenants, public.tenant_members, public.tenant_transfers to authenticated;
grant all on public.tenants, public.tenant_members, public.tenant_transfers to service_role;

-- ---------------------------------------------------------------------------
-- 7. RPCs
-- ---------------------------------------------------------------------------

create or replace function private.assert_tenant_admin(p_tenant_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_tenant_admin(p_tenant_id) then
    raise exception 'Apenas administradores desta empresa podem fazer isso.' using errcode = '42501';
  end if;
end;
$$;

-- Tudo que o app precisa para montar o seletor de empresa e o papel do usuário.
create or replace function public.my_tenant_context()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'activeTenantId', public.current_tenant_id(),
    'role', public.app_operational_role(),
    'sellerId', (
      select m.seller_id from public.tenant_members m
      where m.user_id = auth.uid() and m.tenant_id = public.current_tenant_id()
    ),
    'canCreateTenants', public.is_tenant_admin(private.primary_tenant_id()),
    'tenants', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', t.id, 'name', t.name, 'role', m.role, 'isPrimary', t.is_primary)
        order by t.is_primary desc, t.name
      )
      from public.tenant_members m
      join public.tenants t on t.id = m.tenant_id
      where m.user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;

create or replace function public.set_active_tenant(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.tenant_role(p_tenant_id) is null then
    raise exception 'Você não faz parte desta empresa.' using errcode = '42501';
  end if;

  update public.user_profiles
  set active_tenant_id = p_tenant_id
  where id = auth.uid();

  return public.my_tenant_context();
end;
$$;

-- Copia as linhas de configuração de uma empresa para outra, trocando só o tenant_id.
create or replace function private.copy_tenant_rows(p_table text, p_from uuid, p_to uuid, p_where text default 'true')
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  execute format(
    'insert into public.%1$I select (jsonb_populate_record(null::public.%1$I, to_jsonb(r) || jsonb_build_object(''tenant_id'', $2))).* '
    'from public.%1$I r where r.tenant_id = $1 and (%2$s) on conflict do nothing',
    p_table, p_where
  ) using p_from, p_to;
end;
$$;

create or replace function public.create_tenant(p_name text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_source uuid := coalesce(public.current_tenant_id(), private.primary_tenant_id());
  v_tenant uuid;
begin
  if not public.is_tenant_admin(private.primary_tenant_id()) then
    raise exception 'Apenas administradores da empresa principal podem criar empresas.' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'Informe o nome da empresa.' using errcode = '22023';
  end if;
  if exists (select 1 from public.tenants where lower(name) = lower(v_name)) then
    raise exception 'Já existe uma empresa com esse nome.' using errcode = '23505';
  end if;

  insert into public.tenants (name, created_by)
  values (v_name, auth.uid())
  returning id into v_tenant;

  insert into public.tenant_members (tenant_id, user_id, role, created_by)
  values (v_tenant, auth.uid(), 'admin', auth.uid());

  -- A empresa nova nasce com as mesmas regras de acesso, taxas e textos.
  perform private.copy_tenant_rows('app_role_permissions', v_source, v_tenant);
  perform private.copy_tenant_rows('card_fee_settings', v_source, v_tenant);
  perform private.copy_tenant_rows('reservation_message_settings', v_source, v_tenant);
  perform private.copy_tenant_rows('care_settings', v_source, v_tenant);
  perform private.copy_tenant_rows('care_condition_rules', v_source, v_tenant);
  perform private.copy_tenant_rows('crm_settings', v_source, v_tenant, 'r.id <> ''default_crm_store_id''');

  insert into public.business_profile (id, name, tenant_id)
  values ('1', v_name, v_tenant)
  on conflict do nothing;

  return jsonb_build_object('id', v_tenant, 'name', v_name);
end;
$$;

create or replace function public.rename_tenant(p_tenant_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  perform private.assert_tenant_admin(p_tenant_id);
  if v_name = '' then
    raise exception 'Informe o nome da empresa.' using errcode = '22023';
  end if;
  if exists (select 1 from public.tenants where lower(name) = lower(v_name) and id <> p_tenant_id) then
    raise exception 'Já existe uma empresa com esse nome.' using errcode = '23505';
  end if;

  update public.tenants set name = v_name, updated_at = now() where id = p_tenant_id;
end;
$$;

-- Membros de uma empresa, com nome e e-mail (a lista de usuários só mostra a empresa ativa).
create or replace function public.tenant_members_list(p_tenant_id uuid)
returns table (user_id uuid, email text, display_name text, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform private.assert_tenant_admin(p_tenant_id);

  return query
  select
    m.user_id,
    coalesce(uar.email, au.email::text),
    coalesce(nullif(uar.display_name, ''), au.email::text),
    m.role,
    m.created_at
  from public.tenant_members m
  join auth.users au on au.id = m.user_id
  left join public.user_access_roles uar on uar.user_id = m.user_id
  where m.tenant_id = p_tenant_id
  order by case m.role when 'admin' then 0 when 'manager' then 1 else 2 end, 3;
end;
$$;

-- Vendedor e gerente precisam de um cadastro de vendedor na empresa.
create or replace function private.ensure_tenant_seller(p_tenant_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_seller_id text;
  v_email text;
  v_name text;
begin
  select s.id into v_seller_id
  from public.sellers s
  where s.tenant_id = p_tenant_id and s.auth_user_id = p_user_id;
  if v_seller_id is not null then
    return v_seller_id;
  end if;

  select coalesce(uar.email, au.email::text), coalesce(nullif(uar.display_name, ''), au.email::text)
    into v_email, v_name
  from auth.users au
  left join public.user_access_roles uar on uar.user_id = au.id
  where au.id = p_user_id;

  insert into public.sellers (id, name, email, auth_user_id, tenant_id)
  values (gen_random_uuid()::text, v_name, v_email, p_user_id, p_tenant_id)
  returning id into v_seller_id;
  return v_seller_id;
end;
$$;

create or replace function public.tenant_add_member(p_tenant_id uuid, p_email text, p_role text default 'admin')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  v_seller_id text;
begin
  perform private.assert_tenant_admin(p_tenant_id);
  if p_role not in ('admin', 'manager', 'seller') then
    raise exception 'Papel inválido.' using errcode = '22023';
  end if;

  select au.id into v_user_id
  from auth.users au
  where lower(au.email) = lower(btrim(coalesce(p_email, '')));
  if v_user_id is null then
    raise exception 'Nenhum usuário com esse e-mail. Cadastre o usuário primeiro.' using errcode = 'P0002';
  end if;

  if p_role <> 'admin' then
    v_seller_id := private.ensure_tenant_seller(p_tenant_id, v_user_id);
  end if;

  insert into public.tenant_members (tenant_id, user_id, role, seller_id, created_by)
  values (p_tenant_id, v_user_id, p_role, v_seller_id, auth.uid())
  on conflict (tenant_id, user_id) do update
    set role = excluded.role,
        seller_id = coalesce(tenant_members.seller_id, excluded.seller_id);

  return jsonb_build_object('userId', v_user_id, 'role', p_role);
end;
$$;

create or replace function public.tenant_remove_member(p_tenant_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform private.assert_tenant_admin(p_tenant_id);

  if (select role from public.tenant_members where tenant_id = p_tenant_id and user_id = p_user_id) = 'admin'
     and (select count(*) from public.tenant_members where tenant_id = p_tenant_id and role = 'admin') <= 1 then
    raise exception 'A empresa precisa de pelo menos um administrador.' using errcode = '22023';
  end if;

  delete from public.tenant_members where tenant_id = p_tenant_id and user_id = p_user_id;
  update public.user_profiles set active_tenant_id = null
  where id = p_user_id and active_tenant_id = p_tenant_id;
end;
$$;

create or replace function private.stock_item_is_transferable(p_item public.stock_items)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select p_item.status not in ('Vendido', 'Reservado')
    and not exists (
      select 1 from public.stock_reservations r
      where r.stock_item_id = p_item.id and r.status = 'active'
    );
$$;

-- Empresas e lojas que o usuário administra, para montar a tela de transferências.
create or replace function public.tenant_transfer_catalog()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'isPrimary', t.is_primary,
      'stores', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'city', s.city,
            'transferableCount', (
              select count(*) from public.stock_items si
              where si.store_id = s.id and si.tenant_id = t.id
                and private.stock_item_is_transferable(si)
            )
          )
          order by s.name
        )
        from public.stores s
        where s.tenant_id = t.id
      ), '[]'::jsonb)
    )
    order by t.is_primary desc, t.name
  ), '[]'::jsonb)
  from public.tenant_members m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = auth.uid() and m.role = 'admin';
$$;

create or replace function public.tenant_transferable_stock(p_store_id text)
returns table (
  id text, type text, model text, color text, capacity text, imei text,
  condition text, status text, battery_health integer, sell_price numeric
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
         si.condition, si.status, si.battery_health, si.sell_price
  from public.stock_items si
  where si.store_id = p_store_id
    and si.tenant_id = (select s.tenant_id from public.stores s where s.id = p_store_id)
    and private.stock_item_is_transferable(si)
  order by si.model, si.capacity, si.id;
end;
$$;

-- Leva uma loja inteira para outra empresa: a loja, o estoque disponível (com
-- custos) e o CRM da loja. Vendas, contratos Care e orçamentos ficam como
-- histórico na empresa de origem; vendedores da loja ficam sem loja.
create or replace function public.transfer_store_to_tenant(p_store_id text, p_target_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_from uuid;
  v_items text[];
  v_moved jsonb := '{}'::jsonb;
  v_count integer;
  v_table text;
  v_history constant text[] := array[
    'stores', 'stock_items', 'sellers', 'sales', 'care_contracts', 'pdv_quotes', 'push_subscriptions'
  ];
begin
  select tenant_id into v_from from public.stores where id = p_store_id;
  if v_from is null then
    raise exception 'Loja não encontrada.' using errcode = 'P0002';
  end if;
  if v_from = p_target_tenant_id then
    raise exception 'A loja já pertence a essa empresa.' using errcode = '22023';
  end if;
  perform private.assert_tenant_admin(v_from);
  perform private.assert_tenant_admin(p_target_tenant_id);

  if exists (
    select 1 from public.stock_reservations r
    join public.stock_items si on si.id = r.stock_item_id
    where si.store_id = p_store_id and r.status = 'active'
  ) then
    raise exception 'A loja tem aparelhos reservados. Conclua ou libere as reservas antes de transferir.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.crm_channel_store_links l
    join public.crm_channels c on c.id = l.channel_id
    where (l.store_id = p_store_id) <> (c.store_id = p_store_id)
  ) then
    raise exception 'A loja divide um canal do CRM com outra loja. Separe o canal antes de transferir.' using errcode = '22023';
  end if;

  perform set_config('app.tenant_transfer', 'on', true);

  update public.stores set tenant_id = p_target_tenant_id, updated_at = now() where id = p_store_id;

  select coalesce(array_agg(si.id), '{}') into v_items
  from public.stock_items si
  where si.store_id = p_store_id and si.tenant_id = v_from
    and private.stock_item_is_transferable(si);

  update public.stock_items set tenant_id = p_target_tenant_id where id = any (v_items);
  update public.costs set tenant_id = p_target_tenant_id where stock_item_id = any (v_items) and tenant_id = v_from;
  v_moved := v_moved || jsonb_build_object('stock_items', cardinality(v_items));

  for v_table in
    select c.table_name
    from information_schema.columns c
    join information_schema.columns t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.column_name = 'tenant_id'
    where c.table_schema = 'public'
      and c.column_name = 'store_id'
      and c.table_name <> all (v_history)
      and c.table_name <> all (private.tenant_global_tables())
    order by c.table_name
  loop
    execute format(
      'update public.%I set tenant_id = $1 where store_id = $2 and tenant_id = $3',
      v_table
    ) using p_target_tenant_id, p_store_id, v_from;
    get diagnostics v_count = row_count;
    if v_count > 0 then
      v_moved := v_moved || jsonb_build_object(v_table, v_count);
    end if;
  end loop;

  -- Filhos de lead que não têm store_id.
  update public.crm_follow_up_tracker f set tenant_id = p_target_tenant_id
  from public.crm_leads l
  where l.id = f.lead_id and l.tenant_id = p_target_tenant_id and f.tenant_id = v_from;
  update public.lead_state s set tenant_id = p_target_tenant_id
  from public.crm_leads l
  where l.id = s.lead_id and l.tenant_id = p_target_tenant_id and s.tenant_id = v_from;

  update public.sellers set store_id = null where store_id = p_store_id;

  perform set_config('app.tenant_transfer', 'off', true);

  insert into public.tenant_transfers (kind, from_tenant_id, to_tenant_id, store_id, item_ids, summary, performed_by)
  values ('store', v_from, p_target_tenant_id, p_store_id, v_items, v_moved, auth.uid());

  return jsonb_build_object('storeId', p_store_id, 'movedItems', cardinality(v_items), 'moved', v_moved);
end;
$$;

-- Move aparelhos para uma loja de outra (ou da mesma) empresa, nos dois sentidos.
create or replace function public.transfer_stock_items(p_item_ids text[], p_target_store_id text)
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

  perform set_config('app.tenant_transfer', 'on', true);

  for v_from in
    select si.tenant_id, si.store_id, array_agg(si.id) as ids
    from public.stock_items si
    where si.id = any (p_item_ids)
    group by si.tenant_id, si.store_id
  loop
    update public.stock_items
    set tenant_id = v_target_tenant, store_id = p_target_store_id, updated_at = now()
    where id = any (v_from.ids);
    update public.costs set tenant_id = v_target_tenant where stock_item_id = any (v_from.ids);
    v_total := v_total + cardinality(v_from.ids);

    insert into public.tenant_transfers (kind, from_tenant_id, to_tenant_id, store_id, target_store_id, item_ids, performed_by)
    values ('stock', v_from.tenant_id, v_target_tenant, v_from.store_id, p_target_store_id, v_from.ids, auth.uid());
  end loop;

  perform set_config('app.tenant_transfer', 'off', true);

  return jsonb_build_object('moved', v_total, 'targetStoreId', p_target_store_id);
end;
$$;

-- Funções internas não ficam expostas pela API.
revoke all on function private.tenant_fill() from public, anon, authenticated;
revoke all on function private.copy_tenant_rows(text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.ensure_tenant_seller(uuid, uuid) from public, anon, authenticated;

revoke all on function
  public.my_tenant_context(),
  public.set_active_tenant(uuid),
  public.create_tenant(text),
  public.rename_tenant(uuid, text),
  public.tenant_members_list(uuid),
  public.tenant_add_member(uuid, text, text),
  public.tenant_remove_member(uuid, uuid),
  public.tenant_transfer_catalog(),
  public.tenant_transferable_stock(text),
  public.transfer_store_to_tenant(text, uuid),
  public.transfer_stock_items(text[], text)
from public, anon;

grant execute on function
  public.current_tenant_id(),
  public.tenant_role(uuid),
  public.is_tenant_admin(uuid),
  public.my_tenant_context(),
  public.set_active_tenant(uuid),
  public.create_tenant(text),
  public.rename_tenant(uuid, text),
  public.tenant_members_list(uuid),
  public.tenant_add_member(uuid, text, text),
  public.tenant_remove_member(uuid, uuid),
  public.tenant_transfer_catalog(),
  public.tenant_transferable_stock(text),
  public.transfer_store_to_tenant(text, uuid),
  public.transfer_stock_items(text[], text)
to authenticated, service_role;
