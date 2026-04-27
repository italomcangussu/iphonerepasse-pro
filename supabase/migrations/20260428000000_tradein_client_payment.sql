-- ============================================================
-- Trade-in superior: campos para pagamento da loja ao cliente
-- ============================================================

-- 1. Adicionar campos de pagamento ao cliente na tabela sales
alter table public.sales
  add column if not exists client_payment_amount  numeric       null,
  add column if not exists client_payment_mode    text          null,
  add column if not exists client_payment_account text          null,
  add column if not exists client_payment_method  text          null,
  add column if not exists client_payment_notes   text          null,
  add column if not exists client_payment_due_date date         null;

alter table public.sales
  drop constraint if exists sales_client_payment_mode_check;
alter table public.sales
  add  constraint sales_client_payment_mode_check
  check (client_payment_mode is null or client_payment_mode in ('immediate', 'payable_debt'));

-- 2. Adicionar sale_id em payable_debts para rastreabilidade
alter table public.payable_debts
  add column if not exists sale_id text null references public.sales(id) on delete set null;

create index if not exists idx_payable_debts_sale_id on public.payable_debts (sale_id);

-- 3. Ampliar check de source em payable_debts para incluir 'pdv'
alter table public.payable_debts
  drop constraint if exists payable_debts_source_check;
alter table public.payable_debts
  add  constraint payable_debts_source_check
  check (source in ('manual', 'import_anexo', 'pdv'));
