begin;

create or replace function public.handle_sale_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade_in_value numeric := coalesce(new.trade_in_value, 0);
  v_gross_total numeric := coalesce(new.total, 0) + v_trade_in_value;
begin
  if v_trade_in_value > 0 then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'IN',
      'Venda',
      v_trade_in_value,
      coalesce(new.date, now()),
      'Venda (Trade-in) - ' || coalesce(new.id, ''),
      'Conta Bancária',
      new.id
    );

    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Compra',
      v_trade_in_value,
      coalesce(new.date, now()),
      'Entrada (Troca) - ' || coalesce(new.id, ''),
      'Conta Bancária',
      new.id
    );
  end if;

  if new.seller_id is not null then
    update public.sellers
    set total_sales = coalesce(total_sales, 0) + v_gross_total,
        updated_at = now()
    where id = new.seller_id;
  end if;

  if new.customer_id is not null then
    update public.customers
    set purchases = coalesce(purchases, 0) + 1,
        total_spent = coalesce(total_spent, 0) + v_gross_total,
        updated_at = now()
    where id = new.customer_id;
  end if;

  return new;
end;
$$;

insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
select
  'trx_' || replace(gen_random_uuid()::text, '-', ''),
  'IN',
  'Venda',
  coalesce(s.trade_in_value, 0),
  coalesce(s.date, now()),
  'Venda (Trade-in) - ' || coalesce(s.id, ''),
  'Conta Bancária',
  s.id
from public.sales s
where coalesce(s.trade_in_value, 0) > 0
  and not exists (
    select 1
    from public.transactions t
    where t.sale_id = s.id
      and t.type = 'IN'
      and t.category = 'Venda'
      and t.description = 'Venda (Trade-in) - ' || coalesce(s.id, '')
  );

insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
select
  'trx_' || replace(gen_random_uuid()::text, '-', ''),
  'OUT',
  'Compra',
  coalesce(s.trade_in_value, 0),
  coalesce(s.date, now()),
  'Entrada (Troca) - ' || coalesce(s.id, ''),
  'Conta Bancária',
  s.id
from public.sales s
where coalesce(s.trade_in_value, 0) > 0
  and not exists (
    select 1
    from public.transactions t
    where t.sale_id = s.id
      and t.type = 'OUT'
      and t.category = 'Compra'
      and t.description = 'Entrada (Troca) - ' || coalesce(s.id, '')
  );

commit;
