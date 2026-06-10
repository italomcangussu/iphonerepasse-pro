begin;

update public.transactions transaction
set description = 'Comissão recebida pelo vendedor ' || seller.name
from public.sales sale
join public.sellers seller on seller.id = sale.seller_id
where transaction.sale_id = sale.id
  and transaction.category = 'Comissão'
  and transaction.type = 'OUT'
  and coalesce(transaction.amount, 0) = coalesce(sale.commission, 0)
  and coalesce(sale.commission, 0) > 0
  and sale.date >= now() - interval '30 days'
  and nullif(seller.name, '') is not null;

commit;
