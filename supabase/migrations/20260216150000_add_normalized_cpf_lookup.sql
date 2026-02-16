begin;

create index if not exists customers_cpf_normalized_idx
  on public.customers ((regexp_replace(coalesce(cpf, ''), '\D', '', 'g')));

create or replace function public.customer_ids_by_normalized_cpf(input_cpf text)
returns table (
  id text,
  name text,
  cpf text
)
language sql
stable
as $$
  select
    c.id,
    c.name,
    c.cpf
  from public.customers c
  where regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') = regexp_replace(coalesce(input_cpf, ''), '\D', '', 'g');
$$;

grant execute on function public.customer_ids_by_normalized_cpf(text) to anon, authenticated, service_role;

commit;
