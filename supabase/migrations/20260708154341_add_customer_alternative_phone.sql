alter table if exists public.customers
  add column if not exists alternative_phone text;

comment on column public.customers.alternative_phone is
  'Telefone alternativo opcional do cliente, usado em cadastros ERP.';
