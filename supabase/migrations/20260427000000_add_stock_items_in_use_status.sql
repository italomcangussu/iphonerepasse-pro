-- Adds the Em Uso menu permission. Stock item status is stored as text, so no
-- enum migration is required for stock_items.status.

with roles(role) as (
  values ('admin'::text), ('manager'::text), ('seller'::text)
),
feature(permission_key, label, seller_visible, seller_editable, seller_deletable, manager_visible, manager_editable, manager_deletable) as (
  values ('in_use', 'Em Uso', true, true, false, true, true, false)
)
insert into public.app_role_permissions (role, permission_key, label, is_visible, is_editable, is_deletable)
select
  r.role,
  f.permission_key,
  f.label,
  case when r.role = 'admin' then true when r.role = 'manager' then f.manager_visible else f.seller_visible end,
  case when r.role = 'admin' then true when r.role = 'manager' then f.manager_editable else f.seller_editable end,
  case when r.role = 'admin' then true when r.role = 'manager' then f.manager_deletable else f.seller_deletable end
from roles r
cross join feature f
on conflict (role, permission_key) do update
set label = excluded.label;
