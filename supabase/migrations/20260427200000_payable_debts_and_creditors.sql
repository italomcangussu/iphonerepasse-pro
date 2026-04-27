begin;

-- ============================================================
-- 1. creditors table
-- ============================================================
create table if not exists public.creditors (
  id text primary key,
  name text not null,
  document text null,
  document_type text null check (document_type in ('CPF', 'CNPJ')),
  phone text null,
  email text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_creditors_name on public.creditors (name);

-- ============================================================
-- 2. payable_debts table
-- ============================================================
create table if not exists public.payable_debts (
  id text primary key,
  creditor_id text not null references public.creditors(id) on delete restrict,
  creditor_name text not null,
  creditor_document text null,
  creditor_phone text null,
  original_amount numeric not null check (original_amount > 0),
  remaining_amount numeric not null check (remaining_amount >= 0),
  status text not null default 'Aberta' check (status in ('Aberta', 'Parcial', 'Quitada')),
  due_date date null,
  first_due_date date null,
  installments_total integer not null default 1 check (installments_total >= 1),
  notes text null,
  source text not null default 'manual' check (source in ('manual', 'import_anexo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payable_debts_creditor_id on public.payable_debts (creditor_id);
create index if not exists idx_payable_debts_status on public.payable_debts (status);
create index if not exists idx_payable_debts_due_date on public.payable_debts (due_date);

-- ============================================================
-- 3. payable_debt_payments table
-- ============================================================
create table if not exists public.payable_debt_payments (
  id text primary key,
  payable_debt_id text not null references public.payable_debts(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_method text not null check (payment_method in ('Pix', 'Dinheiro', 'Cartão')),
  account text not null check (account in ('Conta Bancária', 'Cofre')),
  paid_at timestamptz not null default now(),
  notes text null,
  attachment_path text null,
  attachment_mime text null,
  attachment_name text null,
  attachment_size integer null,
  created_at timestamptz not null default now()
);

create index if not exists idx_payable_debt_payments_debt_id on public.payable_debt_payments (payable_debt_id);
create index if not exists idx_payable_debt_payments_paid_at on public.payable_debt_payments (paid_at);

-- ============================================================
-- 4. payable_debt_payment_id column on transactions
-- ============================================================
alter table public.transactions
  add column if not exists payable_debt_payment_id text null;

alter table public.transactions
  drop constraint if exists transactions_payable_debt_payment_fk;
alter table public.transactions
  add constraint transactions_payable_debt_payment_fk
  foreign key (payable_debt_payment_id)
  references public.payable_debt_payments(id)
  on delete cascade;

create index if not exists idx_transactions_payable_debt_payment_id
  on public.transactions (payable_debt_payment_id);

-- ============================================================
-- 5. updated_at triggers
-- ============================================================
create or replace function public.tg_set_creditors_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_creditors_updated_at on public.creditors;
create trigger set_creditors_updated_at
before update on public.creditors
for each row execute function public.tg_set_creditors_updated_at();

create or replace function public.tg_set_payable_debts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_payable_debts_updated_at on public.payable_debts;
create trigger set_payable_debts_updated_at
before update on public.payable_debts
for each row execute function public.tg_set_payable_debts_updated_at();

-- ============================================================
-- 6. Trigger: after payable_debt_payment insert → update debt status + create transaction OUT
-- ============================================================
create or replace function public.handle_payable_debt_payment_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt public.payable_debts%rowtype;
  v_new_remaining numeric;
  v_new_status text;
begin
  select *
  into v_debt
  from public.payable_debts
  where id = new.payable_debt_id
  for update;

  if not found then
    raise exception 'Payable debt not found for payment: %', new.payable_debt_id;
  end if;

  if new.amount > coalesce(v_debt.remaining_amount, 0) then
    raise exception 'Payment amount (%) exceeds remaining payable debt amount (%)', new.amount, v_debt.remaining_amount;
  end if;

  v_new_remaining := coalesce(v_debt.remaining_amount, 0) - coalesce(new.amount, 0);
  if v_new_remaining = 0 then
    v_new_status := 'Quitada';
  else
    v_new_status := 'Parcial';
  end if;

  update public.payable_debts
  set remaining_amount = v_new_remaining,
      status = v_new_status,
      updated_at = now()
  where id = v_debt.id;

  insert into public.transactions (
    id,
    type,
    category,
    amount,
    date,
    description,
    account,
    payable_debt_payment_id
  )
  values (
    'trx_' || replace(gen_random_uuid()::text, '-', ''),
    'OUT',
    'Pagamento de dívida ativa',
    coalesce(new.amount, 0),
    coalesce(new.paid_at, now()),
    'Pagamento dívida ativa - ' || coalesce(v_debt.creditor_name, v_debt.id),
    new.account,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists trg_payable_debt_payments_after_insert on public.payable_debt_payments;
create trigger trg_payable_debt_payments_after_insert
after insert on public.payable_debt_payments
for each row execute function public.handle_payable_debt_payment_after_insert();

-- ============================================================
-- 7. Trigger: after payable_debt_payment delete → restore debt status
-- ============================================================
create or replace function public.handle_payable_debt_payment_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt public.payable_debts%rowtype;
  v_restored_remaining numeric;
  v_new_status text;
begin
  select *
  into v_debt
  from public.payable_debts
  where id = old.payable_debt_id
  for update;

  if not found then
    return old;
  end if;

  v_restored_remaining := coalesce(v_debt.remaining_amount, 0) + coalesce(old.amount, 0);
  if v_restored_remaining > coalesce(v_debt.original_amount, 0) then
    v_restored_remaining := coalesce(v_debt.original_amount, 0);
  end if;

  if v_restored_remaining <= 0 then
    v_new_status := 'Quitada';
  elsif v_restored_remaining >= coalesce(v_debt.original_amount, 0) then
    v_new_status := 'Aberta';
  else
    v_new_status := 'Parcial';
  end if;

  update public.payable_debts
  set remaining_amount = v_restored_remaining,
      status = v_new_status,
      updated_at = now()
  where id = v_debt.id;

  return old;
end;
$$;

drop trigger if exists trg_payable_debt_payments_after_delete on public.payable_debt_payments;
create trigger trg_payable_debt_payments_after_delete
after delete on public.payable_debt_payments
for each row execute function public.handle_payable_debt_payment_after_delete();

-- ============================================================
-- 8. Extend handle_transaction_after_delete to cascade to payable_debt_payments
-- ============================================================
create or replace function public.handle_transaction_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.debt_payment_id is not null then
    delete from public.debt_payments where id = old.debt_payment_id;
  end if;
  if old.payable_debt_payment_id is not null then
    delete from public.payable_debt_payments where id = old.payable_debt_payment_id;
  end if;
  return old;
end;
$$;

-- ============================================================
-- 9. RLS
-- ============================================================
alter table public.creditors enable row level security;
alter table public.payable_debts enable row level security;
alter table public.payable_debt_payments enable row level security;

drop policy if exists creditors_admin_all on public.creditors;
create policy creditors_admin_all on public.creditors
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists payable_debts_admin_all on public.payable_debts;
create policy payable_debts_admin_all on public.payable_debts
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists payable_debt_payments_admin_all on public.payable_debt_payments;
create policy payable_debt_payments_admin_all on public.payable_debt_payments
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ============================================================
-- 10. Storage bucket for payment receipts (private)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payable-debt-receipts',
  'payable-debt-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Auth Upload PayableDebtReceipts" on storage.objects;
create policy "Auth Upload PayableDebtReceipts"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'payable-debt-receipts' and public.current_role() = 'admin');

drop policy if exists "Auth Read PayableDebtReceipts" on storage.objects;
create policy "Auth Read PayableDebtReceipts"
on storage.objects
for select
to authenticated
using (bucket_id = 'payable-debt-receipts' and public.current_role() = 'admin');

drop policy if exists "Auth Delete PayableDebtReceipts" on storage.objects;
create policy "Auth Delete PayableDebtReceipts"
on storage.objects
for delete
to authenticated
using (bucket_id = 'payable-debt-receipts' and public.current_role() = 'admin');

-- ============================================================
-- 11. Seed finance category for payable debt payments
-- ============================================================
insert into public.finance_categories (id, name, type, is_default)
values ('cat_out_payable_debt', 'Pagamento de dívida ativa', 'OUT', false)
on conflict (id) do nothing;

commit;
