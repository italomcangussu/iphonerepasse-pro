alter table public.stock_items
  add column if not exists sim_type text;
