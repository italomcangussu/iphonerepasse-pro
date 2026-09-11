begin;

-- ============================================================
-- Vender um aparelho reservado SEM sinal passa a encerrar a reserva.
--
-- pdv_apply_reservation_deposit_payments só fecha reservas que têm um
-- pagamento "Sinal já pago" na venda: quando não há nenhum, ela retorna
-- cedo. Resultado para uma reserva sem sinal (deposit_amount nulo/zero):
-- o aparelho vira 'Vendido' e a reserva fica 'active' pendurada nele.
--
-- Dois efeitos: o aparelho aparece como reservado num item já vendido, e
-- — pior — cancel_sale só religa reservas com status 'sold', então cancelar
-- essa venda NÃO devolve o aparelho para "Reservado": ele cai em
-- "Disponível" e o combinado com o cliente se perde.
--
-- Correção: marcar como 'sold' também as reservas ativas sem sinal dos
-- itens da venda, ANTES do early-return. Reservas COM sinal seguem
-- exatamente o caminho de hoje (guard de duplicidade + validação do
-- vínculo) — nada muda para elas.
-- ============================================================

create or replace function public.pdv_apply_reservation_deposit_payments(
  p_sale_id text,
  p_sale_date timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_count integer;
  v_valid_count integer;
begin
  if exists (
    select 1
    from public.sale_items si
    join public.stock_reservations sr
      on sr.stock_item_id = si.stock_item_id
     and sr.status = 'active'
     and coalesce(sr.deposit_amount, 0) > 0
     and sr.deposit_transaction_id is not null
    where si.sale_id = p_sale_id
      and not exists (
        select 1
        from public.payment_methods pm
        where pm.sale_id = p_sale_id
          and pm.source = 'reservation_deposit'
          and pm.reservation_id = sr.id
      )
  ) then
    raise exception 'Aparelho com reserva ativa com sinal pago: inclua o pagamento "Sinal já pago" na venda ou libere a reserva (estornando ou retendo o sinal) antes de vender.';
  end if;

  -- Reservas sem sinal: nada a validar no caixa (não houve dinheiro), mas a
  -- reserva foi consumida por esta venda e precisa constar como tal para que
  -- o cancelamento saiba devolvê-la.
  update public.stock_reservations sr
     set status = 'sold',
         sold_at = coalesce(sr.sold_at, p_sale_date, now()),
         sold_sale_id = p_sale_id,
         released_at = null
   where sr.status = 'active'
     and coalesce(sr.deposit_amount, 0) = 0
     and exists (
       select 1
       from public.sale_items si
       where si.sale_id = p_sale_id
         and si.stock_item_id = sr.stock_item_id
     );

  select count(*)
    into v_expected_count
    from public.payment_methods pm
    where pm.sale_id = p_sale_id
      and pm.source = 'reservation_deposit';

  if coalesce(v_expected_count, 0) = 0 then
    return;
  end if;

  if exists (
    select 1
    from public.payment_methods pm
    where pm.sale_id = p_sale_id
      and pm.source = 'reservation_deposit'
      and (pm.reservation_id is null or pm.reservation_deposit_transaction_id is null)
  ) then
    raise exception 'Pagamento de sinal da reserva sem vinculo com a reserva.';
  end if;

  select count(*)
    into v_valid_count
    from public.payment_methods pm
    join public.stock_reservations sr
      on sr.id = pm.reservation_id
    join public.sale_items si
      on si.sale_id = pm.sale_id
     and si.stock_item_id = sr.stock_item_id
    where pm.sale_id = p_sale_id
      and pm.source = 'reservation_deposit'
      and pm.reservation_deposit_transaction_id = sr.deposit_transaction_id
      and coalesce(pm.amount, 0) = coalesce(sr.deposit_amount, 0)
      and sr.deposit_refunded_at is null
      and sr.deposit_retained_at is null
      and (
        sr.status = 'active'
        or (sr.status = 'sold' and sr.sold_sale_id = p_sale_id)
      );

  if v_valid_count <> v_expected_count then
    raise exception 'Sinal de reserva invalido para a venda.';
  end if;

  update public.stock_reservations sr
     set status = 'sold',
         sold_at = coalesce(sr.sold_at, p_sale_date, now()),
         sold_sale_id = p_sale_id,
         released_at = null
   where sr.id in (
     select distinct pm.reservation_id
     from public.payment_methods pm
     join public.sale_items si
       on si.sale_id = pm.sale_id
     where pm.sale_id = p_sale_id
       and pm.source = 'reservation_deposit'
       and si.stock_item_id = sr.stock_item_id
   );
end;
$$;

revoke all on function public.pdv_apply_reservation_deposit_payments(text, timestamptz) from public;
revoke all on function public.pdv_apply_reservation_deposit_payments(text, timestamptz) from anon;

-- ------------------------------------------------------------
-- Backfill das reservas sem sinal que ficaram 'active' em aparelhos já
-- vendidos. Reconstrói o vínculo pela venda que consumiu o aparelho, para
-- que um cancelamento futuro devolva o aparelho para "Reservado".
-- ------------------------------------------------------------
update public.stock_reservations sr
   set status = 'sold',
       sold_at = coalesce(sr.sold_at, s.date),
       sold_sale_id = s.id,
       released_at = null
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  join public.stock_items sit on sit.id = si.stock_item_id
 where sr.stock_item_id = si.stock_item_id
   and sr.status = 'active'
   and coalesce(sr.deposit_amount, 0) = 0
   and sit.status = 'Vendido';

notify pgrst, 'reload schema';

commit;
