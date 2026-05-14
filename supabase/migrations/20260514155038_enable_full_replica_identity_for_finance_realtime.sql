-- Supabase Realtime sends only primary-key values for DELETE events while
-- tables use REPLICA IDENTITY DEFAULT. Finance cancellation/reversal flows
-- need the deleted row relationship columns to update linked local state.
alter table public.transactions replica identity full;
alter table public.debt_payments replica identity full;
alter table public.payable_debt_payments replica identity full;
alter table public.debts replica identity full;
alter table public.payable_debts replica identity full;
