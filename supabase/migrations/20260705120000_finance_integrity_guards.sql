begin;

-- ============================================================
-- finance_integrity_guards: correções de consistência do caixa
-- (Cofre / Conta Bancária), a partir da auditoria de 2026-07-05.
--
-- 1. transfer_between_accounts: transferência atômica entre contas
--    (antes eram dois inserts separados no cliente — falha no segundo
--    deixava o dinheiro "sumir" da origem) + guarda de saldo.
-- 2. handle_sale_before_delete: cancelar venda que consumiu sinal de
--    reserva agora devolve a reserva para 'active' e o aparelho para
--    'Reservado' (antes a entrada do sinal ficava órfã e era contada
--    em dobro na revenda).
-- 3. release_stock_reservation: devolução de sinal exige que o
--    lançamento de entrada ainda exista (antes criava um OUT órfão
--    no Cofre/Conta — vetor de saldo negativo).
-- 4. cancel_transaction: bloqueia cancelar lançamentos gerados por
--    venda ou vinculados a reserva; reinstala o bloqueio de entrada
--    de dívida ativa perdido na reescrita de 20260522170000.
-- 5. pdv_rebuild_sale_full_payload: bloqueia edição de venda com
--    pagamentos de dívida já recebidos (a edição apagava as quitações
--    do extrato) e trata sinal de reserva removido do payload.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Transferência atômica entre contas
-- ------------------------------------------------------------
insert into public.finance_categories (id, name, type, is_default)
values
  ('cat_in_transfer', 'Transferência', 'IN', false),
  ('cat_out_transfer', 'Transferência', 'OUT', false)
on conflict (id) do nothing;

create or replace function public.transfer_between_accounts(
  p_from text,
  p_to text,
  p_amount numeric
)
returns setof public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group text := 'trf_' || replace(gen_random_uuid()::text, '-', '');
  v_date timestamptz := now();
  v_balance numeric;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem transferir entre contas.'
      using errcode = '42501';
  end if;

  if p_from not in ('Conta Bancária', 'Cofre') or p_to not in ('Conta Bancária', 'Cofre') then
    raise exception 'Conta inválida para transferência.';
  end if;

  if p_from = p_to then
    raise exception 'Selecione contas diferentes para transferir.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor de transferência inválido.';
  end if;

  select coalesce(sum(case when type = 'IN' then amount else -amount end), 0)
    into v_balance
    from public.transactions
    where account = p_from;

  if v_balance < p_amount - 0.001 then
    raise exception 'Saldo insuficiente em %: disponível R$ %.', p_from, to_char(v_balance, 'FM999G999G990D00');
  end if;

  return query
  insert into public.transactions (id, type, category, amount, date, description, account, transfer_group_id)
  values
    ('trx_' || replace(gen_random_uuid()::text, '-', ''), 'OUT', 'Transferência', p_amount, v_date, 'Transferência para ' || p_to, p_from, v_group),
    ('trx_' || replace(gen_random_uuid()::text, '-', ''), 'IN', 'Transferência', p_amount, v_date, 'Transferência de ' || p_from, p_to, v_group)
  returning *;
end;
$$;

revoke all on function public.transfer_between_accounts(text, text, numeric) from public;
revoke all on function public.transfer_between_accounts(text, text, numeric) from anon;
grant execute on function public.transfer_between_accounts(text, text, numeric) to authenticated;

-- ------------------------------------------------------------
-- 2. Cancelamento de venda reverte reservas consumidas
-- ------------------------------------------------------------
create or replace function public.handle_sale_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gross_total numeric := coalesce(old.total, 0) + coalesce(old.trade_in_value, 0);
begin
  -- 1. Delete debt_payments that belong to debts from this sale.
  delete from public.debt_payments
  where debt_id in (
    select id from public.debts where sale_id = old.id
  );

  -- 2. Delete customer debts created by this sale (Devedor payment methods).
  delete from public.debts where sale_id = old.id;

  -- 3. Delete payable debt payments for store debts created by this sale.
  delete from public.payable_debt_payments
  where payable_debt_id in (
    select id from public.payable_debts where sale_id = old.id
  );

  -- 4. Delete store payable debts created by trade-in client payment.
  delete from public.payable_debts where sale_id = old.id;

  -- 5. Reverte reservas consumidas por esta venda ANTES de apagar as
  --    transações: o lançamento do sinal (sale_id null) permanece no
  --    caixa e a reserva volta a valer, evitando contagem em dobro na
  --    revenda do aparelho.
  update public.stock_reservations
     set status = 'active',
         sold_at = null,
         sold_sale_id = null,
         released_at = null
   where sold_sale_id = old.id
     and status = 'sold';

  -- 6. Delete all direct transactions linked to this sale.
  delete from public.transactions where sale_id = old.id;

  -- 7. Restore sold stock items back to 'Disponível'.
  update public.stock_items
  set status = 'Disponível',
      updated_at = now()
  where id in (
    select stock_item_id from public.sale_items where sale_id = old.id
  );

  -- 7.b Aparelhos cuja reserva foi revertida voltam para 'Reservado'.
  update public.stock_items si
  set status = 'Reservado',
      updated_at = now()
  where si.id in (
    select sr.stock_item_id
    from public.stock_reservations sr
    where sr.status = 'active'
      and sr.stock_item_id in (
        select stock_item_id from public.sale_items where sale_id = old.id
      )
  );

  -- 8. Decrement seller.total_sales (floor at 0).
  if old.seller_id is not null then
    update public.sellers
    set total_sales = greatest(0, coalesce(total_sales, 0) - v_gross_total),
        updated_at = now()
    where id = old.seller_id;
  end if;

  -- 9. Decrement customer.purchases (-1) and customer.total_spent (floor at 0).
  if old.customer_id is not null then
    update public.customers
    set purchases   = greatest(0, coalesce(purchases, 0) - 1),
        total_spent = greatest(0, coalesce(total_spent, 0) - v_gross_total),
        updated_at  = now()
    where id = old.customer_id;
  end if;

  return old;
