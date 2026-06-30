begin;

alter table public.stock_reservations
  add column if not exists deposit_transaction_id text null references public.transactions(id) on delete set null,
  add column if not exists deposit_refund_transaction_id text null references public.transactions(id) on delete set null,
  add column if not exists deposit_refunded_at timestamptz null,
  add column if not exists deposit_retained_at timestamptz null,
  add column if not exists sold_sale_id text null references public.sales(id) on delete set null;

create index if not exists idx_stock_reservations_deposit_transaction_id
  on public.stock_reservations (deposit_transaction_id);

create index if not exists idx_stock_reservations_sold_sale_id
  on public.stock_reservations (sold_sale_id);

alter table public.payment_methods
  add column if not exists source text null,
  add column if not exists reservation_id text null references public.stock_reservations(id) on delete set null,
  add column if not exists reservation_deposit_transaction_id text null references public.transactions(id) on delete set null;

alter table public.payment_methods drop constraint if exists payment_methods_source_check;
alter table public.payment_methods
  add constraint payment_methods_source_check
  check (source is null or source in ('pdv', 'reservation_deposit'));

create index if not exists idx_payment_methods_reservation_id
  on public.payment_methods (reservation_id);

create index if not exists idx_payment_methods_reservation_deposit_transaction_id
  on public.payment_methods (reservation_deposit_transaction_id);

insert into public.finance_categories (id, name, type, is_default)
values
  ('cat_in_reservation_advance', 'Adiantamento de reserva', 'IN', false),
  ('cat_out_reservation_refund', 'Estorno de reserva', 'OUT', false)
on conflict (id) do nothing;

create or replace function public.reservation_deposit_account(p_method text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_method = 'Dinheiro' then 'Cofre'
    else 'Conta Bancária'
  end
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
  v_deposit_transaction_id text;
  v_customer_name text := btrim(coalesce(p_payload ->> 'customerName', ''));
  v_customer_phone text := btrim(coalesce(p_payload ->> 'customerPhone', ''));
  v_expires_at timestamptz := nullif(p_payload ->> 'expiresAt', '')::timestamptz;
  v_deposit_amount numeric(10,2) := nullif(p_payload ->> 'depositAmount', '')::numeric(10,2);
  v_deposit_payment_method text := nullif(btrim(coalesce(p_payload ->> 'depositPaymentMethod', '')), '');
  v_notes text := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
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
  v_refund_transaction_id text;
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
    select account
      into v_refund_account
      from public.transactions
      where id = v_reservation.deposit_transaction_id;

    v_refund_transaction_id := 'trx_' || replace(gen_random_uuid()::text, '-', '');

    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      v_refund_transaction_id,
      'OUT',
      'Estorno de reserva',
      coalesce(v_reservation.deposit_amount, 0),
      now(),
      'Estorno de reserva - ' || v_reservation.customer_name,
      coalesce(v_refund_account, public.reservation_deposit_account(v_reservation.deposit_payment_method)),
      null
    );

    update public.stock_reservations
       set status = 'released',
           released_at = now(),
           sold_at = null,
           deposit_refund_transaction_id = v_refund_transaction_id,
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

