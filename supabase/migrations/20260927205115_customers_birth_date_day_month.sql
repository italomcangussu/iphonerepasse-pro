-- O cadastro de clientes coleta só dia e mês do nascimento. Até aqui
-- `customers.birth_date` era `date`, então o app inventava um ano (1904) para
-- caber na coluna. Passa a ser texto `MM-DD`, sem ano.
--
-- Registros existentes: mantém mês/dia e descarta o ano (sentinela 1904 ou
-- ano legado), porque a informação de ano não é mais coletada nem exibida.

create or replace function private.normalize_birth_day_month(p_value text)
returns text
language plpgsql
immutable
set search_path = public, private
as $$
declare
  v text := nullif(btrim(coalesce(p_value, '')), '');
  v_day int;
  v_month int;
  v_max int[] := array[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
begin
  if v is null then
    return null;
  end if;

  if v ~ '^\d{4}-\d{2}-\d{2}' then          -- YYYY-MM-DD (ano ignorado)
    v_month := substr(v, 6, 2)::int;
    v_day := substr(v, 9, 2)::int;
  elsif v ~ '^\d{2}-\d{2}$' then             -- MM-DD
    v_month := substr(v, 1, 2)::int;
    v_day := substr(v, 4, 2)::int;
  elsif v ~ '^\d{1,2}/\d{1,2}(/\d{2,4})?$' then  -- DD/MM[/AAAA]
    v_day := split_part(v, '/', 1)::int;
    v_month := split_part(v, '/', 2)::int;
  else
    raise exception 'Data de nascimento inválida: use DD/MM.' using errcode = '22007';
  end if;

  if v_month < 1 or v_month > 12 or v_day < 1 or v_day > v_max[v_month] then
    raise exception 'Data de nascimento inválida: use DD/MM.' using errcode = '22007';
  end if;

  return lpad(v_month::text, 2, '0') || '-' || lpad(v_day::text, 2, '0');
end;
$$;

alter table public.customers
  alter column birth_date type text
  using case when birth_date is null then null else to_char(birth_date::date, 'MM-DD') end;

alter table public.customers
  drop constraint if exists customers_birth_date_day_month_check;
alter table public.customers
  add constraint customers_birth_date_day_month_check
  check (birth_date is null or birth_date = private.normalize_birth_day_month(birth_date));

-- Create a customer. Deduplicates by CPF (when given) then by phone digits;
-- returns the existing row instead of duplicating.
create or replace function public.admin_agent_create_customer(
  p_actor uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id text := coalesce(nullif(btrim(p_payload->>'id'), ''), 'cust_' || replace(gen_random_uuid()::text, '-', ''));
  v_name text := nullif(btrim(p_payload->>'name'), '');
  v_cpf text := nullif(regexp_replace(coalesce(p_payload->>'cpf', ''), '\D', '', 'g'), '');
  v_phone text := nullif(btrim(p_payload->>'phone'), '');
  v_phone_digits text := nullif(regexp_replace(coalesce(p_payload->>'phone', ''), '\D', '', 'g'), '');
  v_existing public.customers%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if v_name is null then
    raise exception 'Nome do cliente é obrigatório.' using errcode = '22023';
  end if;
  if v_phone is null then
    raise exception 'Telefone do cliente é obrigatório.' using errcode = '22023';
  end if;

  if v_cpf is not null then
    select * into v_existing from public.customers
    where nullif(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), '') = v_cpf
    limit 1;
  end if;
  if v_existing.id is null and v_phone_digits is not null then
    select * into v_existing from public.customers
    where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone_digits
    limit 1;
  end if;
  if v_existing.id is not null then
    return jsonb_build_object('id', v_existing.id, 'name', v_existing.name, 'existed', true);
  end if;

  insert into public.customers (id, name, cpf, phone, alternative_phone, email, birth_date, purchases, total_spent)
  values (
    v_id,
    v_name,
    v_cpf,
    v_phone,
    nullif(btrim(p_payload->>'alternativePhone'), ''),
    coalesce(nullif(btrim(p_payload->>'email'), ''), ''),
    private.normalize_birth_day_month(p_payload->>'birthDate'),
    0,
    0
  );

  return jsonb_build_object('id', v_id, 'name', v_name, 'existed', false);
end;
$$;

revoke all on function public.admin_agent_create_customer(uuid, jsonb) from public;
revoke all on function public.admin_agent_create_customer(uuid, jsonb) from anon;
revoke all on function public.admin_agent_create_customer(uuid, jsonb) from authenticated;
grant execute on function public.admin_agent_create_customer(uuid, jsonb) to service_role;

-- Update a customer (allowlisted columns).
create or replace function public.admin_agent_update_customer(
  p_actor uuid,
  p_id text,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_cust public.customers%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  select * into v_cust from public.customers where id = p_id;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = '22023';
  end if;

  update public.customers set
    name = case when p_patch ? 'name' then coalesce(nullif(btrim(p_patch->>'name'), ''), name) else name end,
    cpf = case when p_patch ? 'cpf' then nullif(regexp_replace(coalesce(p_patch->>'cpf', ''), '\D', '', 'g'), '') else cpf end,
    phone = case when p_patch ? 'phone' then coalesce(nullif(btrim(p_patch->>'phone'), ''), phone) else phone end,
    alternative_phone = case when p_patch ? 'alternativePhone' then nullif(btrim(p_patch->>'alternativePhone'), '') else alternative_phone end,
    email = case when p_patch ? 'email' then coalesce(p_patch->>'email', email) else email end,
    birth_date = case when p_patch ? 'birthDate' then private.normalize_birth_day_month(p_patch->>'birthDate') else birth_date end
  where id = p_id;

  select * into v_cust from public.customers where id = p_id;
  return jsonb_build_object('id', p_id, 'name', v_cust.name, 'phone', v_cust.phone);
end;
$$;

revoke all on function public.admin_agent_update_customer(uuid, text, jsonb) from public;
revoke all on function public.admin_agent_update_customer(uuid, text, jsonb) from anon;
revoke all on function public.admin_agent_update_customer(uuid, text, jsonb) from authenticated;
grant execute on function public.admin_agent_update_customer(uuid, text, jsonb) to service_role;
