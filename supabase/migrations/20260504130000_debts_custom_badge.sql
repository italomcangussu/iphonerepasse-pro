begin;
alter table public.debts add column if not exists custom_badge text null;
commit;
