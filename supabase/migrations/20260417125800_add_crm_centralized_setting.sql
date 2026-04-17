
-- CRM Centralized Service configuration
create table if not exists public.crm_settings (
    id text primary key default 'centralized_service',
    value_bool boolean not null default false,
    updated_at timestamptz not null default now()
);

-- Insert default if not exists
insert into public.crm_settings (id, value_bool)
values ('centralized_service', false)
on conflict (id) do nothing;

-- RLS
alter table public.crm_settings enable row level security;

drop policy if exists crm_settings_read_all on public.crm_settings;
create policy crm_settings_read_all on public.crm_settings
    for select to authenticated
    using (true);

drop policy if exists crm_settings_admin_all on public.crm_settings;
create policy crm_settings_admin_all on public.crm_settings
    for all to authenticated
    using (public.current_role() = 'admin')
    with check (public.current_role() = 'admin');

grant all on public.crm_settings to authenticated;

-- Update crm_can_access_store to support centralization
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
  -- Admins always have access
  if public.current_role() = 'admin' then
    return true;
  end if;

  -- Sellers have access to their own store, or all stores if centralized is ON
  if public.current_role() = 'seller' then
    select value_bool into v_centralized from public.crm_settings where id = 'centralized_service' limit 1;
    if v_centralized is true then
      return true;
    end if;

    return p_store_id is not null and p_store_id = public.current_store_id();
  end if;

  return false;
end;
$$;
