begin;

-- ============================================================
-- Excluir um custo de reparo/preparação passa a existir de verdade.
--
-- O "X" da aba Custos de Reparo / Preparação só removia o item do estado
-- local do formulário: updateStockItem mapeia campo a campo e nunca tocou
-- em `costs`, e não havia nenhum DELETE nessa tabela em todo o app. Bastava
-- um reload (ou um evento realtime) para o custo reaparecer — e o operador,
-- vendo o custo "voltar", lançava de novo: é daí que vêm as duplicatas.
--
-- Duas peças aqui:
--
-- 1. costs.part_id / costs.part_quantity: um custo gerado a partir do
--    estoque de peças baixa parts_inventory. Sem saber qual peça e quanto,
--    excluir o custo deixaria a baixa órfã. Guardar o vínculo permite
--    devolver a quantidade — e evita adivinhar pela descrição
--    ("Peça: <nome> xN"), que quebra assim que alguém renomeia a peça.
--
-- 2. remove_stock_item_cost(): apaga o custo e devolve a peça na MESMA
--    transação. Feito em dois passos pelo cliente, uma falha de rede entre
--    eles deixaria estoque de peça inflado ou custo fantasma.
--
-- Custos antigos (todos, hoje) não têm part_id: são apagados sem devolução,
-- que é o comportamento correto — a baixa deles nunca foi registrada com
-- vínculo e o estoque de peças já foi conciliado manualmente.
-- ============================================================

alter table public.costs
  add column if not exists part_id text null references public.parts_inventory(id) on delete set null;

alter table public.costs
  add column if not exists part_quantity numeric null check (part_quantity is null or part_quantity > 0);

create index if not exists idx_costs_part_id on public.costs (part_id);

create or replace function public.remove_stock_item_cost(p_cost_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost public.costs%rowtype;
begin
  -- A função é security definer (precisa mexer em parts_inventory), então o
  -- papel é conferido à mão. Paridade com o RLS de `costs`, onde admin e
  -- vendedor já podem inserir e atualizar custos: quem lança o custo pode
  -- desfazer o lançamento. Qualquer outro papel não passa daqui.
  if public.current_role() not in ('admin', 'seller') then
    raise exception 'Sem permissão para remover custos do aparelho.'
      using errcode = '42501';
  end if;

  select * into v_cost
  from public.costs
  where id = p_cost_id
  for update;

  if not found then
    -- Idempotente: excluir duas vezes (duplo toque, retry de rede) não é erro.
    return;
  end if;

  -- Devolve a peça ao estoque antes de apagar o custo que a consumiu.
  if v_cost.part_id is not null and coalesce(v_cost.part_quantity, 0) > 0 then
    update public.parts_inventory
       set quantity = quantity + v_cost.part_quantity
     where id = v_cost.part_id;
  end if;

  delete from public.costs where id = p_cost_id;
end;
$$;

revoke all on function public.remove_stock_item_cost(text) from public;
revoke all on function public.remove_stock_item_cost(text) from anon;
grant execute on function public.remove_stock_item_cost(text) to authenticated;

notify pgrst, 'reload schema';

commit;
