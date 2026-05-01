begin;

alter table public.crm_settings
  add column if not exists value_text text;

insert into public.crm_settings (id, value_bool, updated_at)
values ('centralized_service', true, now())
on conflict (id) do update
set value_bool = true,
    updated_at = now();

insert into public.crm_settings (id, value_bool, value_text, updated_at)
select
  'default_crm_store_id',
  true,
  s.id,
  now()
from public.stores s
order by s.name asc, s.id asc
limit 1
on conflict (id) do update
set value_text = coalesce(public.crm_settings.value_text, excluded.value_text),
    value_bool = true,
    updated_at = now();

create or replace function public.resolve_crm_default_store_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select nullif(btrim(value_text), '')
      from public.crm_settings
      where id = 'default_crm_store_id'
        and exists (
          select 1
          from public.stores s
          where s.id = nullif(btrim(public.crm_settings.value_text), '')
        )
      limit 1
    ),
    (
      select id
      from public.stores
      order by name asc, id asc
      limit 1
    )
  );
$$;

grant execute on function public.resolve_crm_default_store_id() to authenticated;
grant execute on function public.resolve_crm_default_store_id() to service_role;

create or replace function public.crm_can_access_store(p_store_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_centralized boolean;
begin
  if public.current_role() = 'admin' then
    return true;
  end if;

  if public.current_role() = 'seller' then
    select value_bool
      into v_centralized
    from public.crm_settings
    where id = 'centralized_service'
    limit 1;

    if coalesce(v_centralized, true) is true then
      return true;
    end if;

    return p_store_id is not null and p_store_id = public.current_store_id();
  end if;

  return false;
end;
$$;

commit;
