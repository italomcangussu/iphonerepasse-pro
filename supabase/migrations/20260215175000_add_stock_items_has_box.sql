alter table public.stock_items
  add column if not exists has_box boolean not null default false;
