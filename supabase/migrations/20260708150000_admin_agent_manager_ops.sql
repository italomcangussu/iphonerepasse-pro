-- Admin Agent Console — Manager operations
-- ============================================================================
-- Extends `crm-admin-agent` from a finance-only helper into a broad app
-- manager. Adds:
--   * read summaries (finance, sales, inventory) aggregated in SQL so they are
--     not truncated by the PostgREST 1000-row cap and stay cheap;
--   * additional guarded writes — register a manual transaction, receive a
--     customer debt payment, pay a payable debt, release a stock reservation.
--
-- Same security model as 20260708120000_admin_agent_console.sql: the WhatsApp
-- sender has no auth session, so reads run under service_role only, and every
-- write takes the RESOLVED admin actor and re-asserts admin via
-- private.admin_agent_assert_admin (current_role() is null under service_role).
-- All writes stay two-step (prepare -> SIM) and audited in the edge function.

begin;

-- ---------------------------------------------------------------------------
-- Reads: aggregate summaries (service_role only, no actor param)
-- ---------------------------------------------------------------------------

-- Finance movement over a date range.
create or replace function public.admin_agent_financial_summary(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with scoped as (
    select type, category, amount
    from public.transactions
    where date >= p_from and date < p_to
  )
  select jsonb_build_object(
    'income',
      coalesce((select round(sum(amount)::numeric, 2) from scoped where type = 'IN'), 0),
    'expense',
      coalesce((select round(sum(amount)::numeric, 2) from scoped where type = 'OUT'), 0),
    'net',
      coalesce((
        select round(sum(case when type = 'IN' then amount else -amount end)::numeric, 2)
        from scoped
      ), 0),
    'count', (select count(*) from scoped),
    'topExpenseCategories', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select category, round(sum(amount)::numeric, 2) as total
        from scoped
        where type = 'OUT'
        group by category
        order by sum(amount) desc
        limit 5
      ) t
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_agent_financial_summary(timestamptz, timestamptz) from public;
revoke all on function public.admin_agent_financial_summary(timestamptz, timestamptz) from anon;
revoke all on function public.admin_agent_financial_summary(timestamptz, timestamptz) from authenticated;
grant execute on function public.admin_agent_financial_summary(timestamptz, timestamptz) to service_role;

-- Sales over a date range.
create or replace function public.admin_agent_sales_summary(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with scoped as (
    select total
    from public.sales
    where date >= p_from and date < p_to
  )
  select jsonb_build_object(
    'count', (select count(*) from scoped),
    'revenue', coalesce((select round(sum(total)::numeric, 2) from scoped), 0),
    'avgTicket', coalesce((select round(avg(total)::numeric, 2) from scoped), 0)
  );
$$;

revoke all on function public.admin_agent_sales_summary(timestamptz, timestamptz) from public;
revoke all on function public.admin_agent_sales_summary(timestamptz, timestamptz) from anon;
revoke all on function public.admin_agent_sales_summary(timestamptz, timestamptz) from authenticated;
grant execute on function public.admin_agent_sales_summary(timestamptz, timestamptz) to service_role;

-- Inventory snapshot (counts + capital tied up in stock).
create or replace function public.admin_agent_inventory_summary()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with instock as (
    select purchase_price, sell_price
    from public.stock_items
    where status in ('Disponível', 'Reservado', 'Em Preparação', 'Em Uso')
  )
  select jsonb_build_object(
    'available', (select count(*) from public.stock_items where status = 'Disponível'),
    'reserved', (select count(*) from public.stock_items where status = 'Reservado'),
    'inPreparation', (select count(*) from public.stock_items where status = 'Em Preparação'),
    'inStockCount', (select count(*) from instock),
    'totalPurchaseValue', coalesce((select round(sum(purchase_price)::numeric, 2) from instock), 0),
    'totalSellValue', coalesce((select round(sum(sell_price)::numeric, 2) from instock), 0)
  );
$$;

revoke all on function public.admin_agent_inventory_summary() from public;
revoke all on function public.admin_agent_inventory_summary() from anon;
revoke all on function public.admin_agent_inventory_summary() from authenticated;
grant execute on function public.admin_agent_inventory_summary() to service_role;

-- ---------------------------------------------------------------------------
-- Writes: admin-actor guarded (re-assert admin, then mutate)
-- ---------------------------------------------------------------------------

-- Register a manual finance transaction (income or expense).
create or replace function public.admin_agent_register_transaction(
  p_actor uuid,
  p_type text,
  p_category text,
  p_amount numeric,
  p_account text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id text := 'trx_' || replace(gen_random_uuid()::text, '-', '');
  v_type text := upper(btrim(coalesce(p_type, '')));
  v_account text := nullif(btrim(coalesce(p_account, '')), '');
  v_category text := nullif(btrim(coalesce(p_category, '')), '');
begin
  perform private.admin_agent_assert_admin(p_actor);

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor válido.' using errcode = '22023';
  end if;
  if v_type not in ('IN', 'OUT') then
    raise exception 'Tipo inválido (use IN ou OUT).' using errcode = '22023';
  end if;
  if v_account not in ('Conta Bancária', 'Cofre') then
    raise exception 'Conta inválida (Conta Bancária ou Cofre).' using errcode = '22023';
  end if;

  insert into public.transactions (id, type, category, amount, date, description, account)
  values (
    v_id,
    v_type,
    coalesce(v_category, case when v_type = 'IN' then 'Aporte' else 'Retirada' end),
    p_amount,
    now(),
    coalesce(nullif(btrim(p_description), ''), 'Lançamento via assistente financeiro'),
    v_account
  );

  return jsonb_build_object(
    'transactionId', v_id,
    'type', v_type,
    'amount', p_amount,
    'account', v_account
  );
end;
$$;

revoke all on function public.admin_agent_register_transaction(uuid, text, text, numeric, text, text) from public;
revoke all on function public.admin_agent_register_transaction(uuid, text, text, numeric, text, text) from anon;
revoke all on function public.admin_agent_register_transaction(uuid, text, text, numeric, text, text) from authenticated;
grant execute on function public.admin_agent_register_transaction(uuid, text, text, numeric, text, text) to service_role;

-- Receive a customer debt payment. The debt_payments AFTER INSERT trigger
-- decrements the debt, flips the status and books the IN transaction.
create or replace function public.admin_agent_receive_debt_payment(
  p_actor uuid,
  p_debt_id text,
  p_amount numeric,
  p_method text,
  p_account text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id text := 'dpm_' || replace(gen_random_uuid()::text, '-', '');
  v_method text := btrim(coalesce(p_method, ''));
  v_account text := coalesce(nullif(btrim(coalesce(p_account, '')), ''), 'Conta Bancária');
  v_debt public.debts%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor válido.' using errcode = '22023';
  end if;
  if v_method not in ('Pix', 'Dinheiro', 'Cartão') then
    raise exception 'Forma inválida (Pix, Dinheiro ou Cartão).' using errcode = '22023';
  end if;
  if v_account not in ('Conta Bancária', 'Cofre') then
    raise exception 'Conta inválida (Conta Bancária ou Cofre).' using errcode = '22023';
  end if;

  select * into v_debt from public.debts where id = p_debt_id;
  if not found then
    raise exception 'Dívida não encontrada.' using errcode = '22023';
  end if;

  insert into public.debt_payments (id, debt_id, amount, payment_method, account, paid_at, notes)
  values (v_id, p_debt_id, p_amount, v_method, v_account, now(), nullif(btrim(coalesce(p_notes, '')), ''));

  select * into v_debt from public.debts where id = p_debt_id;
  return jsonb_build_object(
    'paymentId', v_id,
    'debtId', p_debt_id,
    'amount', p_amount,
    'remaining', v_debt.remaining_amount,
    'status', v_debt.status
  );
end;
$$;

revoke all on function public.admin_agent_receive_debt_payment(uuid, text, numeric, text, text, text) from public;
revoke all on function public.admin_agent_receive_debt_payment(uuid, text, numeric, text, text, text) from anon;
revoke all on function public.admin_agent_receive_debt_payment(uuid, text, numeric, text, text, text) from authenticated;
grant execute on function public.admin_agent_receive_debt_payment(uuid, text, numeric, text, text, text) to service_role;

-- Pay a payable debt (conta a pagar). The payable_debt_payments AFTER INSERT
-- trigger decrements the debt and books the OUT transaction.
create or replace function public.admin_agent_pay_payable_debt(
  p_actor uuid,
  p_payable_debt_id text,
  p_amount numeric,
  p_method text,
  p_account text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id text := 'pdpm_' || replace(gen_random_uuid()::text, '-', '');
  v_method text := btrim(coalesce(p_method, ''));
  v_account text := coalesce(nullif(btrim(coalesce(p_account, '')), ''), 'Conta Bancária');
  v_debt public.payable_debts%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor válido.' using errcode = '22023';
  end if;
  if v_method not in ('Pix', 'Dinheiro', 'Cartão') then
    raise exception 'Forma inválida (Pix, Dinheiro ou Cartão).' using errcode = '22023';
  end if;
  if v_account not in ('Conta Bancária', 'Cofre') then
    raise exception 'Conta inválida (Conta Bancária ou Cofre).' using errcode = '22023';
  end if;

  select * into v_debt from public.payable_debts where id = p_payable_debt_id;
  if not found then
    raise exception 'Conta a pagar não encontrada.' using errcode = '22023';
  end if;

  insert into public.payable_debt_payments (id, payable_debt_id, amount, payment_method, account, paid_at, notes)
  values (v_id, p_payable_debt_id, p_amount, v_method, v_account, now(), nullif(btrim(coalesce(p_notes, '')), ''));

  select * into v_debt from public.payable_debts where id = p_payable_debt_id;
  return jsonb_build_object(
    'paymentId', v_id,
    'payableDebtId', p_payable_debt_id,
    'amount', p_amount,
    'remaining', v_debt.remaining_amount,
    'status', v_debt.status
  );
end;
$$;

revoke all on function public.admin_agent_pay_payable_debt(uuid, text, numeric, text, text, text) from public;
revoke all on function public.admin_agent_pay_payable_debt(uuid, text, numeric, text, text, text) from anon;
revoke all on function public.admin_agent_pay_payable_debt(uuid, text, numeric, text, text, text) from authenticated;
grant execute on function public.admin_agent_pay_payable_debt(uuid, text, numeric, text, text, text) to service_role;

-- Release (cancel) an active stock reservation, optionally refunding the deposit.
create or replace function public.admin_agent_release_reservation(
  p_actor uuid,
  p_stock_item_id text,
  p_refund_deposit boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_reservation public.stock_reservations%rowtype;
begin
  perform private.admin_agent_assert_admin(p_actor);
  v_reservation := public.release_stock_reservation(p_stock_item_id, coalesce(p_refund_deposit, false));
  return to_jsonb(v_reservation);
end;
$$;

revoke all on function public.admin_agent_release_reservation(uuid, text, boolean) from public;
revoke all on function public.admin_agent_release_reservation(uuid, text, boolean) from anon;
revoke all on function public.admin_agent_release_reservation(uuid, text, boolean) from authenticated;
grant execute on function public.admin_agent_release_reservation(uuid, text, boolean) to service_role;

notify pgrst, 'reload schema';

commit;
