-- Após 20260926120000, `customers.birth_date` é texto `MM-DD` com CHECK estrito.
-- Clientes com o bundle antigo em cache (PWA) ainda enviam `AAAA-MM-DD`
-- (ano sentinela 1904) e o cadastro falhava com
-- "violates check constraint customers_birth_date_day_month_check".
-- Normaliza antes do CHECK: aceita `AAAA-MM-DD`, `MM-DD` e `DD/MM[/AAAA]`;
-- valor vazio vira null; valor inválido segue rejeitado com mensagem clara.

create or replace function private.customers_normalize_birth_date()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.birth_date := private.normalize_birth_day_month(new.birth_date);
  return new;
end;
$$;

drop trigger if exists customers_normalize_birth_date on public.customers;
create trigger customers_normalize_birth_date
  before insert or update of birth_date on public.customers
  for each row
  execute function private.customers_normalize_birth_date();