create or replace function public.pdv_create_sale_financial_side_effects(p_sale_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_payment public.payment_methods%rowtype;
  v_account text;
  v_seller_name text;
  v_customer_name text;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  if not found then
    raise exception 'Venda nao encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  select name into v_customer_name from public.customers where id = v_sale.customer_id;

  if coalesce(v_sale.trade_in_value, 0) > 0 then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values
      ('trx_' || replace(gen_random_uuid()::text, '-', ''), 'IN', 'Venda', v_sale.trade_in_value, coalesce(v_sale.date, now()), 'Venda (Trade-in) - ' || coalesce(nullif(v_customer_name, ''), v_sale.id), 'Conta Bancária', v_sale.id),
      ('trx_' || replace(gen_random_uuid()::text, '-', ''), 'OUT', 'Compra', v_sale.trade_in_value, coalesce(v_sale.date, now()), 'Entrada (Troca) - ' || coalesce(nullif(v_customer_name, ''), v_sale.id), 'Conta Bancária', v_sale.id);
  end if;

  for v_payment in select * from public.payment_methods where sale_id = p_sale_id loop
    if v_payment.source = 'reservation_deposit' then
      continue;
    end if;

    v_account := coalesce(nullif(v_payment.account, 'Caixa'), 'Conta Bancária');

    if v_payment.type = 'Devedor' then
      insert into public.debts (
        id, customer_id, sale_id, original_amount, remaining_amount, status,
        due_date, first_due_date, installments_total, notes, source
      ) values (
        'debt_' || replace(gen_random_uuid()::text, '-', ''),
        v_sale.customer_id,
        p_sale_id,
        coalesce(v_payment.amount, 0),
        coalesce(v_payment.amount, 0),
        'Aberta',
        v_payment.debt_due_date,
        v_payment.debt_due_date,
        greatest(1, coalesce(v_payment.debt_installments, 1)),
        v_payment.debt_notes,
        'pdv'
      );
    else
      insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
      values (
        'trx_' || replace(gen_random_uuid()::text, '-', ''),
        'IN',
        'Venda',
        coalesce(v_payment.amount, 0),
        coalesce(v_sale.date, now()),
        case
          when v_payment.type in ('Cartão', 'Cartão Débito')
            then 'Venda (' || coalesce(v_payment.type, '') || ') liquido=' || coalesce(v_payment.amount, 0)::text || ' bruto=' || coalesce(v_payment.customer_amount, v_payment.amount, 0)::text || ' taxa=' || coalesce(v_payment.fee_amount, 0)::text || ' - ' || coalesce(nullif(v_customer_name, ''), p_sale_id)
          else 'Venda (' || coalesce(v_payment.type, '') || ') - ' || coalesce(nullif(v_customer_name, ''), p_sale_id)
        end,
        v_account,
        p_sale_id
      );
    end if;
  end loop;

  if coalesce(v_sale.commission, 0) > 0 then
    select name into v_seller_name from public.sellers where id = v_sale.seller_id;

    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Comissão',
      v_sale.commission,
      coalesce(v_sale.date, now()),
      coalesce('Comissão recebida pelo vendedor ' || nullif(v_seller_name, ''), 'Comissão de venda - ' || v_sale.id),
      'Conta Bancária',
      v_sale.id
    );
  end if;
end;
$$;

