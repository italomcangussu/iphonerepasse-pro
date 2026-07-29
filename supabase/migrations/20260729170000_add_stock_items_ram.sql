-- Add ram column to stock_items table for devices that require RAM configuration (e.g. MacBooks)
alter table public.stock_items
  add column if not exists ram text;
