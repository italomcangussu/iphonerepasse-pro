-- Funcionários compartilhados: o admin libera pessoas da empresa principal (iPhone Repasse)
-- em outra empresa. A pessoa liberada entra com o mesmo papel que tem na principal e o papel
-- continua acompanhando a principal (follows_primary). Saiu da principal, sai das liberadas.

alter table public.tenant_members
  add column follows_primary boolean not null default false;

create or replace function private.assert_can_share_members(p_tenant_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if p_tenant_id = private.primary_tenant_id() then
    raise exception 'A iPhone Repasse já é a empresa de origem dos funcionários.' using errcode = '22023';
  end if;
  if not (public.is_tenant_admin(p_tenant_id) and public.is_tenant_admin(private.primary_tenant_id())) then
    raise exception 'Apenas administradores da iPhone Repasse e desta empresa podem liberar funcionários.' using errcode = '42501';
  end if;
end;
$$;

-- Pessoas da principal e como cada uma está na empresa escolhida:
-- 'shared' (liberada, segue a principal) · 'member' (adicionada à mão) · null (sem acesso).
create or replace function public.tenant_shareable_members(p_tenant_id uuid)
returns table (user_id uuid, email text, display_name text, role text, access text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  perform private.assert_can_share_members(p_tenant_id);

  return query
  select
    p.user_id,
    coalesce(uar.email, au.email::text),
    coalesce(nullif(uar.display_name, ''), au.email::text),
    p.role,
    case when t.user_id is null then null when t.follows_primary then 'shared' else 'member' end
  from public.tenant_members p
  join auth.users au on au.id = p.user_id
  left join public.user_access_roles uar on uar.user_id = p.user_id
  left join public.tenant_members t on t.tenant_id = p_tenant_id and t.user_id = p.user_id
  where p.tenant_id = private.primary_tenant_id()
  order by case p.role when 'admin' then 0 when 'manager' then 1 else 2 end, 3;
end;
$$;

-- Copia o papel da principal para a empresa; vendedor e gerente ganham cadastro de vendedor nela.
create or replace function private.mirror_primary_membership(p_tenant_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_seller_id text;
begin
  if p_role <> 'admin' then
    v_seller_id := private.ensure_tenant_seller(p_tenant_id, p_user_id);
  end if;

  insert into public.tenant_members (tenant_id, user_id, role, seller_id, created_by, follows_primary)
  values (p_tenant_id, p_user_id, p_role, v_seller_id, auth.uid(), true)
  on conflict (tenant_id, user_id) do update
    set role = excluded.role,
        seller_id = coalesce(tenant_members.seller_id, excluded.seller_id),
        follows_primary = true;
end;
$$;

create or replace function public.tenant_share_members(p_tenant_id uuid, p_user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_member record;
  v_count integer := 0;
begin
  perform private.assert_can_share_members(p_tenant_id);

  for v_member in
    select m.user_id, m.role
    from public.tenant_members m
    where m.tenant_id = private.primary_tenant_id()
      and m.user_id = any(coalesce(p_user_ids, '{}'))
  loop
    perform private.mirror_primary_membership(p_tenant_id, v_member.user_id, v_member.role);
    v_count := v_count + 1;
  end loop;

  if v_count < coalesce(cardinality(p_user_ids), 0) then
    raise exception 'Só dá para liberar quem faz parte da iPhone Repasse.' using errcode = '22023';
  end if;
  return v_count;
end;
$$;

-- Mudou o papel na principal → muda em todas as empresas liberadas.
-- Saiu da principal → sai delas também (menos onde é o último administrador).
create or replace function private.propagate_primary_membership()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_follower record;
begin
  if tg_op = 'DELETE' then
    if old.tenant_id <> private.primary_tenant_id() then
      return old;
    end if;
    delete from public.tenant_members f
    where f.user_id = old.user_id
      and f.follows_primary
      and not (f.role = 'admin' and (
        select count(*) from public.tenant_members a where a.tenant_id = f.tenant_id and a.role = 'admin'
      ) <= 1);
    update public.user_profiles up set active_tenant_id = null
    where up.id = old.user_id
      and up.active_tenant_id is not null
      and not exists (select 1 from public.tenant_members m where m.user_id = old.user_id and m.tenant_id = up.active_tenant_id);
    return old;
  end if;

  if new.tenant_id <> private.primary_tenant_id() or new.role = old.role then
    return new;
  end if;
  for v_follower in
    select f.tenant_id from public.tenant_members f
    where f.user_id = new.user_id and f.follows_primary
  loop
    perform private.mirror_primary_membership(v_follower.tenant_id, new.user_id, new.role);
  end loop;
  return new;
end;
$$;

create trigger propagate_primary_membership
after update of role or delete on public.tenant_members
for each row execute function private.propagate_primary_membership();

-- Adicionar à mão com um papel escolhido desliga o "segue a principal".
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
        seller_id = coalesce(tenant_members.seller_id, excluded.seller_id),
        follows_primary = false;

  return jsonb_build_object('userId', v_user_id, 'role', p_role);
end;
$$;

-- A lista de pessoas passa a dizer quem segue a principal.
drop function public.tenant_members_list(uuid);
create function public.tenant_members_list(p_tenant_id uuid)
returns table (user_id uuid, email text, display_name text, role text, created_at timestamptz, follows_primary boolean)
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
    m.created_at,
    m.follows_primary
  from public.tenant_members m
  join auth.users au on au.id = m.user_id
  left join public.user_access_roles uar on uar.user_id = m.user_id
  where m.tenant_id = p_tenant_id
  order by case m.role when 'admin' then 0 when 'manager' then 1 else 2 end, 3;
end;
$$;

revoke all on function public.tenant_shareable_members(uuid) from public, anon;
revoke all on function public.tenant_share_members(uuid, uuid[]) from public, anon;
revoke all on function public.tenant_members_list(uuid) from public, anon;
grant execute on function public.tenant_shareable_members(uuid) to authenticated;
grant execute on function public.tenant_share_members(uuid, uuid[]) to authenticated;
grant execute on function public.tenant_members_list(uuid) to authenticated;
revoke all on function private.mirror_primary_membership(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.propagate_primary_membership() from public, anon, authenticated;
