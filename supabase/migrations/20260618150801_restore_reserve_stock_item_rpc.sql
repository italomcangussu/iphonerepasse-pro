-- Restore reserve_stock_item RPC.
--
-- The 20260611181129 migration is recorded as applied in production and the
-- stock_reservations table exists, but the public.reserve_stock_item RPC is
-- missing from pg_proc. Recreate the function in a follow-up migration because
-- already-applied migrations are not replayed by Supabase.

create or replace function public.reserve_stock_item(p_stock_item_id text, p_payload jsonb)
returns public.stock_reservations
language plpgsql
set search_path = public
as $$
declare
  v_stock_item public.stock_items%rowtype;
  v_existing_reservation public.stock_reservations%rowtype;
  v_saved_reservation public.stock_reservations%rowtype;
  v_customer_name text := btrim(coalesce(p_payload ->> 'customerName', ''));
  v_customer_phone text := btrim(coalesce(p_payload ->> 'customerPhone', ''));
  v_expires_at timestamptz := nullif(p_payload ->> 'expiresAt', '')::timestamptz;
  v_deposit_amount numeric(10,2) := nullif(p_payload ->> 'depositAmount', '')::numeric(10,2);
  v_deposit_payment_method text := nullif(btrim(coalesce(p_payload ->> 'depositPaymentMethod', '')), '');
  v_notes text := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
begin
  if v_customer_name = '' then
    raise exception 'Informe o cliente da reserva.';
  end if;

  if v_customer_phone = '' then
    raise exception 'Informe o telefone da reserva.';
  end if;

  if v_deposit_amount is not null and v_deposit_amount < 0 then
    raise exception 'Valor do sinal inválido.';
  end if;

  if coalesce(v_deposit_amount, 0) = 0 then
    v_deposit_amount := null;
    v_deposit_payment_method := null;
  elsif v_deposit_payment_method is null then
    raise exception 'Informe a forma do sinal.';
  end if;

  select *
    into v_stock_item
    from public.stock_items
    where id = p_stock_item_id
    for update;

  if not found then
    raise exception 'Aparelho não encontrado no estoque.';
  end if;

  if v_stock_item.status not in ('Disponível', 'Reservado') then
    raise exception 'Aparelho está em % e não pode ser reservado.', v_stock_item.status;
  end if;

  select *
    into v_existing_reservation
    from public.stock_reservations
    where stock_item_id = p_stock_item_id
      and status = 'active'
    for update;

  if found then
    update public.stock_reservations
       set customer_name = v_customer_name,
           customer_phone = v_customer_phone,
           expires_at = v_expires_at,
           deposit_amount = v_deposit_amount,
           deposit_payment_method = v_deposit_payment_method,
           notes = v_notes,
           released_at = null,
           sold_at = null
     where id = v_existing_reservation.id
     returning * into v_saved_reservation;
  else
    insert into public.stock_reservations (
      id,
      stock_item_id,
      customer_name,
      customer_phone,
      expires_at,
      deposit_amount,
      deposit_payment_method,
      notes,
      status,
      released_at,
      sold_at
    )
    values (
      'res_' || replace(gen_random_uuid()::text, '-', ''),
      p_stock_item_id,
      v_customer_name,
      v_customer_phone,
      v_expires_at,
      v_deposit_amount,
      v_deposit_payment_method,
      v_notes,
      'active',
      null,
      null
    )
    returning * into v_saved_reservation;
  end if;

  update public.stock_items
     set status = 'Reservado'
   where id = p_stock_item_id;

  return v_saved_reservation;
end;
$$;

revoke all on function public.reserve_stock_item(text, jsonb) from public;
revoke all on function public.reserve_stock_item(text, jsonb) from anon;
grant execute on function public.reserve_stock_item(text, jsonb) to authenticated;

notify pgrst, 'reload schema';
