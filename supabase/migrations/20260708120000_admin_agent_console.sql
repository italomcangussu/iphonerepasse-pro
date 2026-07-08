-- Admin Agent Console
-- ============================================================================
-- Backs the internal "financeiro no WhatsApp" assistant: administrators
-- recognized by their WhatsApp number talk to a self-contained AI agent
-- (edge function `crm-admin-agent`) that can read finance/inventory state and,
-- with an explicit two-step confirmation, move money between accounts or
-- reserve a device.
--
-- Security model: the WhatsApp sender is NOT an authenticated Supabase session,
-- so `current_role()` is null inside the edge function (service_role). The edge
-- function itself resolves the sender phone against `admin_agent_numbers` and
-- passes the RESOLVED admin `auth.users.id` to the write RPCs, which re-validate
-- that the actor is an admin in `user_profiles`. Every mutation is single-use,
-- surfaced for confirmation first, and audited.

begin;

create schema if not exists private;
grant usage on schema private to service_role;

-- 1) Flag internal admin-console channels ------------------------------------
alter table public.crm_channels
  add column if not exists is_admin_console boolean not null default false;

-- 2) Allowlist: WhatsApp number -> admin user --------------------------------
create table if not exists public.admin_agent_numbers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,            -- normalized "+55..." (see normalizePhone)
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_admin_agent_numbers_active
  on public.admin_agent_numbers (phone) where is_active;

alter table public.admin_agent_numbers enable row level security;
drop policy if exists admin_agent_numbers_admin_all on public.admin_agent_numbers;
create policy admin_agent_numbers_admin_all on public.admin_agent_numbers
  for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- 3) Pending confirmations (two-step writes): single-use, expiring -----------
create table if not exists public.admin_agent_pending_actions (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id text,
  conversation_id text,
  action text not null,                  -- 'transfer' | 'reserve_stock'
  params jsonb not null default '{}'::jsonb,
  summary text not null,                 -- human-readable confirmation prompt
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_admin_agent_pending_phone
  on public.admin_agent_pending_actions (phone, status);

-- RLS on with no policy for authenticated => only service_role reaches it.
alter table public.admin_agent_pending_actions enable row level security;

-- 4) Audit log of every agent action (read + write) --------------------------
create table if not exists public.admin_agent_audit_log (
  id uuid primary key default gen_random_uuid(),
  phone text,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  params jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null default 'ok'      -- 'ok' | 'error' | 'denied'
    check (status in ('ok', 'error', 'denied')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_agent_audit_created
  on public.admin_agent_audit_log (created_at desc);

alter table public.admin_agent_audit_log enable row level security;
drop policy if exists admin_agent_audit_admin_read on public.admin_agent_audit_log;
create policy admin_agent_audit_admin_read on public.admin_agent_audit_log
  for select using (public.current_role() = 'admin');

-- 5) Authorization guard shared by the write RPCs ----------------------------
create or replace function private.admin_agent_assert_admin(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if p_actor is null or not exists (
    select 1 from public.user_profiles up
    where up.id = p_actor and up.role = 'admin'
  ) then
    raise exception 'Ator não é administrador autorizado.'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.admin_agent_assert_admin(uuid) from public;

-- 6) Read: account balances (Conta Bancária / Cofre / Devedores) -------------
create or replace function public.admin_agent_account_balances()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(account, balance),
    '{}'::jsonb
  )
  from (
    select
      account,
      round(
        sum(case when type = 'IN' then amount else -amount end)::numeric,
        2
      ) as balance
    from public.transactions
    where account is not null
    group by account
  ) t;
$$;

revoke all on function public.admin_agent_account_balances() from public;
revoke all on function public.admin_agent_account_balances() from anon;
revoke all on function public.admin_agent_account_balances() from authenticated;
grant execute on function public.admin_agent_account_balances() to service_role;

-- 7) Write: transfer between Conta Bancária <-> Cofre ------------------------
-- Mirrors public.transfer_between_accounts but authorizes the resolved admin
-- actor instead of current_role() (the WhatsApp sender has no auth session).
create or replace function public.admin_agent_transfer(
  p_actor uuid,
  p_amount numeric,
  p_from text,
  p_to text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_from text := nullif(btrim(p_from), '');
  v_to text := nullif(btrim(p_to), '');
  v_group text := 'trf_' || replace(gen_random_uuid()::text, '-', '');
  v_when timestamptz := now();
  v_out text := 'trx_' || replace(gen_random_uuid()::text, '-', '');
  v_in text := 'trx_' || replace(gen_random_uuid()::text, '-', '');
begin
  perform private.admin_agent_assert_admin(p_actor);

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor válido.' using errcode = '22023';
  end if;
  if v_from not in ('Conta Bancária', 'Cofre')
     or v_to not in ('Conta Bancária', 'Cofre') then
    raise exception 'Conta de transferência inválida.' using errcode = '22023';
  end if;
  if v_from = v_to then
    raise exception 'Selecione contas diferentes para transferir.'
      using errcode = '22023';
  end if;

  insert into public.transactions
    (id, type, category, amount, date, description, account, transfer_group_id)
  values
    (v_out, 'OUT', 'Serviço', p_amount, v_when,
     'Transferência para ' || v_to, v_from, v_group),
    (v_in, 'IN', 'Aporte', p_amount, v_when,
     'Transferência de ' || v_from, v_to, v_group);

  return jsonb_build_object(
    'transferGroupId', v_group,
    'outTransactionId', v_out,
    'inTransactionId', v_in,
    'amount', p_amount,
    'from', v_from,
    'to', v_to
  );
end;
$$;

revoke all on function public.admin_agent_transfer(uuid, numeric, text, text) from public;
revoke all on function public.admin_agent_transfer(uuid, numeric, text, text) from anon;
revoke all on function public.admin_agent_transfer(uuid, numeric, text, text) from authenticated;
grant execute on function public.admin_agent_transfer(uuid, numeric, text, text) to service_role;

-- 8) Write: reserve a stock item --------------------------------------------
-- Wraps the existing public.reserve_stock_item with an admin-actor guard.
create or replace function public.admin_agent_reserve_stock(
  p_actor uuid,
  p_stock_item_id text,
  p_payload jsonb
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
  v_reservation := public.reserve_stock_item(p_stock_item_id, p_payload);
  return to_jsonb(v_reservation);
end;
$$;

revoke all on function public.admin_agent_reserve_stock(uuid, text, jsonb) from public;
revoke all on function public.admin_agent_reserve_stock(uuid, text, jsonb) from anon;
revoke all on function public.admin_agent_reserve_stock(uuid, text, jsonb) from authenticated;
grant execute on function public.admin_agent_reserve_stock(uuid, text, jsonb) to service_role;

notify pgrst, 'reload schema';

commit;
