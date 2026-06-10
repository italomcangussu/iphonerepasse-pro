begin;

-- Substitui o id cru da venda/dívida (SALE-..., DEBT-...) pelo nome do cliente nas
-- descrições das transações geradas automaticamente, alinhando-se ao tratamento já
-- aplicado à comissão (nome do vendedor). Mantém o rótulo do tipo e os detalhes
-- técnicos do cartão (liquido/bruto/taxa).

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
    raise exception 'Venda não encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  select name into v_customer_name from public.customers where id = v_sale.customer_id;

  if coalesce(v_sale.trade_in_value, 0) > 0 then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values
      ('trx_' || replace(gen_random_uuid()::text, '-', ''), 'IN', 'Venda', v_sale.trade_in_value, coalesce(v_sale.date, now()), 'Venda (Trade-in) - ' || coalesce(nullif(v_customer_name, ''), v_sale.id), 'Conta Bancária', v_sale.id),
      ('trx_' || replace(gen_random_uuid()::text, '-', ''), 'OUT', 'Compra', v_sale.trade_in_value, coalesce(v_sale.date, now()), 'Entrada (Troca) - ' || coalesce(nullif(v_customer_name, ''), v_sale.id), 'Conta Bancária', v_sale.id);
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

create or replace function public.handle_debt_payment_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt public.debts%rowtype;
  v_new_remaining numeric;
  v_new_status text;
  v_account text;
  v_customer_name text;
begin
  select *
  into v_debt
  from public.debts
  where id = new.debt_id
  for update;

  if not found then
    raise exception 'Debt not found for payment: %', new.debt_id;
  end if;

  if new.amount > coalesce(v_debt.remaining_amount, 0) then
    raise exception 'Payment amount (%) exceeds remaining debt amount (%)', new.amount, v_debt.remaining_amount;
  end if;

  v_new_remaining := coalesce(v_debt.remaining_amount, 0) - coalesce(new.amount, 0);
  if v_new_remaining = 0 then
    v_new_status := 'Quitada';
  else
    v_new_status := 'Parcial';
  end if;

  update public.debts
  set remaining_amount = v_new_remaining,
      status = v_new_status,
      updated_at = now()
  where id = v_debt.id;

  v_account := coalesce(nullif(new.account, 'Caixa'), 'Conta Bancária');

  select name into v_customer_name from public.customers where id = v_debt.customer_id;

  insert into public.transactions (
    id,
    type,
    category,
    amount,
    date,
    description,
    account,
    sale_id,
    debt_payment_id
  )
  values (
    'trx_' || replace(gen_random_uuid()::text, '-', ''),
    'IN',
    'Venda',
    coalesce(new.amount, 0),
    coalesce(new.paid_at, now()),
    'Quitação de dívida - ' || coalesce(nullif(v_customer_name, ''), coalesce(v_debt.id, '')),
    v_account,
    v_debt.sale_id,
    new.id
  );

  return new;
end;
$$;

commit;
