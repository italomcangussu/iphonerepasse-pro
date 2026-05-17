begin;

create or replace function public.pdv_hydrate_sale_json(p_sale_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(s)
    || jsonb_build_object(
      'sale_items', coalesce((
        select jsonb_agg(to_jsonb(si) || jsonb_build_object('stock_item', to_jsonb(st)))
        from public.sale_items si
        left join public.stock_items st on st.id = si.stock_item_id
        where si.sale_id = s.id
      ), '[]'::jsonb),
      'payment_methods', coalesce((
        select jsonb_agg(to_jsonb(pm))
        from public.payment_methods pm
        where pm.sale_id = s.id
      ), '[]'::jsonb),
      'sale_trade_in_items', coalesce((
        select jsonb_agg(to_jsonb(sti))
        from public.sale_trade_in_items sti
        where sti.sale_id = s.id
      ), '[]'::jsonb)
    )
  from public.sales s
  where s.id = p_sale_id;
$$;

create or replace function public.pdv_assert_sale_payload(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric := coalesce((p_payload->>'total')::numeric, 0);
  v_payment_total numeric := 0;
begin
  if coalesce(p_payload->>'id', '') = '' then
    raise exception 'ID da venda é obrigatório.' using errcode = '22023';
  end if;

  if coalesce(p_payload->>'customerId', '') = '' then
    raise exception 'Cliente é obrigatório.' using errcode = '22023';
  end if;

  if coalesce(p_payload->>'sellerId', '') = '' then
    raise exception 'Vendedor é obrigatório.' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_payload->'items', '[]'::jsonb)) = 0 then
    raise exception 'A venda precisa ter ao menos um item.' using errcode = '22023';
  end if;

  select coalesce(sum(coalesce((payment->>'amount')::numeric, 0)), 0)
  into v_payment_total
  from jsonb_array_elements(coalesce(p_payload->'paymentMethods', '[]'::jsonb)) payment;

  if abs(v_payment_total - v_total) > 0.01 then
    raise exception 'A soma dos pagamentos deve ser igual ao total da venda.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.pdv_create_sale_trade_in_rows(p_sale_id text, p_payload jsonb, p_sale_date timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_snapshot jsonb;
  v_stock_item_id text;
  v_first_stock_item_id text;
