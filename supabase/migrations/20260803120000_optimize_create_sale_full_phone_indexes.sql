begin;

-- ============================================================
-- Otimização da RPC create_sale_full e busca de leads CRM
--
-- 1. Índice funcional na expressão crm_br_phone_match_key em crm_leads:
--    Transforma varreduras sequenciais (O(N) com regex PL/SQL) em
--    busca B-tree O(log N).
-- 2. pdv_insert_sale_full_payload passa crm_lead_id diretamente no INSERT:
--    Garante que o lead é associado na inserção inicial sem depender de UPDATE.
-- 3. create_sale_full e update_sale_full sem UPDATE redundante:
--    Evita o duplo disparo da esteira de gatilhos (trg_sales_set_crm_lead_id,
--    trg_crm_sales_purchase_sync, trg_sales_backfill_ads_origin_from_phone_match).
-- ============================================================

create index if not exists idx_crm_leads_br_phone_match_key
  on public.crm_leads (public.crm_br_phone_match_key(coalesce(phone_normalized, phone, id)));

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
    id, customer_id, seller_id, store_id, crm_lead_id, total, discount, discount_type,
    discount_percent, original_subtotal, negotiated_subtotal, commission, date,
    warranty_expires_at, trade_in_id, trade_in_value, client_payment_amount,
    client_payment_mode, client_payment_account, client_payment_method,
    client_payment_notes, client_payment_due_date
  ) values (
    v_sale_id,
    p_payload->>'customerId',
    p_payload->>'sellerId',
    nullif(p_payload->>'storeId', ''),
    nullif(p_payload->>'crmLeadId', ''),
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

revoke all on function public.pdv_insert_sale_full_payload(jsonb) from public, anon;
grant execute on function public.pdv_insert_sale_full_payload(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
