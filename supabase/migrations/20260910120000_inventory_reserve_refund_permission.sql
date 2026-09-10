-- Nova permissão "Estorno de sinal de reserva" (inventory_reserve_refund).
--
-- Liberar um aparelho reservado devolvendo o sinal estava preso a
-- finance.editable — a mesma chave que abre o Financeiro inteiro (extrato,
-- lançamentos, contas). O gerente não tem Financeiro por padrão, então
-- quando o cliente desistia da reserva ele só conseguia liberar retendo o
-- sinal e precisava chamar um admin para devolver o dinheiro.
--
-- Separando a capacidade, o gerente resolve a desistência no balcão sem
-- ganhar acesso ao caixa. O vendedor continua sem estorno (libera apenas
-- retendo o sinal); quem já tem finance.editable também continua podendo
-- estornar, então nenhum acesso atual é removido.
--
-- Default: admin e gerente sim, vendedor não.

with roles(role) as (
  values ('admin'::text), ('manager'::text), ('seller'::text)
),
feature(permission_key, label, seller_visible, seller_editable, seller_deletable, manager_visible, manager_editable, manager_deletable) as (
  values ('inventory_reserve_refund', 'Estorno de sinal de reserva', false, false, false, true, true, false)
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
