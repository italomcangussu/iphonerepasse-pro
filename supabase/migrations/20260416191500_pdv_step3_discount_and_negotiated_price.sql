begin;

alter table public.sales
  add column if not exists discount_type text null,
  add column if not exists discount_percent numeric null,
  add column if not exists original_subtotal numeric not null default 0,
  add column if not exists negotiated_subtotal numeric not null default 0;

alter table public.sales drop constraint if exists sales_discount_type_check;
alter table public.sales
  add constraint sales_discount_type_check
  check (discount_type in ('amount', 'percent') or discount_type is null);

alter table public.sales drop constraint if exists sales_discount_percent_check;
alter table public.sales
  add constraint sales_discount_percent_check
  check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100));

alter table public.sales drop constraint if exists sales_original_subtotal_check;
alter table public.sales
  add constraint sales_original_subtotal_check
  check (original_subtotal >= 0);

alter table public.sales drop constraint if exists sales_negotiated_subtotal_check;
alter table public.sales
  add constraint sales_negotiated_subtotal_check
  check (negotiated_subtotal >= 0);

alter table public.sale_items
  add column if not exists original_price numeric null;

alter table public.sale_items drop constraint if exists sale_items_original_price_check;
alter table public.sale_items
  add constraint sale_items_original_price_check
  check (original_price is null or original_price >= 0);

update public.sale_items
set original_price = coalesce(original_price, price)
where original_price is null;

with sale_item_totals as (
  select
    si.sale_id,
    coalesce(sum(si.price), 0) as negotiated_total,
    coalesce(sum(coalesce(si.original_price, si.price)), 0) as original_total
  from public.sale_items si
  group by si.sale_id
)
update public.sales s
set
  negotiated_subtotal = coalesce(
    sit.negotiated_total,
    coalesce(s.total, 0) + coalesce(s.discount, 0) + coalesce(s.trade_in_value, 0)
  ),
  original_subtotal = coalesce(
    sit.original_total,
    coalesce(s.total, 0) + coalesce(s.discount, 0) + coalesce(s.trade_in_value, 0)
  ),
  discount_type = case
    when coalesce(s.discount, 0) > 0 and s.discount_type is null then 'amount'
    else s.discount_type
  end
from sale_item_totals sit
where sit.sale_id = s.id;

update public.sales
set negotiated_subtotal = coalesce(total, 0) + coalesce(discount, 0) + coalesce(trade_in_value, 0)
where coalesce(negotiated_subtotal, 0) = 0
  and (coalesce(total, 0) + coalesce(discount, 0) + coalesce(trade_in_value, 0)) > 0;

update public.sales
set original_subtotal = coalesce(negotiated_subtotal, 0)
where coalesce(original_subtotal, 0) = 0
  and coalesce(negotiated_subtotal, 0) > 0;

commit;
