-- Settings tabs support: operational roles, permissions matrix and user activity logs.

create or replace function public.app_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_access_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_role text not null check (app_role in ('admin', 'manager', 'seller')),
  display_name text not null,
  email text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_role_permissions (
  role text not null check (role in ('admin', 'manager', 'seller')),
  permission_key text not null,
  label text not null,
  is_visible boolean not null default false,
  is_editable boolean not null default false,
  is_deletable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role, permission_key)
);

create table if not exists public.app_user_activity_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  app_role text not null check (app_role in ('admin', 'manager', 'seller')),
  category text not null,
  action text not null,
  screen text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_app_user_activity_logs_user_date
  on public.app_user_activity_logs(user_id, occurred_at desc);

create index if not exists idx_app_user_activity_logs_category_date
  on public.app_user_activity_logs(category, occurred_at desc);

alter table public.user_access_roles enable row level security;
alter table public.app_role_permissions enable row level security;
alter table public.app_user_activity_logs enable row level security;

drop policy if exists user_access_roles_admin_all on public.user_access_roles;
create policy user_access_roles_admin_all on public.user_access_roles
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists user_access_roles_self_select on public.user_access_roles;
create policy user_access_roles_self_select on public.user_access_roles
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists app_role_permissions_admin_all on public.app_role_permissions;
create policy app_role_permissions_admin_all on public.app_role_permissions
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists app_role_permissions_auth_select on public.app_role_permissions;
create policy app_role_permissions_auth_select on public.app_role_permissions
  for select to authenticated
  using (true);

drop policy if exists app_user_activity_logs_admin_select on public.app_user_activity_logs;
create policy app_user_activity_logs_admin_select on public.app_user_activity_logs
  for select to authenticated
  using (public.current_role() = 'admin');

drop policy if exists app_user_activity_logs_self_select on public.app_user_activity_logs;
create policy app_user_activity_logs_self_select on public.app_user_activity_logs
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists app_user_activity_logs_self_insert on public.app_user_activity_logs;
create policy app_user_activity_logs_self_insert on public.app_user_activity_logs
  for insert to authenticated
  with check (auth.uid() = user_id);

drop trigger if exists trg_user_access_roles_set_updated_at on public.user_access_roles;
create trigger trg_user_access_roles_set_updated_at
before update on public.user_access_roles
for each row execute function public.app_set_updated_at();

drop trigger if exists trg_app_role_permissions_set_updated_at on public.app_role_permissions;
create trigger trg_app_role_permissions_set_updated_at
before update on public.app_role_permissions
for each row execute function public.app_set_updated_at();

-- Seed operational roles from existing user profiles.
insert into public.user_access_roles (user_id, app_role, display_name, email, created_by)
select
  up.id,
  case when up.role = 'admin' then 'admin' else 'seller' end as app_role,
  coalesce(s.name, split_part(coalesce(au.email, 'usuario@local'), '@', 1), 'usuario') as display_name,
  coalesce(au.email, 'sem-email@local') as email,
  null
from public.user_profiles up
left join public.sellers s on s.id = up.seller_id
left join auth.users au on au.id = up.id
on conflict (user_id) do update
set
  app_role = excluded.app_role,
  display_name = excluded.display_name,
  email = excluded.email,
  updated_at = now();

-- Seed default permissions matrix.
with roles(role) as (
  values ('admin'::text), ('manager'::text), ('seller'::text)
),
features(permission_key, label, seller_visible, seller_editable, seller_deletable, manager_visible, manager_editable, manager_deletable) as (
  values
    ('dashboard', 'Dashboard', true, true, false, true, true, false),
    ('pdv', 'PDV e Historico de vendas', true, true, false, true, true, false),
    ('inventory', 'Estoque de aparelhos', true, true, false, true, true, false),
    ('clients', 'Clientes', true, true, false, true, true, false),
    ('warranties', 'Garantias', true, true, false, true, true, false),
    ('debtors', 'Devedores', false, false, false, false, false, false),
    ('finance', 'Financeiro', false, false, false, false, false, false),
    ('parts_stock', 'Estoque de pecas', true, true, false, true, true, false),
    ('sellers', 'Vendedores', false, false, false, false, false, false),
    ('stores', 'Lojas', false, false, false, false, false, false),
    ('settings', 'Configuracoes (menu)', true, true, false, true, true, false),
    ('profile_store', 'Perfil da loja', false, false, false, false, false, false),
    ('card_fees', 'Taxas de cartao', true, false, false, true, true, false),
    ('settings_accounts', 'Senhas e Contas', false, false, false, false, false, false),
    ('user_logs', 'Log de usuarios', false, false, false, false, false, false),
    ('permissions_privacy', 'Permissoes e Privacidade', false, false, false, false, false, false)
)
insert into public.app_role_permissions (role, permission_key, label, is_visible, is_editable, is_deletable)
select
  r.role,
  f.permission_key,
  f.label,
  case
    when r.role = 'admin' then true
    when r.role = 'manager' then f.manager_visible
    else f.seller_visible
  end,
  case
    when r.role = 'admin' then true
    when r.role = 'manager' then f.manager_editable
    else f.seller_editable
  end,
  case
    when r.role = 'admin' then true
    when r.role = 'manager' then f.manager_deletable
    else f.seller_deletable
  end
from roles r
cross join features f
on conflict (role, permission_key) do nothing;
