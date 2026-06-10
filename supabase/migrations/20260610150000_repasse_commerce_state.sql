begin;

alter table public.lead_state
  add column if not exists commerce_state jsonb not null default '{}'::jsonb,
  add column if not exists tradein_assessment jsonb not null default '{}'::jsonb,
  add column if not exists quote_versions jsonb not null default '[]'::jsonb,
  add column if not exists state_version bigint not null default 0;

create table if not exists public.ai_turn_events (
  id uuid primary key default gen_random_uuid(),
  turn_id text not null,
  conversation_id uuid references public.crm_conversations(id) on delete set null,
  lead_id text not null references public.crm_leads(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  action text not null,
  outcome text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  stage_timings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (turn_id, action)
);

create index if not exists idx_ai_turn_events_lead_created
  on public.ai_turn_events (lead_id, created_at desc);

create index if not exists idx_ai_turn_events_conversation_created
  on public.ai_turn_events (conversation_id, created_at desc)
  where conversation_id is not null;

alter table public.ai_turn_events enable row level security;

drop policy if exists ai_turn_events_store_scope_select on public.ai_turn_events;
create policy ai_turn_events_store_scope_select on public.ai_turn_events
  for select to authenticated
  using (public.crm_can_access_store(store_id));

grant select on public.ai_turn_events to authenticated;

create or replace function public.upsert_repasse_commerce_state(
  p_lead_id text,
  p_expected_version bigint,
  p_state jsonb,
  p_tradein jsonb default '{}'::jsonb,
  p_quotes jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.lead_state%rowtype;
  v_current_version bigint;
begin
  if nullif(btrim(coalesce(p_lead_id, '')), '') is null then
    raise exception 'lead_id is required';
  end if;

  if not (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.crm_leads l
      where l.id = p_lead_id
        and public.crm_can_access_store(l.store_id)
    )
  ) then
    raise exception 'lead not found or access denied';
  end if;

  insert into public.lead_state (lead_id)
  values (p_lead_id)
  on conflict (lead_id) do nothing;

  select state_version
  into v_current_version
  from public.lead_state
  where lead_id = p_lead_id
  for update;

  if p_expected_version is not null and p_expected_version <> v_current_version then
    raise exception 'stale commerce state version: expected %, current %', p_expected_version, v_current_version
      using errcode = '40001';
  end if;

  update public.lead_state
  set commerce_state = coalesce(p_state, '{}'::jsonb),
      tradein_assessment = coalesce(p_tradein, '{}'::jsonb),
      quote_versions = coalesce(p_quotes, '[]'::jsonb),
      state_version = state_version + 1
  where lead_id = p_lead_id
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.record_ai_turn_event(
  p_turn_id text,
  p_lead_id text,
  p_conversation_id uuid,
  p_action text,
  p_outcome text default null,
  p_duration_ms integer default null,
  p_stage_timings jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_result public.ai_turn_events%rowtype;
begin
  select store_id into v_store_id
  from public.crm_leads
  where id = p_lead_id;

  if v_store_id is null then
    raise exception 'lead not found';
  end if;

  if not (auth.role() = 'service_role' or public.crm_can_access_store(v_store_id)) then
    raise exception 'lead not found or access denied';
  end if;

  insert into public.ai_turn_events (
    turn_id,
    conversation_id,
    lead_id,
    store_id,
    action,
    outcome,
    duration_ms,
    stage_timings,
    metadata
  )
  values (
    nullif(btrim(coalesce(p_turn_id, '')), ''),
    p_conversation_id,
    p_lead_id,
    v_store_id,
    nullif(btrim(coalesce(p_action, '')), ''),
    nullif(btrim(coalesce(p_outcome, '')), ''),
    p_duration_ms,
    coalesce(p_stage_timings, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (turn_id, action) do update
  set outcome = excluded.outcome,
      duration_ms = excluded.duration_ms,
      stage_timings = excluded.stage_timings,
      metadata = excluded.metadata
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

revoke all on function public.upsert_repasse_commerce_state(text, bigint, jsonb, jsonb, jsonb) from public;
revoke all on function public.record_ai_turn_event(text, text, uuid, text, text, integer, jsonb, jsonb) from public;
grant execute on function public.upsert_repasse_commerce_state(text, bigint, jsonb, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.record_ai_turn_event(text, text, uuid, text, text, integer, jsonb, jsonb) to authenticated, service_role;

commit;
