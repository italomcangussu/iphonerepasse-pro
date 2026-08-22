-- Nova permissão "Reservas de aparelhos" (inventory_reserve).
--
-- Reservar, editar/liberar reserva e "Vender reservado" estavam presos a
-- inventory.editable — a mesma chave que libera cadastrar/editar/precificar
-- aparelho. Em produção o vendedor tem inventory.is_editable = false, então
-- não conseguia reservar. Separando a capacidade, o vendedor reserva sem
-- ganhar edição do cadastro do estoque.
--
-- Default: visível e editável para os três papéis (é ação de venda).
-- O estorno do sinal continua fora daqui: ele exige finance.editable.

with roles(role) as (
  values ('admin'::text), ('manager'::text), ('seller'::text)
),
feature(permission_key, label, seller_visible, seller_editable, seller_deletable, manager_visible, manager_editable, manager_deletable) as (
  values ('inventory_reserve', 'Reservas de aparelhos', true, true, false, true, true, false)
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
