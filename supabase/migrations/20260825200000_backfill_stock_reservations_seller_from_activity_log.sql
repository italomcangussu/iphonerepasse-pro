begin;

-- Backfill de `seller_id` / `seller_name` / `created_by` nas reservas anteriores a
-- 20260825160000_stock_reservations_seller_tracking.sql, que criou essas colunas.
--
-- Fonte de verdade: `app_user_activity_logs`. A tela de estoque grava um evento
-- `inventory_item_reserved` com o `itemId` logo após o RPC `reserve_stock_item` retornar,
-- então o par (itemId, instante) identifica quem clicou em reservar. O log cobre desde
-- 2026-04-16, antes da reserva mais antiga.
--
-- Por que isso foi preciso: um backfill anterior gravou vendedores que não correspondem a
-- ninguém — 5 reservas ganharam nomes (Kauan, Edson, Thais, Ana Leticia) que o RPC jamais
-- poderia ter derivado do usuário que agiu, já que 3 dos 4 autores reais são admins SEM
-- `user_profiles.seller_id`. Este script sobrescreve aquela atribuição.
--
-- A resolução espelha exatamente o que o RPC faz hoje para uma reserva nova:
--   created_by  = usuário do log
--   seller_id   = user_profiles.seller_id desse usuário (NULL para admin sem vendedor)
--   seller_name = sellers.name do seller_id, senão user_access_roles.display_name
-- Assim uma reserva retroativa fica indistinguível de uma criada pelo app.

with match as (
  -- Evento de reserva mais próximo do `reserved_at`. A janela de 10s é folgada: o maior
  -- desvio observado nas 44 reservas é 1,3s. O `row_number` desempata quando a mesma
  -- reserva foi editada depois (o RPC re-emite `inventory_item_reserved` a cada edição),
  -- ficando sempre com a criação.
  select
    r.id as reservation_id,
    l.user_id,
    row_number() over (
      partition by r.id
      order by abs(extract(epoch from (l.occurred_at - r.reserved_at)))
    ) as rn
  from public.stock_reservations r
  join public.app_user_activity_logs l
    on l.action = 'inventory_item_reserved'
   and l.metadata ->> 'itemId' = r.stock_item_id
   and l.occurred_at between r.reserved_at - interval '10 seconds'
                         and r.reserved_at + interval '10 seconds'
),
resolved as (
  select
    m.reservation_id,
    m.user_id,
    up.seller_id as seller_id,
    coalesce(s.name, uar.display_name) as seller_name
  from match m
  left join public.user_profiles up on up.id = m.user_id
  left join public.sellers s on s.id = up.seller_id
  left join public.user_access_roles uar on uar.user_id = m.user_id
  where m.rn = 1
)
update public.stock_reservations r
   set created_by  = resolved.user_id,
       seller_id   = resolved.seller_id,
       seller_name = resolved.seller_name
  from resolved
 where resolved.reservation_id = r.id
   and (r.created_by  is distinct from resolved.user_id
     or r.seller_id   is distinct from resolved.seller_id
     or r.seller_name is distinct from resolved.seller_name);

commit;
