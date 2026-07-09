-- Admin Agent Console — Full manager operations
-- ============================================================================
-- Expands `crm-admin-agent` from a finance helper into a broad app manager
-- operable by WhatsApp (text or audio). Adds guarded writes:
--   * stock items: create / update / delete (unsold only)
--   * customers: create (dedup) / update
--   * creditors: create (dedup)
--   * manual transactions: update / delete (manual-only guard)
--   * full sales: create (mirrors public.create_sale_full with an admin-actor guard)
--   * settings: finance_categories upsert, device_catalog upsert
-- Plus a private storage bucket for PDF reports the agent sends as WhatsApp
-- documents.
--
-- Same security model as 20260708120000/20260708150000: the WhatsApp sender has
-- no auth session, so every write takes the RESOLVED admin actor and re-asserts
-- admin via private.admin_agent_assert_admin (current_role() is null under
-- service_role). All writes stay two-step (prepare -> SIM) and audited in the
-- edge function. Column mappings mirror services/dataContext.tsx.

begin;

-- ---------------------------------------------------------------------------
-- Stock items
-- ---------------------------------------------------------------------------

-- Create a stock item. Required: model, imei, purchasePrice, sellPrice. Store
-- defaults to resolve_crm_default_store_id() when omitted.
create or replace function public.admin_agent_create_stock_item(
  p_actor uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id text := coalesce(nullif(btrim(p_payload->>'id'), ''), 'stk_' || replace(gen_random_uuid()::text, '-', ''));
  v_store text := coalesce(nullif(btrim(p_payload->>'storeId'), ''), public.resolve_crm_default_store_id());
  v_purchase numeric := nullif(btrim(p_payload->>'purchasePrice'), '')::numeric;
  v_sell numeric := nullif(btrim(p_payload->>'sellPrice'), '')::numeric;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if coalesce(nullif(btrim(p_payload->>'model'), ''), '') = '' then
    raise exception 'Modelo do aparelho é obrigatório.' using errcode = '22023';
  end if;
  if coalesce(nullif(btrim(p_payload->>'imei'), ''), '') = '' then
    raise exception 'IMEI/Serial do aparelho é obrigatório.' using errcode = '22023';
  end if;
  if v_purchase is null or v_purchase < 0 then
    raise exception 'Preço de compra inválido.' using errcode = '22023';
  end if;
  if v_sell is null or v_sell < 0 then
    raise exception 'Preço de venda inválido.' using errcode = '22023';
  end if;
  if v_store is null then
    raise exception 'Loja não resolvida para o cadastro.' using errcode = '22023';
  end if;

  insert into public.stock_items (
    id, type, model, color, has_box, capacity, imei, condition, status,
    sim_type, battery_health, store_id, purchase_price, sell_price,
    max_discount, warranty_type, warranty_end, origin, notes, observations,
    entry_date, photos
  ) values (
    v_id,
    coalesce(nullif(btrim(p_payload->>'type'), ''), 'iPhone'),
    btrim(p_payload->>'model'),
    coalesce(nullif(btrim(p_payload->>'color'), ''), ''),
    coalesce((p_payload->>'hasBox')::boolean, false),
    coalesce(nullif(btrim(p_payload->>'capacity'), ''), ''),
    btrim(p_payload->>'imei'),
    coalesce(nullif(btrim(p_payload->>'condition'), ''), 'Seminovo'),
    coalesce(nullif(btrim(p_payload->>'status'), ''), 'Disponível'),
    coalesce(nullif(btrim(p_payload->>'simType'), ''), 'Physical'),
    nullif(btrim(p_payload->>'batteryHealth'), '')::numeric,
    v_store,
    v_purchase,
    v_sell,
    coalesce(nullif(btrim(p_payload->>'maxDiscount'), '')::numeric, 0),
    coalesce(nullif(btrim(p_payload->>'warrantyType'), ''), 'Loja'),
    nullif(btrim(p_payload->>'warrantyEnd'), '')::timestamptz,
    coalesce(nullif(btrim(p_payload->>'origin'), ''), 'Cadastro via assistente'),
    nullif(btrim(p_payload->>'notes'), ''),
    nullif(btrim(p_payload->>'observations'), ''),
    coalesce(nullif(btrim(p_payload->>'entryDate'), '')::timestamptz, now()),
    coalesce(
      array(select jsonb_array_elements_text(coalesce(p_payload->'photos', '[]'::jsonb))),
      array[]::text[]
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'model', btrim(p_payload->>'model'),
    'storeId', v_store,
    'sellPrice', v_sell
  );
end;
$$;

revoke all on function public.admin_agent_create_stock_item(uuid, jsonb) from public;
revoke all on function public.admin_agent_create_stock_item(uuid, jsonb) from anon;
revoke all on function public.admin_agent_create_stock_item(uuid, jsonb) from authenticated;
grant execute on function public.admin_agent_create_stock_item(uuid, jsonb) to service_role;

-- Update a stock item. Only allowlisted columns; keys absent from p_patch keep
-- their current value.
create or replace function public.admin_agent_update_stock_item(
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
  v_item public.stock_items%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  select * into v_item from public.stock_items where id = p_id;
  if not found then
    raise exception 'Aparelho não encontrado.' using errcode = '22023';
  end if;

  update public.stock_items set
    model = case when p_patch ? 'model' then coalesce(nullif(btrim(p_patch->>'model'), ''), model) else model end,
    imei = case when p_patch ? 'imei' then coalesce(nullif(btrim(p_patch->>'imei'), ''), imei) else imei end,
    color = case when p_patch ? 'color' then coalesce(p_patch->>'color', color) else color end,
    capacity = case when p_patch ? 'capacity' then coalesce(p_patch->>'capacity', capacity) else capacity end,
    condition = case when p_patch ? 'condition' then coalesce(nullif(btrim(p_patch->>'condition'), ''), condition) else condition end,
    status = case when p_patch ? 'status' then coalesce(nullif(btrim(p_patch->>'status'), ''), status) else status end,
    has_box = case when p_patch ? 'hasBox' then coalesce((p_patch->>'hasBox')::boolean, has_box) else has_box end,
    battery_health = case when p_patch ? 'batteryHealth' then nullif(btrim(p_patch->>'batteryHealth'), '')::numeric else battery_health end,
    purchase_price = case when p_patch ? 'purchasePrice' then coalesce(nullif(btrim(p_patch->>'purchasePrice'), '')::numeric, purchase_price) else purchase_price end,
    sell_price = case when p_patch ? 'sellPrice' then coalesce(nullif(btrim(p_patch->>'sellPrice'), '')::numeric, sell_price) else sell_price end,
    max_discount = case when p_patch ? 'maxDiscount' then coalesce(nullif(btrim(p_patch->>'maxDiscount'), '')::numeric, max_discount) else max_discount end,
    warranty_type = case when p_patch ? 'warrantyType' then coalesce(nullif(btrim(p_patch->>'warrantyType'), ''), warranty_type) else warranty_type end,
    warranty_end = case when p_patch ? 'warrantyEnd' then nullif(btrim(p_patch->>'warrantyEnd'), '')::timestamptz else warranty_end end,
    notes = case when p_patch ? 'notes' then nullif(btrim(p_patch->>'notes'), '') else notes end,
    observations = case when p_patch ? 'observations' then nullif(btrim(p_patch->>'observations'), '') else observations end,
    updated_at = now()
  where id = p_id;

  select * into v_item from public.stock_items where id = p_id;
  return jsonb_build_object(
    'id', p_id,
    'model', v_item.model,
    'status', v_item.status,
    'sellPrice', v_item.sell_price
  );
end;
$$;

revoke all on function public.admin_agent_update_stock_item(uuid, text, jsonb) from public;
revoke all on function public.admin_agent_update_stock_item(uuid, text, jsonb) from anon;
revoke all on function public.admin_agent_update_stock_item(uuid, text, jsonb) from authenticated;
grant execute on function public.admin_agent_update_stock_item(uuid, text, jsonb) to service_role;

-- Delete a stock item. Only if not sold, not tied to a sale, and without an
-- active reservation.
create or replace function public.admin_agent_delete_stock_item(
  p_actor uuid,
  p_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_item public.stock_items%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  select * into v_item from public.stock_items where id = p_id;
  if not found then
    raise exception 'Aparelho não encontrado.' using errcode = '22023';
  end if;
  if v_item.status = 'Vendido' then
    raise exception 'Não é possível excluir um aparelho já vendido.' using errcode = '22023';
  end if;
  if exists (select 1 from public.sale_items where stock_item_id = p_id) then
    raise exception 'Aparelho vinculado a uma venda; não pode ser excluído.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.stock_reservations where stock_item_id = p_id and status = 'active'
  ) then
    raise exception 'Aparelho tem reserva ativa; libere a reserva antes de excluir.' using errcode = '22023';
  end if;

  delete from public.costs where stock_item_id = p_id;
  delete from public.stock_items where id = p_id;

  return jsonb_build_object('id', p_id, 'deleted', true, 'model', v_item.model);
end;
$$;

revoke all on function public.admin_agent_delete_stock_item(uuid, text) from public;
revoke all on function public.admin_agent_delete_stock_item(uuid, text) from anon;
revoke all on function public.admin_agent_delete_stock_item(uuid, text) from authenticated;
grant execute on function public.admin_agent_delete_stock_item(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

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
    nullif(btrim(p_payload->>'birthDate'), '')::date,
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
    birth_date = case when p_patch ? 'birthDate' then nullif(btrim(p_patch->>'birthDate'), '')::date else birth_date end
  where id = p_id;

  select * into v_cust from public.customers where id = p_id;
  return jsonb_build_object('id', p_id, 'name', v_cust.name, 'phone', v_cust.phone);
end;
$$;

revoke all on function public.admin_agent_update_customer(uuid, text, jsonb) from public;
revoke all on function public.admin_agent_update_customer(uuid, text, jsonb) from anon;
revoke all on function public.admin_agent_update_customer(uuid, text, jsonb) from authenticated;
grant execute on function public.admin_agent_update_customer(uuid, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Creditors
-- ---------------------------------------------------------------------------

-- Create a creditor. Deduplicates by document when provided.
create or replace function public.admin_agent_create_creditor(
  p_actor uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id text := coalesce(nullif(btrim(p_payload->>'id'), ''), 'crd_' || replace(gen_random_uuid()::text, '-', ''));
  v_name text := nullif(btrim(p_payload->>'name'), '');
  v_doc text := nullif(btrim(p_payload->>'document'), '');
  v_doc_type text := nullif(btrim(p_payload->>'documentType'), '');
  v_existing public.creditors%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if v_name is null then
    raise exception 'Nome do credor é obrigatório.' using errcode = '22023';
  end if;
  if v_doc_type is not null and v_doc_type not in ('CPF', 'CNPJ') then
    raise exception 'Tipo de documento inválido (CPF ou CNPJ).' using errcode = '22023';
  end if;

  if v_doc is not null then
    select * into v_existing from public.creditors where document = v_doc limit 1;
    if v_existing.id is not null then
      return jsonb_build_object('id', v_existing.id, 'name', v_existing.name, 'existed', true);
    end if;
  end if;

  insert into public.creditors (id, name, document, document_type, phone, email, notes)
  values (
    v_id,
    v_name,
    v_doc,
    v_doc_type,
    nullif(btrim(p_payload->>'phone'), ''),
    nullif(btrim(p_payload->>'email'), ''),
    nullif(btrim(p_payload->>'notes'), '')
  );

  return jsonb_build_object('id', v_id, 'name', v_name, 'existed', false);
end;
$$;

revoke all on function public.admin_agent_create_creditor(uuid, jsonb) from public;
revoke all on function public.admin_agent_create_creditor(uuid, jsonb) from anon;
revoke all on function public.admin_agent_create_creditor(uuid, jsonb) from authenticated;
grant execute on function public.admin_agent_create_creditor(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Manual transactions: update / delete (manual-only guard)
-- ---------------------------------------------------------------------------

create or replace function public.admin_agent_update_transaction(
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
  v_trx public.transactions%rowtype;
  v_account text;
  v_amount numeric;
begin
  perform private.admin_agent_assert_admin(p_actor);

  select * into v_trx from public.transactions where id = p_id;
  if not found then
    raise exception 'Lançamento não encontrado.' using errcode = '22023';
  end if;
  if v_trx.sale_id is not null
     or v_trx.debt_payment_id is not null
     or v_trx.payable_debt_payment_id is not null
     or v_trx.payable_debt_id is not null
     or v_trx.transfer_group_id is not null then
    raise exception 'Só é possível editar lançamentos manuais (este é gerado por venda/dívida/transferência).' using errcode = '22023';
  end if;

  if p_patch ? 'account' then
    v_account := nullif(btrim(p_patch->>'account'), '');
    if v_account not in ('Conta Bancária', 'Cofre') then
      raise exception 'Conta inválida (Conta Bancária ou Cofre).' using errcode = '22023';
    end if;
  end if;
  if p_patch ? 'amount' then
    v_amount := nullif(btrim(p_patch->>'amount'), '')::numeric;
    if v_amount is null or v_amount <= 0 then
      raise exception 'Valor inválido.' using errcode = '22023';
    end if;
  end if;

  update public.transactions set
    category = case when p_patch ? 'category' then coalesce(nullif(btrim(p_patch->>'category'), ''), category) else category end,
    amount = case when p_patch ? 'amount' then v_amount else amount end,
    description = case when p_patch ? 'description' then coalesce(p_patch->>'description', description) else description end,
    account = case when p_patch ? 'account' then v_account else account end,
    date = case when p_patch ? 'date' then coalesce(nullif(btrim(p_patch->>'date'), '')::timestamptz, date) else date end
  where id = p_id;

  select * into v_trx from public.transactions where id = p_id;
  return jsonb_build_object(
    'id', p_id, 'type', v_trx.type, 'amount', v_trx.amount,
    'account', v_trx.account, 'category', v_trx.category
  );
end;
$$;

revoke all on function public.admin_agent_update_transaction(uuid, text, jsonb) from public;
revoke all on function public.admin_agent_update_transaction(uuid, text, jsonb) from anon;
revoke all on function public.admin_agent_update_transaction(uuid, text, jsonb) from authenticated;
grant execute on function public.admin_agent_update_transaction(uuid, text, jsonb) to service_role;

create or replace function public.admin_agent_delete_transaction(
  p_actor uuid,
  p_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_trx public.transactions%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  select * into v_trx from public.transactions where id = p_id;
  if not found then
    raise exception 'Lançamento não encontrado.' using errcode = '22023';
  end if;
  if v_trx.sale_id is not null
     or v_trx.debt_payment_id is not null
     or v_trx.payable_debt_payment_id is not null
     or v_trx.payable_debt_id is not null
     or v_trx.transfer_group_id is not null then
    raise exception 'Só é possível excluir lançamentos manuais (este é gerado por venda/dívida/transferência).' using errcode = '22023';
  end if;

  delete from public.transactions where id = p_id;

  return jsonb_build_object('id', p_id, 'deleted', true, 'amount', v_trx.amount, 'type', v_trx.type);
end;
$$;

revoke all on function public.admin_agent_delete_transaction(uuid, text) from public;
revoke all on function public.admin_agent_delete_transaction(uuid, text) from anon;
revoke all on function public.admin_agent_delete_transaction(uuid, text) from authenticated;
grant execute on function public.admin_agent_delete_transaction(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Full sale — mirrors public.create_sale_full but authorizes the admin actor
-- (current_role() is null under service_role). Reuses the PDV machinery so all
-- financial side effects stay identical to the app's PDV.
-- ---------------------------------------------------------------------------

create or replace function public.admin_agent_create_sale(
  p_actor uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_sale_id text := p_payload->>'id';
  v_existing public.sales%rowtype;
  v_result jsonb;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if coalesce(v_sale_id, '') = '' then
    raise exception 'ID da venda é obrigatório.' using errcode = '22023';
  end if;

  select * into v_existing from public.sales where id = v_sale_id for update;
  if found then
    delete from public.debt_payments where debt_id in (select id from public.debts where sale_id = v_sale_id);
    delete from public.debts where sale_id = v_sale_id;
    delete from public.payable_debt_payments where payable_debt_id in (select id from public.payable_debts where sale_id = v_sale_id);
    delete from public.payable_debts where sale_id = v_sale_id;
    delete from public.transactions where sale_id = v_sale_id;
    delete from public.sale_trade_in_items where sale_id = v_sale_id;
    delete from public.payment_methods where sale_id = v_sale_id;
    delete from public.sale_items where sale_id = v_sale_id;
    delete from public.sales where id = v_sale_id;
  end if;

  perform public.pdv_insert_sale_full_payload(p_payload);
  v_result := public.pdv_hydrate_sale_json(v_sale_id);

  return v_result;
end;
$$;

revoke all on function public.admin_agent_create_sale(uuid, jsonb) from public;
revoke all on function public.admin_agent_create_sale(uuid, jsonb) from anon;
revoke all on function public.admin_agent_create_sale(uuid, jsonb) from authenticated;
grant execute on function public.admin_agent_create_sale(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Settings: finance categories + device catalog
-- ---------------------------------------------------------------------------

-- Upsert a finance category by (name, type). Case-insensitive match on name.
create or replace function public.admin_agent_upsert_finance_category(
  p_actor uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_name text := nullif(btrim(p_payload->>'name'), '');
  v_type text := upper(nullif(btrim(p_payload->>'type'), ''));
  v_is_default boolean := coalesce((p_payload->>'isDefault')::boolean, false);
  v_id text;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if v_name is null then
    raise exception 'Nome da categoria é obrigatório.' using errcode = '22023';
  end if;
  if v_type not in ('IN', 'OUT') then
    raise exception 'Tipo inválido (IN = receita, OUT = despesa).' using errcode = '22023';
  end if;

  select id into v_id from public.finance_categories
  where lower(name) = lower(v_name) and type = v_type
  limit 1;

  if v_id is null then
    v_id := 'cat_' || replace(gen_random_uuid()::text, '-', '');
    insert into public.finance_categories (id, name, type, is_default)
    values (v_id, v_name, v_type, v_is_default);
    return jsonb_build_object('id', v_id, 'name', v_name, 'type', v_type, 'created', true);
  else
    update public.finance_categories
    set name = v_name, is_default = v_is_default
    where id = v_id;
    return jsonb_build_object('id', v_id, 'name', v_name, 'type', v_type, 'created', false);
  end if;
end;
$$;

revoke all on function public.admin_agent_upsert_finance_category(uuid, jsonb) from public;
revoke all on function public.admin_agent_upsert_finance_category(uuid, jsonb) from anon;
revoke all on function public.admin_agent_upsert_finance_category(uuid, jsonb) from authenticated;
grant execute on function public.admin_agent_upsert_finance_category(uuid, jsonb) to service_role;

-- Upsert a device catalog entry (type, model, color). Idempotent on the
-- unique (type, model, color).
create or replace function public.admin_agent_upsert_device_catalog(
  p_actor uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id text := 'dvc_' || replace(gen_random_uuid()::text, '-', '');
  v_type text := nullif(btrim(p_payload->>'type'), '');
  v_model text := nullif(btrim(p_payload->>'model'), '');
  v_color text := coalesce(nullif(btrim(p_payload->>'color'), ''), '');
begin
  perform private.admin_agent_assert_admin(p_actor);

  if v_type not in ('iPhone', 'iPad', 'Macbook', 'Apple Watch', 'Acessório') then
    raise exception 'Tipo inválido (iPhone, iPad, Macbook, Apple Watch ou Acessório).' using errcode = '22023';
  end if;
  if v_model is null then
    raise exception 'Modelo é obrigatório.' using errcode = '22023';
  end if;

  insert into public.device_catalog (id, type, model, color)
  values (v_id, v_type, v_model, v_color)
  on conflict (type, model, color) do update set updated_at = now()
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'type', v_type, 'model', v_model, 'color', v_color);
end;
$$;

revoke all on function public.admin_agent_upsert_device_catalog(uuid, jsonb) from public;
revoke all on function public.admin_agent_upsert_device_catalog(uuid, jsonb) from anon;
revoke all on function public.admin_agent_upsert_device_catalog(uuid, jsonb) from authenticated;
grant execute on function public.admin_agent_upsert_device_catalog(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for PDF reports the agent sends as WhatsApp documents.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('admin-agent-reports', 'admin-agent-reports', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

commit;
