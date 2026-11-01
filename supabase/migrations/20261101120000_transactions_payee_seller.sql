-- Pagamento de pessoal (salário e serviço semanal): o lançamento guarda quem recebeu,
-- em vez de uma categoria por pessoa ("PAGAMENTO FOLHA SEMANAL IGOR").
alter table public.transactions
  add column if not exists payee_seller_id text references public.sellers(id) on delete set null;

create index if not exists idx_transactions_payee_seller_id
  on public.transactions (payee_seller_id)
  where payee_seller_id is not null;

insert into public.finance_categories (id, name, type, is_default)
select v.id, v.name, 'OUT', false
from (values
  ('cat_salario_semanal', 'Salário semanal'),
  ('cat_servico_semanal', 'Serviço semanal')
) as v(id, name)
where not exists (
  select 1 from public.finance_categories c
  where c.type = 'OUT' and lower(c.name) = lower(v.name)
);
