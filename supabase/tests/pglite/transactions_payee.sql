-- Salário e serviço semanal: categorias existem e o lançamento guarda o funcionário pago.
do $$ begin
  assert (select count(*) from public.finance_categories
          where type = 'OUT' and name in ('Salário semanal', 'Serviço semanal')) = 2,
    'categorias de pagamento semanal criadas';
end $$;

insert into public.sellers (id, name) values ('sel_payee', 'Funcionário Teste');
insert into public.transactions (id, type, amount, category, description, date, account, payee_seller_id)
values ('trx_payee', 'OUT', 500, 'Salário semanal', 'Salário semanal · Funcionário Teste', now(), 'Cofre', 'sel_payee');

do $$ begin
  assert (select payee_seller_id from public.transactions where id = 'trx_payee') = 'sel_payee', 'funcionário gravado';
end $$;

-- Apagar o funcionário não apaga o lançamento: só tira o vínculo.
delete from public.sellers where id = 'sel_payee';
do $$ begin
  assert exists (select 1 from public.transactions where id = 'trx_payee' and payee_seller_id is null),
    'lançamento continua sem o vínculo';
end $$;

