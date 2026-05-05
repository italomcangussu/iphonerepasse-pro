begin;

alter table public.card_fee_settings
  add column if not exists debit_rate numeric not null default 1.87;

alter table public.card_fee_settings
  drop constraint if exists card_fee_settings_debit_rate_check;

alter table public.card_fee_settings
  add constraint card_fee_settings_debit_rate_check
  check (debit_rate >= 0 and debit_rate < 100);

update public.card_fee_settings
set debit_rate = 1.87
where debit_rate is null;

alter table public.payment_methods
  drop constraint if exists payment_methods_type_check;

alter table public.payment_methods
  add constraint payment_methods_type_check
  check (type in ('Pix', 'Dinheiro', 'Cartão', 'Cartão Débito', 'Devedor'));

alter table public.debt_payments
  drop constraint if exists debt_payments_payment_method_check;

alter table public.debt_payments
  add constraint debt_payments_payment_method_check
  check (payment_method in ('Pix', 'Dinheiro', 'Cartão', 'Cartão Débito'));

alter table public.payable_debt_payments
  drop constraint if exists payable_debt_payments_payment_method_check;

alter table public.payable_debt_payments
  add constraint payable_debt_payments_payment_method_check
  check (payment_method in ('Pix', 'Dinheiro', 'Cartão', 'Cartão Débito'));

create or replace function public.handle_payment_method_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_description text;
  v_account text;
begin
  if new.sale_id is null then
    return new;
  end if;

  select *
  into v_sale
  from public.sales
  where id = new.sale_id;

  if not found then
    return new;
  end if;

  v_account := coalesce(nullif(new.account, 'Caixa'), 'Conta Bancária');

  if new.type = 'Devedor' then
    insert into public.debts (
      id,
      customer_id,
      sale_id,
      original_amount,
      remaining_amount,
      status,
      due_date,
      first_due_date,
      installments_total,
      notes,
      source
    )
    values (
      'debt_' || replace(gen_random_uuid()::text, '-', ''),
      v_sale.customer_id,
      new.sale_id,
      coalesce(new.amount, 0),
      coalesce(new.amount, 0),
      'Aberta',
      new.debt_due_date,
      new.debt_due_date,
      greatest(1, coalesce(new.debt_installments, 1)),
      new.debt_notes,
      'pdv'
    );
  else
    if new.type in ('Cartão', 'Cartão Débito') then
      v_description := 'Venda (' || coalesce(new.type, '') || ') liquido='
        || coalesce(new.amount, 0)::text
        || ' bruto=' || coalesce(new.customer_amount, new.amount, 0)::text
        || ' taxa=' || coalesce(new.fee_amount, 0)::text
        || ' - ' || coalesce(new.sale_id, '');
    else
      v_description := 'Venda (' || coalesce(new.type, '') || ') - ' || coalesce(new.sale_id, '');
    end if;

    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'IN',
      'Venda',
      coalesce(new.amount, 0),
      coalesce(v_sale.date, now()),
      v_description,
      v_account,
      new.sale_id
    );
  end if;

  return new;
end;
$$;

commit;
