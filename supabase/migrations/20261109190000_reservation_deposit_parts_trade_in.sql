begin;

-- Reserva com mais de um sinal (formas de pagamento diferentes) e com o
-- aparelho que o cliente deixa na troca.
--
-- Como o caixa continua íntegro:
-- * Cada sinal vira um lançamento de entrada na conta da sua forma
--   (Dinheiro → Cofre, o resto → Conta Bancária).
-- * deposit_amount segue sendo o TOTAL e deposit_transaction_id o lançamento
--   do 1º sinal: o PDV ("Sinal já pago") e a validação da venda não mudam.
-- * Os demais lançamentos ficam em deposit_parts[i].transactionId e o
--   estorno devolve cada sinal pela conta em que entrou.
-- * A troca é só informação da reserva (mensagem e saldo a pagar); ela não
--   gera lançamento — o aparelho entra no estoque na venda, pelo PDV.

alter table public.stock_reservations
  add column if not exists deposit_parts jsonb not null default '[]'::jsonb,
  add column if not exists trade_in jsonb null;

-- Reservas antigas com sinal passam a ter o sinal único descrito em deposit_parts.
update public.stock_reservations
   set deposit_parts = jsonb_build_array(jsonb_build_object(
         'amount', deposit_amount,
         'method', deposit_payment_method,
         'transactionId', deposit_transaction_id
       ))
 where coalesce(deposit_amount, 0) > 0
   and deposit_parts = '[]'::jsonb;