create or replace function public.pdv_insert_sale_full_payload(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id text := p_payload->>'id';
  v_sale_date timestamptz := coalesce((p_payload->>'date')::timestamptz, now());
  v_trade_in_value numeric := 0;
  v_gross_total numeric := 0;
  v_client_payment jsonb := coalesce(p_payload->'clientPayment', '{}'::jsonb);
  v_client_payment_amount numeric := coalesce((v_client_payment->>'amount')::numeric, 0);
  v_client_payment_mode text := nullif(v_client_payment->>'mode', '');
  v_row jsonb;
  v_customer public.customers%rowtype;
  v_creditor_id text;
begin
  perform public.pdv_assert_sale_payload(p_payload);

  select coalesce(sum(coalesce((trade_in->>'receivedValue')::numeric, 0)), 0)
  into v_trade_in_value
  from jsonb_array_elements(coalesce(p_payload->'tradeIns', '[]'::jsonb)) trade_in;

  v_gross_total := coalesce((p_payload->>'total')::numeric, 0) + v_trade_in_value;

  insert into public.sales (
    id, customer_id, seller_id, store_id, total, discount, discount_type,
    discount_percent, original_subtotal, negotiated_subtotal, commission, date,
    warranty_expires_at, trade_in_id, trade_in_value, client_payment_amount,
    client_payment_mode, client_payment_account, client_payment_method,
    client_payment_notes, client_payment_due_date
  ) values (
    v_sale_id,
    p_payload->>'customerId',
    p_payload->>'sellerId',
    nullif(p_payload->>'storeId', ''),
    coalesce((p_payload->>'total')::numeric, 0),
    coalesce((p_payload->>'discount')::numeric, 0),
    nullif(p_payload->>'discountType', ''),
    nullif(p_payload->>'discountPercent', '')::numeric,
    coalesce((p_payload->>'originalSubtotal')::numeric, 0),
    coalesce((p_payload->>'negotiatedSubtotal')::numeric, 0),
    coalesce((p_payload->>'commission')::numeric, 0),
    v_sale_date,
    nullif(p_payload->>'warrantyExpiresAt', '')::timestamptz,
    null,
    v_trade_in_value,
    nullif(v_client_payment_amount, 0),
    v_client_payment_mode,
    nullif(v_client_payment->>'account', ''),
    nullif(v_client_payment->>'method', ''),
    nullif(v_client_payment->>'notes', ''),
    nullif(v_client_payment->>'dueDate', '')::date
  );

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) loop
    insert into public.sale_items (id, sale_id, stock_item_id, price, original_price)
    values (
      'si_' || replace(gen_random_uuid()::text, '-', ''),
      v_sale_id,
      v_row->>'stockItemId',
      coalesce((v_row->>'price')::numeric, 0),
      coalesce((v_row->>'originalPrice')::numeric, coalesce((v_row->>'price')::numeric, 0))
    );

    update public.stock_items
    set status = 'Vendido',
        warranty_end = coalesce(nullif(v_row->>'warrantyExpiresAt', '')::timestamptz, warranty_end),
        updated_at = now()
    where id = v_row->>'stockItemId';
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'paymentMethods', '[]'::jsonb)) loop
    insert into public.payment_methods (
      id, sale_id, type, amount, account, installments, card_brand,
      customer_amount, fee_rate, fee_amount, debt_due_date, debt_installments, debt_notes,
      source, reservation_id, reservation_deposit_transaction_id
    ) values (
      'pm_' || replace(gen_random_uuid()::text, '-', ''),
      v_sale_id,
      v_row->>'type',
      coalesce((v_row->>'amount')::numeric, 0),
      nullif(v_row->>'account', ''),
      nullif(v_row->>'installments', '')::integer,
      nullif(v_row->>'cardBrand', ''),
      nullif(v_row->>'customerAmount', '')::numeric,
      nullif(v_row->>'feeRate', '')::numeric,
      nullif(v_row->>'feeAmount', '')::numeric,
      nullif(v_row->>'debtDueDate', '')::date,
      nullif(v_row->>'debtInstallments', '')::integer,
      nullif(v_row->>'debtNotes', ''),
      coalesce(nullif(v_row->>'source', ''), 'pdv'),
      nullif(v_row->>'reservationId', ''),
      nullif(v_row->>'reservationDepositTransactionId', '')
    );
  end loop;

  perform public.pdv_create_sale_trade_in_rows(v_sale_id, p_payload, v_sale_date);
  perform public.pdv_apply_reservation_deposit_payments(v_sale_id, v_sale_date);
  perform public.pdv_create_sale_financial_side_effects(v_sale_id);

  if v_client_payment_amount > 0 and v_client_payment_mode = 'immediate' then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Pagamento de trade-in ao cliente',
      v_client_payment_amount,
      v_sale_date,
      'Diferenca trade-in - Venda #' || upper(right(v_sale_id, 6)),
      coalesce(nullif(v_client_payment->>'account', ''), 'Conta Bancária'),
      v_sale_id
    );
  elsif v_client_payment_amount > 0 and v_client_payment_mode = 'payable_debt' then
    select * into v_customer from public.customers where id = p_payload->>'customerId';

    select id into v_creditor_id
    from public.creditors
    where document is not null and document = v_customer.cpf
    limit 1;

    if v_creditor_id is null then
      v_creditor_id := 'crd_' || replace(gen_random_uuid()::text, '-', '');
      insert into public.creditors (id, name, document, document_type, phone, email, notes)
      values (
        v_creditor_id,
        coalesce(v_customer.name, 'Cliente'),
        v_customer.cpf,
        case when v_customer.cpf is null then null else 'CPF' end,
        v_customer.phone,
        v_customer.email,
        'Criado automaticamente por diferenca de trade-in no PDV'
      );
    end if;

    insert into public.payable_debts (
      id, creditor_id, creditor_name, creditor_document, creditor_phone,
      original_amount, remaining_amount, status, due_date, first_due_date,
      installments_total, notes, source, sale_id
    ) values (
      'pdbt_' || replace(gen_random_uuid()::text, '-', ''),
      v_creditor_id,
      coalesce(v_customer.name, 'Cliente'),
      v_customer.cpf,
      v_customer.phone,
      v_client_payment_amount,
      v_client_payment_amount,
      'Aberta',
      nullif(v_client_payment->>'dueDate', '')::date,
      nullif(v_client_payment->>'dueDate', '')::date,
      1,
      nullif(v_client_payment->>'notes', ''),
      'pdv',
      v_sale_id
    );
  end if;

  update public.sellers
  set total_sales = coalesce(total_sales, 0) + v_gross_total,
      updated_at = now()
  where id = p_payload->>'sellerId';

  update public.customers
  set purchases = coalesce(purchases, 0) + 1,
      total_spent = coalesce(total_spent, 0) + v_gross_total,
      updated_at = now()
  where id = p_payload->>'customerId';
