begin;

alter table public.crm_channels
  add column if not exists ai_resume_webhook_url text;

alter table public.crm_leads
  add column if not exists conversation_status text,
  add column if not exists attendance_owner text,
  add column if not exists handoff_at timestamptz,
  add column if not exists human_started_at timestamptz,
  add column if not exists last_agent_type text;

update public.crm_leads
set
  attendance_owner = coalesce(nullif(btrim(attendance_owner), ''), 'ia'),
  conversation_status = coalesce(nullif(btrim(conversation_status), ''), 'em_atendimento_ia'),
  last_agent_type = coalesce(nullif(btrim(last_agent_type), ''), 'evento')
where attendance_owner is null
   or btrim(attendance_owner) = ''
   or conversation_status is null
   or btrim(conversation_status) = ''
   or last_agent_type is null
   or btrim(last_agent_type) = '';

alter table public.crm_leads drop constraint if exists chk_crm_leads_conversation_status;
alter table public.crm_leads add constraint chk_crm_leads_conversation_status check (
  conversation_status is null or conversation_status in (
    'em_atendimento_ia',
    'em_atendimento_humano',
    'transferencia_pendente',
    'encerrado'
  )
);

alter table public.crm_leads drop constraint if exists chk_crm_leads_attendance_owner;
alter table public.crm_leads add constraint chk_crm_leads_attendance_owner check (
  attendance_owner is null or attendance_owner in ('ia', 'humano_loja', 'tecnico_especialista')
);

alter table public.crm_leads drop constraint if exists chk_crm_leads_last_agent_type;
alter table public.crm_leads add constraint chk_crm_leads_last_agent_type check (
  last_agent_type is null or last_agent_type in ('classifier', 'alana', 'evento', 'humano')
);

alter table public.crm_messages drop constraint if exists crm_messages_sender_type_check;
alter table public.crm_messages add constraint crm_messages_sender_type_check check (
  sender_type in ('customer', 'human', 'ai', 'ai_inbound', 'system')
);

create table if not exists public.crm_ai_entry_settings (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  is_enabled boolean not null default false,
  fallback_mode text not null default 'keep_current',
  reopen_hours integer not null default 24,
  business_hours jsonb not null default '{}'::jsonb,
  special_business_hours jsonb not null default '{}'::jsonb,
  rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id),
  constraint crm_ai_entry_settings_fallback_mode_check check (fallback_mode in ('keep_current', 'force_human', 'force_ai')),
  constraint crm_ai_entry_settings_reopen_hours_check check (reopen_hours between 1 and 720)
);

alter table public.crm_ai_agent_configs
  add column if not exists endpoint_url text,
  add column if not exists behavior_modes text[] not null default '{}'::text[],
  add column if not exists auto_send_response boolean not null default false,
  add column if not exists require_human_approval boolean not null default true,
  add column if not exists trigger_conditions jsonb not null default '{}'::jsonb,
  add column if not exists channel_ids uuid[] not null default '{}'::uuid[],
  add column if not exists total_invocations integer not null default 0,
  add column if not exists total_successes integer not null default 0,
  add column if not exists total_failures integer not null default 0,
  add column if not exists routing_mode text not null default 'priority',
  add column if not exists routing_priority integer not null default 100,
  add column if not exists traffic_weight integer not null default 100;

create table if not exists public.crm_ai_agent_invocations (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  agent_config_id uuid references public.crm_ai_agent_configs(id) on delete set null,
  routing_rule_id uuid,
  source text not null default 'inbound',
  status text not null default 'success',
  routing_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint crm_ai_agent_invocations_source_check check (source in ('manual_test', 'inbound', 'manual_handoff')),
  constraint crm_ai_agent_invocations_status_check check (status in ('success', 'failure'))
);

create index if not exists idx_crm_channels_ai_resume_webhook
  on public.crm_channels (store_id)
  where ai_resume_webhook_url is not null and btrim(ai_resume_webhook_url) <> '';

create index if not exists idx_crm_ai_entry_settings_store_id
  on public.crm_ai_entry_settings(store_id);

create index if not exists idx_crm_ai_agent_invocations_agent_created
  on public.crm_ai_agent_invocations(agent_config_id, created_at desc);

create index if not exists idx_crm_ai_agent_invocations_store_created
  on public.crm_ai_agent_invocations(store_id, created_at desc);

alter table public.crm_ai_entry_settings enable row level security;
alter table public.crm_ai_agent_invocations enable row level security;

drop policy if exists crm_ai_entry_settings_store_scope on public.crm_ai_entry_settings;
create policy crm_ai_entry_settings_store_scope on public.crm_ai_entry_settings
  for all to authenticated
  using (public.crm_can_access_store(store_id))
  with check (public.crm_can_access_store(store_id));

drop policy if exists crm_ai_agent_invocations_store_read on public.crm_ai_agent_invocations;
create policy crm_ai_agent_invocations_store_read on public.crm_ai_agent_invocations
  for select to authenticated
  using (public.crm_can_access_store(store_id));

drop policy if exists crm_ai_agent_invocations_store_insert on public.crm_ai_agent_invocations;
create policy crm_ai_agent_invocations_store_insert on public.crm_ai_agent_invocations
  for insert to authenticated
  with check (public.crm_can_access_store(store_id));

grant all on public.crm_ai_entry_settings to authenticated;
grant select, insert on public.crm_ai_agent_invocations to authenticated;

create or replace function public.crm_sync_lead_attendance_from_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_owner text;
  v_last_agent text;
begin
  v_status := case
    when new.status = 'ai_handling' then 'em_atendimento_ia'
    when new.status = 'human_handling' then 'em_atendimento_humano'
    when new.status = 'closed' then 'encerrado'
    else null
  end;

  v_owner := case
    when new.status = 'ai_handling' then 'ia'
    when new.status = 'human_handling' then 'humano_loja'
    else null
  end;

  v_last_agent := case
    when new.status = 'ai_handling' then 'alana'
    when new.status = 'human_handling' then 'humano'
    else null
  end;

  update public.crm_leads l
  set
    conversation_status = coalesce(v_status, l.conversation_status),
    attendance_owner = coalesce(v_owner, l.attendance_owner),
    handoff_at = case
      when new.status = 'human_handling' and tg_op = 'UPDATE' and old.status = 'ai_handling' then coalesce(l.handoff_at, now())
      when new.status = 'ai_handling' then now()
      else l.handoff_at
    end,
    human_started_at = case
      when new.status = 'human_handling' then coalesce(l.human_started_at, now())
      else l.human_started_at
    end,
    last_agent_type = coalesce(v_last_agent, l.last_agent_type),
    updated_at = now()
  where l.id = new.lead_id;

  return new;
end;
$$;

drop trigger if exists trg_crm_sync_lead_attendance_from_conversation on public.crm_conversations;
create trigger trg_crm_sync_lead_attendance_from_conversation
after insert or update of status, ai_enabled on public.crm_conversations
for each row execute function public.crm_sync_lead_attendance_from_conversation();

commit;
