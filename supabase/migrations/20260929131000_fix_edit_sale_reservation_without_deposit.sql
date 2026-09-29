begin;

-- ============================================================
-- Fix: edição de venda com aparelho reservado sem sinal
--
-- Quando uma venda de um aparelho que teve reserva SEM sinal
-- (coalesce(deposit_amount, 0) = 0) é editada, pdv_rebuild_sale_full_payload
-- verificava se existia pagamento "reservation_deposit".
-- Como reservas sem sinal não têm pagamento de sinal, a função
-- bloqueava a edição indevidamente com a exceção:
-- 'Este aparelho foi vendido usando o sinal de uma reserva. Mantenha o pagamento do sinal ("Sinal já pago") na edição da venda.'
--
-- Correção: só exigir a manutenção do pagamento do sinal se a reserva
-- efetivamente possuía um sinal pago (coalesce(sr.deposit_amount, 0) > 0).
-- Se a reserva não tinha sinal, ela continua associada à venda ('sold')
-- sem bloquear a edição de outros campos (como mudar a conta de pagamento
-- de Conta Bancária para Cofre).
-- Se o aparelho foi removido da venda na edição, a reserva retorna a
-- 'active' normalmente (com ou sem sinal).
-- ============================================================

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
  v_reservation public.stock_reservations%rowtype;
begin
  perform public.pdv_assert_sale_payload(p_payload);

  select * into v_existing from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda nao encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  -- Guarda: a reconstrução apaga e recria dívidas e transações da venda.
  -- Se já houve pagamentos recebidos (quitações no Cofre/Conta), eles
  -- seriam apagados do extrato silenciosamente — o saldo cairia sem
  -- nenhum registro. Exigir o estorno explícito antes da edição.
  if exists (
    select 1
    from public.debt_payments dp
    join public.debts d on d.id = dp.debt_id
    where d.sale_id = p_sale_id
  ) then
    raise exception 'Esta venda possui pagamentos de dívida já recebidos. Estorne os pagamentos no Financeiro (extrato) antes de editar a venda.';
  end if;

  if exists (
    select 1
    from public.payable_debt_payments pdp
    join public.payable_debts pd on pd.id = pdp.payable_debt_id
    where pd.sale_id = p_sale_id
  ) then
    raise exception 'Esta venda possui pagamentos de dívida ativa já realizados. Estorne-os antes de editar a venda.';
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

  -- Reservas consumidas por esta venda cujo pagamento de sinal saiu do
  -- payload: se o aparelho saiu da venda, a reserva volta a 'active'
  -- (o sinal permanece no caixa, como antes da venda); se o aparelho
  -- continua na venda sem o pagamento do sinal, a edição duplicaria o
  -- valor do sinal no caixa — bloquear.
  -- Exceção: reservas sem sinal (deposit_amount = 0) não movimentaram caixa,
  -- logo nada deve ser exigido nem duplicado se o aparelho continuar na venda.
  for v_reservation in
    select sr.*
    from public.stock_reservations sr
    where sr.sold_sale_id = p_sale_id
      and sr.status = 'sold'
      and not exists (
        select 1
        from public.payment_methods pm
        where pm.sale_id = p_sale_id
          and pm.source = 'reservation_deposit'
          and pm.reservation_id = sr.id
      )
  loop
    if exists (
      select 1
      from public.sale_items si
      where si.sale_id = p_sale_id
        and si.stock_item_id = v_reservation.stock_item_id
    ) then
      if coalesce(v_reservation.deposit_amount, 0) > 0 then
        raise exception 'Este aparelho foi vendido usando o sinal de uma reserva. Mantenha o pagamento do sinal ("Sinal já pago") na edição da venda.';
      end if;
      continue;
    end if;

    update public.stock_reservations
       set status = 'active',
           sold_at = null,
           sold_sale_id = null,
           released_at = null
     where id = v_reservation.id;

    update public.stock_items
       set status = 'Reservado',
           updated_at = now()
     where id = v_reservation.stock_item_id;
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

revoke all on function public.pdv_rebuild_sale_full_payload(text, jsonb) from public, anon;
grant execute on function public.pdv_rebuild_sale_full_payload(text, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
