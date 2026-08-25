begin;

-- Add seller and created_by columns to stock_reservations
alter table public.stock_reservations
  add column if not exists seller_id text references public.sellers(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists seller_name text null;

create index if not exists idx_stock_reservations_seller_id
  on public.stock_reservations(seller_id);

create or replace function public.reserve_stock_item(p_stock_item_id text, p_payload jsonb)
returns public.stock_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock_item public.stock_items%rowtype;
  v_existing_reservation public.stock_reservations%rowtype;
  v_saved_reservation public.stock_reservations%rowtype;
  v_deposit_transaction_id text;
  v_customer_name text := btrim(coalesce(p_payload ->> 'customerName', ''));
  v_customer_phone text := btrim(coalesce(p_payload ->> 'customerPhone', ''));
  v_expires_at timestamptz := nullif(p_payload ->> 'expiresAt', '')::timestamptz;
  v_deposit_amount numeric(10,2) := nullif(p_payload ->> 'depositAmount', '')::numeric(10,2);
  v_deposit_payment_method text := nullif(btrim(coalesce(p_payload ->> 'depositPaymentMethod', '')), '');
  v_notes text := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
  v_seller_id text := nullif(btrim(coalesce(p_payload ->> 'sellerId', '')), '');
  v_seller_name text := nullif(btrim(coalesce(p_payload ->> 'sellerName', '')), '');
  v_created_by uuid := auth.uid();
  v_description text;
begin
  if v_customer_name = '' then
    raise exception 'Informe o cliente da reserva.';
  end if;

  if v_customer_phone = '' then
    raise exception 'Informe o telefone da reserva.';
  end if;

  if v_deposit_amount is not null and v_deposit_amount < 0 then
    raise exception 'Valor do sinal invalido.';
  end if;

  if coalesce(v_deposit_amount, 0) = 0 then
    v_deposit_amount := null;
    v_deposit_payment_method := null;
  elsif v_deposit_payment_method is null then
    raise exception 'Informe a forma do sinal.';
  end if;

  -- Se seller_id não foi passado no payload, tentar resolver via auth.uid()
  if v_seller_id is null and v_created_by is not null then
    select up.seller_id into v_seller_id
    from public.user_profiles up
    where up.id = v_created_by;
  end if;

  -- Se seller_name não foi passado, resolver do seller ou do user_access_roles
  if v_seller_name is null and v_seller_id is not null then
    select s.name into v_seller_name
    from public.sellers s
    where s.id = v_seller_id;
  end if;

  if v_seller_name is null and v_created_by is not null then
    select uar.display_name into v_seller_name
    from public.user_access_roles uar
    where uar.user_id = v_created_by;
  end if;

  select *
    into v_stock_item
    from public.stock_items
    where id = p_stock_item_id
    for update;

  if not found then
    raise exception 'Aparelho nao encontrado no estoque.';
  end if;

  if v_stock_item.status not in ('Disponivel', 'Disponível', 'Reservado') then
    raise exception 'Aparelho esta em % e nao pode ser reservado.', v_stock_item.status;
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
           seller_id = coalesce(v_seller_id, seller_id),
           seller_name = coalesce(v_seller_name, seller_name),
           released_at = null,
           sold_at = null,
           deposit_refund_transaction_id = null,
           deposit_refunded_at = null,
           deposit_retained_at = null,
           sold_sale_id = null
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
      seller_id,
      created_by,
      seller_name,
      released_at,
      sold_at,
      deposit_refund_transaction_id,
      deposit_refunded_at,
      deposit_retained_at,
      sold_sale_id
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
      v_seller_id,
      v_created_by,
      v_seller_name,
      null,
      null,
      null,
      null,
      null,
      null
    )
    returning * into v_saved_reservation;
  end if;

  v_description := 'Adiantamento de reserva - ' || v_customer_name;

  if v_deposit_amount is not null then
    if v_saved_reservation.deposit_transaction_id is not null then
      update public.transactions
         set type = 'IN',
             category = 'Adiantamento de reserva',
             amount = v_deposit_amount,
             date = case
               when v_existing_reservation.deposit_amount is distinct from v_deposit_amount
                 or v_existing_reservation.deposit_payment_method is distinct from v_deposit_payment_method
               then now()
               else date
             end,
             description = v_description,
             account = public.reservation_deposit_account(v_deposit_payment_method),
             sale_id = null
       where id = v_saved_reservation.deposit_transaction_id;

      v_deposit_transaction_id := v_saved_reservation.deposit_transaction_id;
    else
      v_deposit_transaction_id := 'trx_' || replace(gen_random_uuid()::text, '-', '');

      insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
      values (
        v_deposit_transaction_id,
        'IN',
        'Adiantamento de reserva',
        v_deposit_amount,
        now(),
        v_description,
        public.reservation_deposit_account(v_deposit_payment_method),
        null
      );
    end if;

    update public.stock_reservations
       set deposit_transaction_id = v_deposit_transaction_id
     where id = v_saved_reservation.id
     returning * into v_saved_reservation;
  else
    if v_saved_reservation.deposit_transaction_id is not null then
      v_deposit_transaction_id := v_saved_reservation.deposit_transaction_id;

      update public.stock_reservations
         set deposit_transaction_id = null
       where id = v_saved_reservation.id
       returning * into v_saved_reservation;

      delete from public.transactions
      where id = v_deposit_transaction_id
        and sale_id is null
        and category = 'Adiantamento de reserva';
    end if;
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

commit;
