begin;

-- Backfill das descrições antigas que ainda exibem o id cru da venda/dívida.
-- Espelha a lógica de getTransactionDescription no front-end e a janela de 30 dias
-- usada no backfill de comissão.

-- Vendas vinculadas (Venda cartão/dinheiro, Venda (Trade-in), Entrada (Troca)):
-- a descrição termina com " - <sale_id>". Trocamos o sufixo pelo nome do cliente,
-- preservando rótulo e detalhes técnicos. Comissão fica de fora (referencia o vendedor).
update public.transactions transaction
set description = left(
      transaction.description,
      length(transaction.description) - length(' - ' || sale.id)
    ) || ' - ' || customer.name
from public.sales sale
join public.customers customer on customer.id = sale.customer_id
where transaction.sale_id = sale.id
  and transaction.category <> 'Comissão'
  and right(transaction.description, length(' - ' || sale.id)) = ' - ' || sale.id
  and nullif(customer.name, '') is not null
  and sale.date >= now() - interval '30 days';

-- Quitação de dívida: a descrição termina com o id da dívida.
update public.transactions transaction
set description = 'Quitação de dívida - ' || customer.name
from public.debts debt
join public.customers customer on customer.id = debt.customer_id
where transaction.description = 'Quitação de dívida - ' || debt.id
  and nullif(customer.name, '') is not null
  and transaction.date >= now() - interval '30 days';

commit;