-- Lê os sinais do payload: `depositParts` (novo) ou o par legado
-- depositAmount/depositPaymentMethod. Sinais zerados são ignorados.
create or replace function public.reservation_payload_deposit_parts(p_payload jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_parts jsonb := '[]'::jsonb;
  v_part jsonb;
  v_amount numeric(10,2);
  v_method text;
begin
  if jsonb_typeof(p_payload -> 'depositParts') = 'array' then
    for v_part in select value from jsonb_array_elements(p_payload -> 'depositParts')
    loop
      v_amount := nullif(v_part ->> 'amount', '')::numeric(10,2);
      v_method := nullif(btrim(coalesce(v_part ->> 'method', '')), '');
      if v_amount is not null and v_amount < 0 then
        raise exception 'Valor do sinal invalido.';
      end if;
      if coalesce(v_amount, 0) = 0 then
        continue;
      end if;
      if v_method is null then
        raise exception 'Informe a forma do sinal.';
      end if;
      v_parts := v_parts || jsonb_build_array(jsonb_build_object('amount', v_amount, 'method', v_method));
    end loop;
    return v_parts;
  end if;

  v_amount := nullif(p_payload ->> 'depositAmount', '')::numeric(10,2);
  v_method := nullif(btrim(coalesce(p_payload ->> 'depositPaymentMethod', '')), '');
  if v_amount is not null and v_amount < 0 then
    raise exception 'Valor do sinal invalido.';
  end if;
  if coalesce(v_amount, 0) = 0 then
    return v_parts;
  end if;
  if v_method is null then
    raise exception 'Informe a forma do sinal.';
  end if;
  return jsonb_build_array(jsonb_build_object('amount', v_amount, 'method', v_method));
end;
$$;

-- Troca informada na reserva: descrição livre do aparelho e o valor dado por ele.
create or replace function public.reservation_payload_trade_in(p_payload jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_description text := nullif(btrim(coalesce(p_payload -> 'tradeIn' ->> 'description', '')), '');
  v_value numeric(10,2) := nullif(p_payload -> 'tradeIn' ->> 'value', '')::numeric(10,2);
begin
  if jsonb_typeof(p_payload -> 'tradeIn') is distinct from 'object' then
    return null;
  end if;
  if v_value is not null and v_value < 0 then
    raise exception 'Valor da troca invalido.';
  end if;
  if v_description is null and coalesce(v_value, 0) = 0 then
    return null;
  end if;
  if v_description is null then
    raise exception 'Informe o aparelho da troca.';
  end if;
  return jsonb_build_object('description', v_description, 'value', coalesce(v_value, 0));
end;
$$;

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
  v_customer_name text := btrim(coalesce(p_payload ->> 'customerName', ''));
  v_customer_phone text := btrim(coalesce(p_payload ->> 'customerPhone', ''));
  v_expires_at timestamptz := nullif(p_payload ->> 'expiresAt', '')::timestamptz;
  v_parts jsonb := public.reservation_payload_deposit_parts(p_payload);
  v_trade_in jsonb := public.reservation_payload_trade_in(p_payload);
  v_deposit_amount numeric(10,2);
  v_deposit_payment_method text;
  v_notes text := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
  v_seller_id text := nullif(btrim(coalesce(p_payload ->> 'sellerId', '')), '');
  v_seller_name text := nullif(btrim(coalesce(p_payload ->> 'sellerName', '')), '');
  v_created_by uuid := auth.uid();
  v_description text;
  v_old_parts jsonb := '[]'::jsonb;
  v_saved_parts jsonb := '[]'::jsonb;
  v_part jsonb;
  v_old_part jsonb;
  v_index integer;
  v_part_count integer;
  v_amount numeric(10,2);
  v_method text;
  v_transaction_id text;
begin
  if v_customer_name = '' then
    raise exception 'Informe o cliente da reserva.';
  end if;

  if v_customer_phone = '' then
    raise exception 'Informe o telefone da reserva.';
  end if;

  v_part_count := jsonb_array_length(v_parts);
  if v_part_count > 0 then
    select sum((value ->> 'amount')::numeric(10,2)) into v_deposit_amount
      from jsonb_array_elements(v_parts);
    -- O PDV anexa o sinal com a forma do 1º: ela precisa ser uma forma única.
    v_deposit_payment_method := v_parts -> 0 ->> 'method';
  end if;

  if v_seller_id is null and v_created_by is not null then
    select up.seller_id into v_seller_id
    from public.user_profiles up
    where up.id = v_created_by;
  end if;

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
    v_old_parts := coalesce(v_existing_reservation.deposit_parts, '[]'::jsonb);
    update public.stock_reservations
       set customer_name = v_customer_name,
           customer_phone = v_customer_phone,
           expires_at = v_expires_at,
           deposit_amount = v_deposit_amount,
           deposit_payment_method = v_deposit_payment_method,
           trade_in = v_trade_in,
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
      id, stock_item_id, customer_name, customer_phone, expires_at,
      deposit_amount, deposit_payment_method, trade_in, notes, status,
      seller_id, created_by, seller_name
    )
    values (
      'res_' || replace(gen_random_uuid()::text, '-', ''),
      p_stock_item_id, v_customer_name, v_customer_phone, v_expires_at,
      v_deposit_amount, v_deposit_payment_method, v_trade_in, v_notes, 'active',
      v_seller_id, v_created_by, v_seller_name
    )
    returning * into v_saved_reservation;
  end if;

  v_description := 'Adiantamento de reserva - ' || v_customer_name;

  -- Um lançamento por sinal. O do 1º é o deposit_transaction_id (o PDV usa ele);
  -- os demais vêm do sinal na mesma posição da reserva anterior, para que editar
  -- a reserva atualize o lançamento em vez de duplicá-lo.
  for v_index in 0 .. v_part_count - 1 loop
    v_part := v_parts -> v_index;
    v_old_part := v_old_parts -> v_index;
    v_amount := (v_part ->> 'amount')::numeric(10,2);
    v_method := v_part ->> 'method';
    v_transaction_id := case
      when v_index = 0 then v_saved_reservation.deposit_transaction_id
      else nullif(v_old_part ->> 'transactionId', '')
    end;

    if v_transaction_id is not null
       and exists (select 1 from public.transactions where id = v_transaction_id) then
      update public.transactions
         set type = 'IN',
             category = 'Adiantamento de reserva',
             amount = v_amount,
             date = case
               when (v_old_part ->> 'amount')::numeric(10,2) is distinct from v_amount
                 or (v_old_part ->> 'method') is distinct from v_method
               then now()
               else date
             end,
             description = v_description,
             account = public.reservation_deposit_account(v_method),
             sale_id = null
       where id = v_transaction_id;
    else
      v_transaction_id := 'trx_' || replace(gen_random_uuid()::text, '-', '');
      insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
      values (
        v_transaction_id, 'IN', 'Adiantamento de reserva', v_amount, now(),
        v_description, public.reservation_deposit_account(v_method), null
      );
    end if;

    v_saved_parts := v_saved_parts || jsonb_build_array(v_part || jsonb_build_object('transactionId', v_transaction_id));
  end loop;

  -- Sinais que saíram da reserva levam junto o lançamento de entrada.
  delete from public.transactions t
   where t.sale_id is null
     and t.category = 'Adiantamento de reserva'
     and t.id in (
       select nullif(old_part.value ->> 'transactionId', '')
         from jsonb_array_elements(v_old_parts) old_part
       union
       select v_saved_reservation.deposit_transaction_id
     )
     and t.id not in (
       select saved_part.value ->> 'transactionId'
         from jsonb_array_elements(v_saved_parts) saved_part
     );

  update public.stock_reservations
     set deposit_parts = v_saved_parts,
         deposit_transaction_id = v_saved_parts -> 0 ->> 'transactionId'
   where id = v_saved_reservation.id
   returning * into v_saved_reservation;

  update public.stock_items
     set status = 'Reservado'
   where id = p_stock_item_id;

  return v_saved_reservation;
end;
$$;

revoke all on function public.reserve_stock_item(text, jsonb) from public;
revoke all on function public.reserve_stock_item(text, jsonb) from anon;
grant execute on function public.reserve_stock_item(text, jsonb) to authenticated;

create or replace function public.release_stock_reservation(
  p_stock_item_id text,
  p_refund_deposit boolean default false
)
returns public.stock_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock_item public.stock_items%rowtype;
  v_reservation public.stock_reservations%rowtype;
  v_saved_reservation public.stock_reservations%rowtype;
  v_parts jsonb;
  v_refunded_parts jsonb := '[]'::jsonb;
  v_part jsonb;
  v_refund_transaction_id text;
  v_first_refund_transaction_id text;
  v_refund_account text;
begin
  select *
    into v_stock_item
    from public.stock_items
    where id = p_stock_item_id
    for update;

  if not found then
    raise exception 'Aparelho nao encontrado no estoque.';
  end if;

  select *
    into v_reservation
    from public.stock_reservations
    where stock_item_id = p_stock_item_id
      and status = 'active'
    for update;

  if not found then
    raise exception 'Reserva ativa nao encontrada para o aparelho.';
  end if;

  if p_refund_deposit and coalesce(v_reservation.deposit_amount, 0) > 0 then
    v_parts := coalesce(nullif(v_reservation.deposit_parts, '[]'::jsonb), jsonb_build_array(jsonb_build_object(
      'amount', v_reservation.deposit_amount,
      'method', v_reservation.deposit_payment_method,
      'transactionId', v_reservation.deposit_transaction_id
    )));

    -- Cada sinal volta pela conta em que entrou.
    for v_part in select value from jsonb_array_elements(v_parts)
    loop
      select account
        into v_refund_account
        from public.transactions
        where id = v_part ->> 'transactionId';

      -- Sem o lançamento de entrada do sinal, criar a saída de estorno
      -- geraria um OUT órfão (dinheiro saindo sem nunca ter entrado no
      -- extrato) — principal vetor de saldo negativo no Cofre.
      if v_refund_account is null then
        raise exception 'O lançamento de entrada do sinal desta reserva não existe mais no financeiro. Libere sem devolver e registre a devolução manualmente.';
      end if;

      v_refund_transaction_id := 'trx_' || replace(gen_random_uuid()::text, '-', '');
      v_first_refund_transaction_id := coalesce(v_first_refund_transaction_id, v_refund_transaction_id);

      insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
      values (
        v_refund_transaction_id, 'OUT', 'Estorno de reserva',
        (v_part ->> 'amount')::numeric(10,2), now(),
        'Estorno de reserva - ' || v_reservation.customer_name, v_refund_account, null
      );

      v_refunded_parts := v_refunded_parts || jsonb_build_array(
        v_part || jsonb_build_object('refundTransactionId', v_refund_transaction_id)
      );
    end loop;

    update public.stock_reservations
       set status = 'released',
           released_at = now(),
           sold_at = null,
           deposit_parts = v_refunded_parts,
           deposit_refund_transaction_id = v_first_refund_transaction_id,
           deposit_refunded_at = now(),
           deposit_retained_at = null,
           sold_sale_id = null
     where id = v_reservation.id
     returning * into v_saved_reservation;
  else
    update public.stock_reservations
       set status = 'released',
           released_at = now(),
           sold_at = null,
           deposit_refund_transaction_id = null,
           deposit_refunded_at = null,
           deposit_retained_at = case
             when coalesce(deposit_amount, 0) > 0 then now()
             else null
           end,
           sold_sale_id = null
     where id = v_reservation.id
     returning * into v_saved_reservation;
  end if;

  update public.stock_items
     set status = 'Disponível'
   where id = p_stock_item_id;

  return v_saved_reservation;
end;
$$;

notify pgrst, 'reload schema';

commit;