end;
$$;

-- ------------------------------------------------------------
-- 3. Devolução de sinal exige o lançamento de entrada vivo
-- ------------------------------------------------------------
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

    -- Sem o lançamento de entrada do sinal, criar a saída de estorno
    -- geraria um OUT órfão (dinheiro saindo sem nunca ter entrado no
    -- extrato) — principal vetor de saldo negativo no Cofre.
    if v_refund_account is null then
      raise exception 'O lançamento de entrada do sinal desta reserva não existe mais no financeiro. Libere sem devolver e registre a devolução manualmente.';
    end if;

    v_refund_transaction_id := 'trx_' || replace(gen_random_uuid()::text, '-', '');

    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      v_refund_transaction_id,
      'OUT',
      'Estorno de reserva',
      coalesce(v_reservation.deposit_amount, 0),
      now(),
      'Estorno de reserva - ' || v_reservation.customer_name,
      v_refund_account,
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

-- ------------------------------------------------------------
-- 4. cancel_transaction: bloqueios de integridade
-- ------------------------------------------------------------
create or replace function public.cancel_transaction(p_transaction_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trx public.transactions%rowtype;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem cancelar lançamentos.'
      using errcode = '42501';
  end if;

  select * into v_trx
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Lançamento não encontrado: %', p_transaction_id
      using errcode = 'P0002';
  end if;

  -- Entradas de dívida ativa: reverter excluindo a dívida (bloqueio
  -- reinstalado — existia em 20260429000000 e foi perdido na reescrita
  -- de 20260522170000).
  if v_trx.payable_debt_id is not null then
    raise exception 'Este lançamento é uma entrada de dívida ativa. Para revertê-lo, exclua a dívida correspondente na página Dívidas Ativas.'
      using errcode = '23503';
  end if;

  -- Lançamentos gerados por venda (Venda, Comissão, Trade-in, Diferença
  -- de trade-in) só podem ser revertidos cancelando/editando a venda.
  -- Exceções: quitações de dívida e pagamentos de dívida ativa, que têm
  -- fluxo próprio de estorno logo abaixo.
  if v_trx.sale_id is not null
     and v_trx.debt_payment_id is null
     and v_trx.payable_debt_payment_id is null then
    raise exception 'Este lançamento foi gerado por uma venda. Para revertê-lo, cancele ou edite a venda correspondente no Histórico do PDV.'
      using errcode = '23503';
  end if;

  -- Lançamentos de sinal/estorno vinculados a uma reserva: gerenciar
  -- pela reserva do aparelho (editar/liberar/vender). Cancelar o IN do
  -- sinal deixaria a reserva sem lastro e o estorno futuro criaria um
  -- OUT órfão (saldo negativo).
  if exists (
    select 1
    from public.stock_reservations sr
    where sr.deposit_transaction_id = p_transaction_id
       or sr.deposit_refund_transaction_id = p_transaction_id
  ) then
    raise exception 'Este lançamento pertence ao sinal de uma reserva. Gerencie o sinal pela reserva do aparelho no Estoque.'
      using errcode = '23503';
  end if;

  -- Se vinculado a um debt_payment, deletar o payment primeiro para que o
  -- trigger handle_debt_payment_after_delete restaure o saldo da dívida.
  if v_trx.debt_payment_id is not null then
    delete from public.debt_payments where id = v_trx.debt_payment_id;
  end if;

  -- Se vinculado a um payable_debt_payment, deletar o payment primeiro para
  -- que o trigger handle_payable_debt_payment_after_delete restaure o saldo.
  if v_trx.payable_debt_payment_id is not null then
    update public.transactions
      set payable_debt_payment_id = null
    where id = p_transaction_id;

    delete from public.payable_debt_payments where id = v_trx.payable_debt_payment_id;
  end if;

  -- Se for parte de uma transferência, estornar o(s) lançamento(s) pareado(s).
  if v_trx.transfer_group_id is not null then
    delete from public.transactions
    where transfer_group_id = v_trx.transfer_group_id
      and id <> p_transaction_id;
  end if;

  delete from public.transactions where id = p_transaction_id;
end;
$$;

grant execute on function public.cancel_transaction(text) to authenticated;

-- ------------------------------------------------------------
-- 5. pdv_rebuild_sale_full_payload: guardas de edição
-- ------------------------------------------------------------
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
      raise exception 'Este aparelho foi vendido usando o sinal de uma reserva. Mantenha o pagamento do sinal ("Sinal já pago") na edição da venda.';
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

notify pgrst, 'reload schema';

commit;