begin
  for v_row in select * from jsonb_array_elements(coalesce(p_payload->'tradeIns', '[]'::jsonb)) loop
    v_snapshot := coalesce(v_row->'stockSnapshot', '{}'::jsonb);
    v_stock_item_id := nullif(v_row->>'stockItemId', '');

    if v_snapshot <> '{}'::jsonb then
      v_stock_item_id := coalesce(v_stock_item_id, nullif(v_snapshot->>'id', ''), 'stk_' || replace(gen_random_uuid()::text, '-', ''));

      insert into public.stock_items (
        id, type, model, color, has_box, capacity, imei, condition, status,
        sim_type, battery_health, store_id, purchase_price, sell_price,
        max_discount, warranty_type, warranty_end, origin, notes,
        observations, entry_date, photos
      ) values (
        v_stock_item_id,
        coalesce(nullif(v_snapshot->>'type', ''), 'iPhone'),
        coalesce(nullif(v_snapshot->>'model', ''), nullif(v_row->>'model', ''), 'Trade-in'),
        coalesce(nullif(v_snapshot->>'color', ''), nullif(v_row->>'color', ''), ''),
        coalesce((v_snapshot->>'hasBox')::boolean, false),
        coalesce(nullif(v_snapshot->>'capacity', ''), nullif(v_row->>'capacity', ''), ''),
        coalesce(nullif(v_snapshot->>'imei', ''), nullif(v_row->>'imei', ''), ''),
        coalesce(nullif(v_snapshot->>'condition', ''), nullif(v_row->>'condition', ''), 'Seminovo'),
        coalesce(nullif(v_snapshot->>'status', ''), 'Em Preparação'),
        coalesce(nullif(v_snapshot->>'simType', ''), 'Physical'),
        nullif(v_snapshot->>'batteryHealth', '')::numeric,
        nullif(coalesce(v_snapshot->>'storeId', p_payload->>'storeId'), ''),
        coalesce(nullif(v_snapshot->>'purchasePrice', '')::numeric, coalesce((v_row->>'receivedValue')::numeric, 0)),
        coalesce(nullif(v_snapshot->>'sellPrice', '')::numeric, 0),
        coalesce(nullif(v_snapshot->>'maxDiscount', '')::numeric, 0),
        coalesce(nullif(v_snapshot->>'warrantyType', ''), 'Loja'),
        nullif(v_snapshot->>'warrantyEnd', '')::timestamptz,
        coalesce(nullif(v_snapshot->>'origin', ''), 'Trade-in PDV'),
        coalesce(nullif(v_snapshot->>'notes', ''), nullif(v_snapshot->>'observations', ''), ''),
        coalesce(nullif(v_snapshot->>'observations', ''), nullif(v_snapshot->>'notes', ''), ''),
        coalesce(nullif(v_snapshot->>'entryDate', '')::timestamptz, p_sale_date),
        coalesce(
          array(select jsonb_array_elements_text(coalesce(v_snapshot->'photos', '[]'::jsonb))),
          array[]::text[]
        )
      )
      on conflict (id) do update
      set type = excluded.type,
          model = excluded.model,
          color = excluded.color,
          has_box = excluded.has_box,
          capacity = excluded.capacity,
          imei = excluded.imei,
          condition = excluded.condition,
          status = excluded.status,
          sim_type = excluded.sim_type,
          battery_health = excluded.battery_health,
          store_id = excluded.store_id,
          purchase_price = excluded.purchase_price,
          sell_price = excluded.sell_price,
          max_discount = excluded.max_discount,
          warranty_type = excluded.warranty_type,
          warranty_end = excluded.warranty_end,
          origin = excluded.origin,
          notes = excluded.notes,
          observations = excluded.observations,
          entry_date = excluded.entry_date,
          photos = excluded.photos,
          updated_at = now();
    end if;

    if v_first_stock_item_id is null then
      v_first_stock_item_id := v_stock_item_id;
    end if;

    insert into public.sale_trade_in_items (
      id, sale_id, stock_item_id, model, capacity, color, imei, condition, received_value
    ) values (
      coalesce(nullif(v_row->>'id', ''), 'sti_' || replace(gen_random_uuid()::text, '-', '')),
      p_sale_id,
      v_stock_item_id,
      coalesce(nullif(v_row->>'model', ''), nullif(v_snapshot->>'model', ''), 'Trade-in'),
      nullif(coalesce(v_row->>'capacity', v_snapshot->>'capacity'), ''),
      nullif(coalesce(v_row->>'color', v_snapshot->>'color'), ''),
      nullif(coalesce(v_row->>'imei', v_snapshot->>'imei'), ''),
      nullif(coalesce(v_row->>'condition', v_snapshot->>'condition'), ''),
      coalesce((v_row->>'receivedValue')::numeric, 0)
    );
  end loop;

  if v_first_stock_item_id is not null then
    update public.sales
    set trade_in_id = v_first_stock_item_id
    where id = p_sale_id;
  end if;
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
begin
  select * into v_sale from public.sales where id = p_sale_id;
  if not found then
    raise exception 'Venda não encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  if coalesce(v_sale.trade_in_value, 0) > 0 then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values
      ('trx_' || replace(gen_random_uuid()::text, '-', ''), 'IN', 'Venda', v_sale.trade_in_value, coalesce(v_sale.date, now()), 'Venda (Trade-in) - ' || v_sale.id, 'Conta Bancária', v_sale.id),
      ('trx_' || replace(gen_random_uuid()::text, '-', ''), 'OUT', 'Compra', v_sale.trade_in_value, coalesce(v_sale.date, now()), 'Entrada (Troca) - ' || v_sale.id, 'Conta Bancária', v_sale.id);
  end if;

  for v_payment in select * from public.payment_methods where sale_id = p_sale_id loop
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
            then 'Venda (' || coalesce(v_payment.type, '') || ') liquido=' || coalesce(v_payment.amount, 0)::text || ' bruto=' || coalesce(v_payment.customer_amount, v_payment.amount, 0)::text || ' taxa=' || coalesce(v_payment.fee_amount, 0)::text || ' - ' || p_sale_id
          else 'Venda (' || coalesce(v_payment.type, '') || ') - ' || p_sale_id
        end,
        v_account,
        p_sale_id
      );
    end if;
  end loop;
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
    discount_percent, original_subtotal, negotiated_subtotal, date,
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
      customer_amount, fee_rate, fee_amount, debt_due_date, debt_installments, debt_notes
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
      nullif(v_row->>'debtNotes', '')
    );
  end loop;

  perform public.pdv_create_sale_trade_in_rows(v_sale_id, p_payload, v_sale_date);
  perform public.pdv_create_sale_financial_side_effects(v_sale_id);

  if v_client_payment_amount > 0 and v_client_payment_mode = 'immediate' then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Pagamento de trade-in ao cliente',
      v_client_payment_amount,
      v_sale_date,
      'Diferença trade-in - Venda #' || upper(right(v_sale_id, 6)),
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
        'Criado automaticamente por diferença de trade-in no PDV'
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
    raise exception 'Venda não encontrada: %', p_sale_id using errcode = 'P0002';
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
      customer_amount, fee_rate, fee_amount, debt_due_date, debt_installments, debt_notes
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
      nullif(v_row->>'debtNotes', '')
    );
  end loop;

  perform public.pdv_create_sale_trade_in_rows(p_sale_id, p_payload, v_sale_date);
  perform public.pdv_create_sale_financial_side_effects(p_sale_id);

  if v_client_payment_amount > 0 and v_client_payment_mode = 'immediate' then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Pagamento de trade-in ao cliente',
      v_client_payment_amount,
      v_sale_date,
      'Diferença trade-in - Venda #' || upper(right(p_sale_id, 6)),
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
        'Criado automaticamente por diferença de trade-in no PDV'
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