end;
$$;

create or replace function public.pdv_rebuild_sale_full_payload(p_sale_id text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.sales%rowtype;
  v_sale_date timestamptz := coalesce((p_payload->>'date')::timestamptz, now());
  v_trade_in_value numeric := 0;
  v_old_gross_total numeric := 0;
  v_new_gross_total numeric := 0;
  v_client_payment jsonb := coalesce(p_payload->'clientPayment', '{}'::jsonb);
  v_client_payment_amount numeric := coalesce((v_client_payment->>'amount')::numeric, 0);
  v_client_payment_mode text := nullif(v_client_payment->>'mode', '');
  v_previous_stock_ids text[] := array[]::text[];
  v_row jsonb;
  v_customer public.customers%rowtype;
  v_creditor_id text;
begin
  perform public.pdv_assert_sale_payload(p_payload);

  select * into v_existing from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda nao encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  select coalesce(array_agg(stock_item_id), array[]::text[])
  into v_previous_stock_ids
  from public.sale_items
  where sale_id = p_sale_id;

  v_old_gross_total := coalesce(v_existing.total, 0) + coalesce(v_existing.trade_in_value, 0);

  select coalesce(sum(coalesce((trade_in->>'receivedValue')::numeric, 0)), 0)
  into v_trade_in_value
  from jsonb_array_elements(coalesce(p_payload->'tradeIns', '[]'::jsonb)) trade_in;

  v_new_gross_total := coalesce((p_payload->>'total')::numeric, 0) + v_trade_in_value;

  delete from public.debt_payments where debt_id in (select id from public.debts where sale_id = p_sale_id);
  delete from public.debts where sale_id = p_sale_id;
  delete from public.payable_debt_payments where payable_debt_id in (select id from public.payable_debts where sale_id = p_sale_id);
  delete from public.payable_debts where sale_id = p_sale_id;
  delete from public.transactions where sale_id = p_sale_id;
  delete from public.sale_trade_in_items where sale_id = p_sale_id;
  delete from public.payment_methods where sale_id = p_sale_id;
  delete from public.sale_items where sale_id = p_sale_id;

  update public.stock_items
  set status = 'Disponível',
      updated_at = now()
  where id = any(v_previous_stock_ids)
    and not exists (
      select 1
      from public.sale_items si
      where si.stock_item_id = public.stock_items.id
    );

  update public.sales
  set customer_id = p_payload->>'customerId',
      seller_id = p_payload->>'sellerId',
      store_id = nullif(p_payload->>'storeId', ''),
      total = coalesce((p_payload->>'total')::numeric, 0),
      discount = coalesce((p_payload->>'discount')::numeric, 0),
      discount_type = nullif(p_payload->>'discountType', ''),
      discount_percent = nullif(p_payload->>'discountPercent', '')::numeric,
      original_subtotal = coalesce((p_payload->>'originalSubtotal')::numeric, 0),
      negotiated_subtotal = coalesce((p_payload->>'negotiatedSubtotal')::numeric, 0),
      commission = coalesce((p_payload->>'commission')::numeric, coalesce(v_existing.commission, 0)),
      date = v_sale_date,
      warranty_expires_at = nullif(p_payload->>'warrantyExpiresAt', '')::timestamptz,
      trade_in_id = null,
      trade_in_value = v_trade_in_value,
      client_payment_amount = nullif(v_client_payment_amount, 0),
      client_payment_mode = v_client_payment_mode,
      client_payment_account = nullif(v_client_payment->>'account', ''),
      client_payment_method = nullif(v_client_payment->>'method', ''),
      client_payment_notes = nullif(v_client_payment->>'notes', ''),
      client_payment_due_date = nullif(v_client_payment->>'dueDate', '')::date
  where id = p_sale_id;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) loop
    insert into public.sale_items (id, sale_id, stock_item_id, price, original_price)
    values (
      'si_' || replace(gen_random_uuid()::text, '-', ''),
      p_sale_id,
      v_row->>'stockItemId',
      coalesce((v_row->>'price')::numeric, 0),
      coalesce((v_row->>'originalPrice')::numeric, coalesce((v_row->>'price')::numeric, 0))
    );

    update public.stock_items
    set status = 'Vendido',
        warranty_end = coalesce(nullif(v_row->>'warrantyExpiresAt', '')::timestamptz, warranty_end),
        updated_at = now()
    where id = v_row->>'stockItemId';
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'paymentMethods', '[]'::jsonb)) loop
    insert into public.payment_methods (
      id, sale_id, type, amount, account, installments, card_brand,
      customer_amount, fee_rate, fee_amount, debt_due_date, debt_installments, debt_notes,
      source, reservation_id, reservation_deposit_transaction_id
    ) values (
      'pm_' || replace(gen_random_uuid()::text, '-', ''),
      p_sale_id,
      v_row->>'type',
      coalesce((v_row->>'amount')::numeric, 0),
      nullif(v_row->>'account', ''),
      nullif(v_row->>'installments', '')::integer,
      nullif(v_row->>'cardBrand', ''),
      nullif(v_row->>'customerAmount', '')::numeric,
      nullif(v_row->>'feeRate', '')::numeric,
      nullif(v_row->>'feeAmount', '')::numeric,
      nullif(v_row->>'debtDueDate', '')::date,
      nullif(v_row->>'debtInstallments', '')::integer,
      nullif(v_row->>'debtNotes', ''),
      coalesce(nullif(v_row->>'source', ''), 'pdv'),
      nullif(v_row->>'reservationId', ''),
      nullif(v_row->>'reservationDepositTransactionId', '')
    );
  end loop;

  perform public.pdv_create_sale_trade_in_rows(p_sale_id, p_payload, v_sale_date);
  perform public.pdv_apply_reservation_deposit_payments(p_sale_id, v_sale_date);
  perform public.pdv_create_sale_financial_side_effects(p_sale_id);

  if v_client_payment_amount > 0 and v_client_payment_mode = 'immediate' then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Pagamento de trade-in ao cliente',
      v_client_payment_amount,
      v_sale_date,
      'Diferenca trade-in - Venda #' || upper(right(p_sale_id, 6)),
      coalesce(nullif(v_client_payment->>'account', ''), 'Conta Bancária'),
      p_sale_id
    );
  elsif v_client_payment_amount > 0 and v_client_payment_mode = 'payable_debt' then
    select * into v_customer from public.customers where id = p_payload->>'customerId';

    select id into v_creditor_id
    from public.creditors
    where document is not null and document = v_customer.cpf
    limit 1;

    if v_creditor_id is null then
      v_creditor_id := 'crd_' || replace(gen_random_uuid()::text, '-', '');
      insert into public.creditors (id, name, document, document_type, phone, email, notes)
      values (
        v_creditor_id,
        coalesce(v_customer.name, 'Cliente'),
        v_customer.cpf,
        case when v_customer.cpf is null then null else 'CPF' end,
        v_customer.phone,
        v_customer.email,
        'Criado automaticamente por diferenca de trade-in no PDV'
      );
    end if;

    insert into public.payable_debts (
      id, creditor_id, creditor_name, creditor_document, creditor_phone,
      original_amount, remaining_amount, status, due_date, first_due_date,
      installments_total, notes, source, sale_id
    ) values (
      'pdbt_' || replace(gen_random_uuid()::text, '-', ''),
      v_creditor_id,
      coalesce(v_customer.name, 'Cliente'),
      v_customer.cpf,
      v_customer.phone,
      v_client_payment_amount,
      v_client_payment_amount,
      'Aberta',
      nullif(v_client_payment->>'dueDate', '')::date,
      nullif(v_client_payment->>'dueDate', '')::date,
      1,
      nullif(v_client_payment->>'notes', ''),
      'pdv',
      p_sale_id
    );
  end if;

  if v_existing.seller_id = p_payload->>'sellerId' then
    update public.sellers
    set total_sales = greatest(0, coalesce(total_sales, 0) + v_new_gross_total - v_old_gross_total),
        updated_at = now()
    where id = p_payload->>'sellerId';
  else
    update public.sellers
    set total_sales = greatest(0, coalesce(total_sales, 0) - v_old_gross_total),
        updated_at = now()
    where id = v_existing.seller_id;

    update public.sellers
    set total_sales = coalesce(total_sales, 0) + v_new_gross_total,
        updated_at = now()
    where id = p_payload->>'sellerId';
  end if;

  if v_existing.customer_id = p_payload->>'customerId' then
    update public.customers
    set total_spent = greatest(0, coalesce(total_spent, 0) + v_new_gross_total - v_old_gross_total),
        updated_at = now()
    where id = p_payload->>'customerId';
  else
    update public.customers
    set purchases = greatest(0, coalesce(purchases, 0) - 1),
        total_spent = greatest(0, coalesce(total_spent, 0) - v_old_gross_total),
        updated_at = now()
    where id = v_existing.customer_id;

    update public.customers
    set purchases = coalesce(purchases, 0) + 1,
        total_spent = coalesce(total_spent, 0) + v_new_gross_total,
        updated_at = now()
    where id = p_payload->>'customerId';
  end if;
end;
$$;

revoke all on function public.reserve_stock_item(text, jsonb) from public;
revoke all on function public.reserve_stock_item(text, jsonb) from anon;
grant execute on function public.reserve_stock_item(text, jsonb) to authenticated;

revoke all on function public.release_stock_reservation(text, boolean) from public;
revoke all on function public.release_stock_reservation(text, boolean) from anon;
grant execute on function public.release_stock_reservation(text, boolean) to authenticated;

revoke all on function public.pdv_apply_reservation_deposit_payments(text, timestamptz) from public;
revoke all on function public.pdv_apply_reservation_deposit_payments(text, timestamptz) from anon;

notify pgrst, 'reload schema';

commit;
