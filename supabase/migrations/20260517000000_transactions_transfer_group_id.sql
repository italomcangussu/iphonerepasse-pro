begin;

-- ============================================================
-- Adds transfer_group_id to transactions so that the two halves
-- of an account-to-account transfer (debit on source + credit on
-- target) can be linked by a shared identifier. Without this
-- column the Finance UI cannot cascade-cancel both halves when
-- the operator deletes one, allowing accounts to drift out of
-- balance.
-- ============================================================

alter table public.transactions
  add column if not exists transfer_group_id text null;

create index if not exists idx_transactions_transfer_group_id
  on public.transactions (transfer_group_id)
  where transfer_group_id is not null;

-- Make the category "Transferência" available to the finance
-- categorizer (in/out share the same name; the type column on
-- the category row only drives the default category picker).
insert into public.finance_categories (id, name, type, is_default)
values
  ('cat_in_transfer', 'Transferência', 'IN', false),
  ('cat_out_transfer', 'Transferência', 'OUT', false)
on conflict (id) do nothing;

commit;
