-- Sale child rows must include sale_id in DELETE realtime payloads so
-- other clients can rehydrate sale totals, payment methods, and trade-ins.
alter table public.payment_methods replica identity full;
alter table public.sale_items replica identity full;
alter table public.sale_trade_in_items replica identity full;
