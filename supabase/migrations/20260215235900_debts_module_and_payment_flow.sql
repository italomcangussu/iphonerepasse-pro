begin;

create table if not exists public.debts (
  id text primary key,
  customer_id text not null references public.customers(id) on delete restrict,
  sale_id text null references public.sales(id) on delete set null,
  original_amount numeric not null check (original_amount > 0),
  remaining_amount numeric not null check (remaining_amount >= 0),
  status text not null default 'Aberta' check (status in ('Aberta', 'Parcial', 'Quitada')),
  due_date date null,
  notes text null,
  source text not null default 'manual' check (source in ('manual', 'pdv', 'import_anexo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_debts_customer_id on public.debts (customer_id);
create index if not exists idx_debts_status on public.debts (status);
create index if not exists idx_debts_due_date on public.debts (due_date);

create table if not exists public.debt_payments (
  id text primary key,
  debt_id text not null references public.debts(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_method text not null check (payment_method in ('Pix', 'Dinheiro', 'Cartão')),
  account text not null check (account in ('Caixa', 'Cofre')),
  paid_at timestamptz not null default now(),
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_debt_payments_debt_id on public.debt_payments (debt_id);
create index if not exists idx_debt_payments_paid_at on public.debt_payments (paid_at);

alter table public.payment_methods
  add column if not exists debt_due_date date null,
  add column if not exists debt_notes text null;

update public.payment_methods
set type = 'Cartão'
where type in ('Cartão Crédito', 'Cartão Débito');

do $$
declare
  rec record;
begin
  for rec in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'payment_methods'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%type%'
  loop
    execute format('alter table public.payment_methods drop constraint %I', rec.conname);
  end loop;
end $$;

alter table public.payment_methods
  add constraint payment_methods_type_check
  check (type in ('Pix', 'Dinheiro', 'Cartão', 'Devedor'));

create or replace function public.handle_sale_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.trade_in_value, 0) > 0 then
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'OUT',
      'Compra',
      coalesce(new.trade_in_value, 0),
      coalesce(new.date, now()),
      'Entrada (Troca) - ' || coalesce(new.id, ''),
      'Caixa',
      new.id
    );
  end if;

  if new.seller_id is not null then
    update public.sellers
    set total_sales = coalesce(total_sales, 0) + coalesce(new.total, 0),
        updated_at = now()
    where id = new.seller_id;
  end if;

  if new.customer_id is not null then
    update public.customers
    set purchases = coalesce(purchases, 0) + 1,
        total_spent = coalesce(total_spent, 0) + coalesce(new.total, 0),
        updated_at = now()
    where id = new.customer_id;
  end if;

  return new;
end;
$$;

create or replace function public.handle_payment_method_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
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

  if new.type = 'Devedor' then
    insert into public.debts (
      id,
      customer_id,
      sale_id,
      original_amount,
      remaining_amount,
      status,
      due_date,
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
      new.debt_notes,
      'pdv'
    );
  else
    insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
    values (
      'trx_' || replace(gen_random_uuid()::text, '-', ''),
      'IN',
      'Venda',
      coalesce(new.amount, 0),
      coalesce(v_sale.date, now()),
      'Venda (' || coalesce(new.type, '') || ') - ' || coalesce(new.sale_id, ''),
      'Caixa',
      new.sale_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payment_methods_after_insert on public.payment_methods;
create trigger trg_payment_methods_after_insert
after insert on public.payment_methods
for each row
execute function public.handle_payment_method_after_insert();

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

  insert into public.transactions (id, type, category, amount, date, description, account, sale_id)
  values (
    'trx_' || replace(gen_random_uuid()::text, '-', ''),
    'IN',
    'Venda',
    coalesce(new.amount, 0),
    coalesce(new.paid_at, now()),
    'Quitação de dívida - ' || coalesce(v_debt.id, ''),
    new.account,
    v_debt.sale_id
  );

  return new;
end;
$$;

drop trigger if exists trg_debt_payments_after_insert on public.debt_payments;
create trigger trg_debt_payments_after_insert
after insert on public.debt_payments
for each row
execute function public.handle_debt_payment_after_insert();

alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;

drop policy if exists debts_admin_all on public.debts;
create policy debts_admin_all on public.debts
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists debt_payments_admin_all on public.debt_payments;
create policy debt_payments_admin_all on public.debt_payments
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

do $$
declare
  rec record;
  v_customer_id text;
  v_normalized_name text;
begin
  for rec in
    select *
    from (
      values
        ('FELIPE VIEIRA', 1350.00::numeric, 'RECEBER'),
        ('SAMUEL', 1000.00::numeric, 'PAGAMENTO SEMANAL'),
        ('NIVALDO JR', 1180.00::numeric, 'MENSAL'),
        ('EDSON', 220.00::numeric, 'DEVE 2,5K DO IPAD R$400,00 MENSAL DIA 15'),
        ('RENATA', 780.00::numeric, 'DEVE 10x130,00 1ª em 07/11 a 10ª em 07/08'),
        ('IGOR', 350.00::numeric, 'DEVE 350'),
        ('LEVY', 2000.00::numeric, 'DEVE 3K VENC 10/01 OK-10/02 OK-10/03-10/04-10/05-10/06'),
        ('VICTOR LAIO', 400.00::numeric, 'DEVE 600,00 DIA 05'),
        ('RAILY', 1000.00::numeric, 'DEVE 1000,00 10/FEVEREIRO'),
        ('ROSANE VANDAO', 950.00::numeric, '2350,00 10/01 e 2400,00 20/01'),
        ('ASTRILIO', 300.00::numeric, 'DEVE 21/01 OK E 21/02'),
        ('ROBERTO FORTES', 10000.00::numeric, null),
        ('ALEX', 4480.00::numeric, 'DEVE 8X560,00 DIA 30'),
        ('NATERCIA', 2000.00::numeric, 'DEVE'),
        ('LINO', 1500.00::numeric, 'DEVE'),
        ('TCHENZO', 3000.00::numeric, 'DEVE 6X500,00'),
        ('GABRIEL UNINTA', 1750.00::numeric, 'DEVE'),
        ('MATHEUS', 2000.00::numeric, 'DEVE 2000')
    ) as t(customer_name, amount, notes)
  loop
    v_normalized_name := upper(regexp_replace(trim(rec.customer_name), '\s+', ' ', 'g'));

    select c.id
    into v_customer_id
    from public.customers c
    where upper(regexp_replace(trim(c.name), '\s+', ' ', 'g')) = v_normalized_name
    limit 1;

    if v_customer_id is null then
      v_customer_id := 'cust_' || replace(gen_random_uuid()::text, '-', '');
      insert into public.customers (id, name, cpf, phone, email, birth_date, purchases, total_spent)
      values (v_customer_id, rec.customer_name, null, '', '', null, 0, 0);
    end if;

    if not exists (
      select 1
      from public.debts d
      where d.customer_id = v_customer_id
        and d.source = 'import_anexo'
        and d.original_amount = rec.amount
        and coalesce(d.notes, '') = coalesce(rec.notes, '')
    ) then
      insert into public.debts (
        id,
        customer_id,
        sale_id,
        original_amount,
        remaining_amount,
        status,
        due_date,
        notes,
        source
      )
      values (
        'debt_imp_' || replace(gen_random_uuid()::text, '-', ''),
        v_customer_id,
        null,
        rec.amount,
        rec.amount,
        'Aberta',
        null,
        rec.notes,
        'import_anexo'
      );
    end if;
  end loop;
end $$;

commit;
