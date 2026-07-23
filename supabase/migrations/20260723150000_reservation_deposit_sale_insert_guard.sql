begin;

-- Guard de inserção contra duplicação do sinal de reserva no caixa.
--
-- O sinal entra no financeiro como transação IN "Adiantamento de reserva" na
-- criação da reserva (reserve_stock_item). Na venda, o pagamento com
-- source='reservation_deposit' é pulado pelos efeitos financeiros
-- (pdv_create_sale_financial_side_effects) porque esse dinheiro já está no
-- extrato. Se uma venda incluir um aparelho com reserva ativa e sinal pago
-- SEM o pagamento vinculado, o total cheio vira "Venda" e o adiantamento
-- permanece — o sinal é contado duas vezes, e a reserva fica órfã ('active'
-- num aparelho 'Vendido', ainda passível de estorno espúrio).
--
-- O caminho de edição (pdv_rebuild_sale_full_payload) já tem esse guard; o
-- de inserção (pdv_insert_sale_full_payload — usado pelo PDV via
-- create_sale_full e pelo admin agent via admin_agent_create_sale) não tinha.
-- O guard vive aqui, em pdv_apply_reservation_deposit_payments, chamado por
-- ambos os caminhos, e roda ANTES do early-return de "nenhum pagamento de
-- sinal nesta venda" — que é exatamente o cenário quebrado.

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

notify pgrst, 'reload schema';

commit;