create or replace function public.create_sale_full(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id text := p_payload->>'id';
  v_existing public.sales%rowtype;
  v_result jsonb;
begin
  if public.current_role() not in ('admin', 'seller') then
    raise exception 'Usuário sem permissão para criar venda.' using errcode = '42501';
  end if;

  if coalesce(v_sale_id, '') = '' then
    raise exception 'ID da venda é obrigatório.' using errcode = '22023';
  end if;

  select * into v_existing from public.sales where id = v_sale_id for update;

  if found then
    delete from public.debt_payments where debt_id in (select id from public.debts where sale_id = v_sale_id);
    delete from public.debts where sale_id = v_sale_id;
    delete from public.payable_debt_payments where payable_debt_id in (select id from public.payable_debts where sale_id = v_sale_id);
    delete from public.payable_debts where sale_id = v_sale_id;
    delete from public.transactions where sale_id = v_sale_id;
    delete from public.sale_trade_in_items where sale_id = v_sale_id;
    delete from public.payment_methods where sale_id = v_sale_id;
    delete from public.sale_items where sale_id = v_sale_id;
    delete from public.sales where id = v_sale_id;
  end if;

  perform public.pdv_insert_sale_full_payload(p_payload);
  v_result := public.pdv_hydrate_sale_json(v_sale_id);

  return v_result;
end;
$$;

create or replace function public.update_sale_full(p_sale_id text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.sales%rowtype;
  v_result jsonb;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem editar vendas.' using errcode = '42501';
  end if;

  select * into v_existing from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda não encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  perform public.pdv_rebuild_sale_full_payload(p_sale_id, p_payload);
  v_result := public.pdv_hydrate_sale_json(p_sale_id);

  return v_result;
end;
$$;

drop trigger if exists trg_sales_after_insert on public.sales;
drop trigger if exists trg_payment_methods_after_insert on public.payment_methods;

revoke all on function public.create_sale_full(jsonb) from public;
revoke all on function public.create_sale_full(jsonb) from anon;
grant execute on function public.create_sale_full(jsonb) to authenticated;

revoke all on function public.update_sale_full(text, jsonb) from public;
revoke all on function public.update_sale_full(text, jsonb) from anon;
grant execute on function public.update_sale_full(text, jsonb) to authenticated;

commit;
