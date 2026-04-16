begin;

create extension if not exists pgcrypto;

-- =====================================================
-- CRM Plus advanced modules + standalone auth handoff
-- Scope remains: providers uazapi | instagram_official
-- =====================================================

create table if not exists public.crm_automation_rules (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  channel_id uuid references public.crm_channels(id) on delete set null,
  description text not null,
  trigger_type text not null,
  message_content text not null,
  delay_minutes integer not null default 0,
  funnel_stage text,
  switch_to_human_handling boolean not null default false,
  message_variants jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_message_templates (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  channel_id uuid references public.crm_channels(id) on delete set null,
  name text not null,
  category text not null default 'general',
  content text not null,
  variables jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_custom_fields (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  key text not null,
  label text not null,
  field_type text not null default 'text',
  options jsonb not null default '{}'::jsonb,
  is_required boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, key),
  constraint chk_crm_custom_fields_type check (field_type in ('text', 'number', 'boolean', 'date', 'select', 'json'))
);

create table if not exists public.crm_lead_custom_field_values (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  lead_id text not null references public.crm_leads(id) on delete cascade,
  field_id uuid not null references public.crm_custom_fields(id) on delete cascade,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, field_id)
);

create table if not exists public.crm_attendance_scripts (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  name text not null,
  context text not null default 'general',
  script_content text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_instagram_media_snapshots (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  channel_id uuid not null references public.crm_channels(id) on delete cascade,
  media_id text not null,
  media_type text,
  surface text,
  caption text,
  permalink text,
  media_url text,
  thumbnail_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, media_id)
);

create table if not exists public.crm_instagram_comment_events (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  channel_id uuid not null references public.crm_channels(id) on delete cascade,
  lead_id text references public.crm_leads(id) on delete set null,
  conversation_id uuid references public.crm_conversations(id) on delete set null,
  source_message_id uuid references public.crm_messages(id) on delete set null,
  comment_id text not null,
  parent_comment_id text,
  media_id text,
  media_surface text,
  actor_igscoped_id text,
  actor_username text,
  direction text not null default 'inbound',
  event_type text not null default 'comment',
  reply_mode text,
  status text not null default 'received',
  content text,
  provider_message_id text,
  external_id text,
  webhook_payload jsonb,
  metadata jsonb not null default '{}'::jsonb,
  provider_error jsonb,
  event_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_crm_instagram_comment_direction check (direction in ('inbound', 'outbound')),
  constraint chk_crm_instagram_comment_status check (status in ('received', 'queued', 'replied', 'failed'))
);

create table if not exists public.crm_ui_preferences (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  user_id uuid not null,
  last_page text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create table if not exists public.crm_channel_store_links (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.crm_channels(id) on delete cascade,
  store_id text not null references public.stores(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, store_id)
);

create table if not exists public.crm_ai_agent_configs (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  name text not null,
  model text not null default 'gpt-4.1-mini',
  system_prompt text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_utm_config (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  source_key text not null,
  campaign_key text not null,
  medium_key text,
  default_channel_id uuid references public.crm_channels(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, source_key, campaign_key)
);

create table if not exists public.crm_meta_ads_groups (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  group_key uuid not null default gen_random_uuid(),
  creative_signature text not null,
  source_app text not null default 'instagram',
  auto_name text,
  status text not null default 'pending_review',
  sample_title text,
  sample_body text,
  sample_media_url text,
  sample_source_url text,
  sample_thumbnail_url text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  total_attributions integer not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_key),
  unique (store_id, creative_signature),
  constraint chk_crm_meta_ads_source_app check (source_app in ('instagram', 'facebook')),
  constraint chk_crm_meta_ads_status check (status in ('pending_review', 'approved', 'ignored', 'merged'))
);

create table if not exists public.crm_meta_ads_attributions (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  lead_id text references public.crm_leads(id) on delete set null,
  message_id uuid references public.crm_messages(id) on delete set null,
  group_key uuid not null references public.crm_meta_ads_groups(group_key) on delete cascade,
  source_app text not null default 'instagram',
  raw_source_id text,
  detected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (message_id),
  constraint chk_crm_meta_ads_attr_source_app check (source_app in ('instagram', 'facebook'))
);

create table if not exists public.crm_public_registration_links (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  lead_id text not null references public.crm_leads(id) on delete cascade,
  token text not null,
  slug text not null,
  utm_source text,
  utm_campaign text,
  is_active boolean not null default true,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token)
);

create table if not exists public.crm_auth_handoffs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null,
  store_id text,
  access_token text not null,
  refresh_token text not null,
  target_path text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- indexes
create index if not exists idx_crm_automation_rules_store_active on public.crm_automation_rules(store_id, is_active);
create index if not exists idx_crm_message_templates_store_active on public.crm_message_templates(store_id, is_active);
create index if not exists idx_crm_custom_fields_store_active on public.crm_custom_fields(store_id, is_active);
create index if not exists idx_crm_custom_values_lead on public.crm_lead_custom_field_values(lead_id);
create index if not exists idx_crm_attendance_scripts_store_active on public.crm_attendance_scripts(store_id, is_active);
create index if not exists idx_crm_ig_comment_events_store_created on public.crm_instagram_comment_events(store_id, event_created_at desc nulls last);
create index if not exists idx_crm_ui_preferences_store_user on public.crm_ui_preferences(store_id, user_id);
create index if not exists idx_crm_channel_store_links_store_active on public.crm_channel_store_links(store_id, is_active);
create index if not exists idx_crm_ai_agent_configs_store_active on public.crm_ai_agent_configs(store_id, is_active);
create index if not exists idx_crm_utm_config_store_active on public.crm_utm_config(store_id, is_active);
create index if not exists idx_crm_meta_ads_groups_store_status on public.crm_meta_ads_groups(store_id, status, last_seen_at desc nulls last);
create index if not exists idx_crm_meta_ads_attr_store_group on public.crm_meta_ads_attributions(store_id, group_key, detected_at desc);
create index if not exists idx_crm_public_reg_links_store_lead_created on public.crm_public_registration_links(store_id, lead_id, created_at desc);
create index if not exists idx_crm_auth_handoffs_code_expires on public.crm_auth_handoffs(code, expires_at);

-- updated_at triggers
create or replace function public.crm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_crm_automation_rules_set_updated_at on public.crm_automation_rules;
create trigger trg_crm_automation_rules_set_updated_at before update on public.crm_automation_rules
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_message_templates_set_updated_at on public.crm_message_templates;
create trigger trg_crm_message_templates_set_updated_at before update on public.crm_message_templates
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_custom_fields_set_updated_at on public.crm_custom_fields;
create trigger trg_crm_custom_fields_set_updated_at before update on public.crm_custom_fields
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_custom_values_set_updated_at on public.crm_lead_custom_field_values;
create trigger trg_crm_custom_values_set_updated_at before update on public.crm_lead_custom_field_values
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_attendance_scripts_set_updated_at on public.crm_attendance_scripts;
create trigger trg_crm_attendance_scripts_set_updated_at before update on public.crm_attendance_scripts
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_ig_media_set_updated_at on public.crm_instagram_media_snapshots;
create trigger trg_crm_ig_media_set_updated_at before update on public.crm_instagram_media_snapshots
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_ig_comments_set_updated_at on public.crm_instagram_comment_events;
create trigger trg_crm_ig_comments_set_updated_at before update on public.crm_instagram_comment_events
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_ui_preferences_set_updated_at on public.crm_ui_preferences;
create trigger trg_crm_ui_preferences_set_updated_at before update on public.crm_ui_preferences
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_channel_store_links_set_updated_at on public.crm_channel_store_links;
create trigger trg_crm_channel_store_links_set_updated_at before update on public.crm_channel_store_links
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_ai_agent_configs_set_updated_at on public.crm_ai_agent_configs;
create trigger trg_crm_ai_agent_configs_set_updated_at before update on public.crm_ai_agent_configs
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_utm_config_set_updated_at on public.crm_utm_config;
create trigger trg_crm_utm_config_set_updated_at before update on public.crm_utm_config
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_meta_ads_groups_set_updated_at on public.crm_meta_ads_groups;
create trigger trg_crm_meta_ads_groups_set_updated_at before update on public.crm_meta_ads_groups
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_public_reg_links_set_updated_at on public.crm_public_registration_links;
create trigger trg_crm_public_reg_links_set_updated_at before update on public.crm_public_registration_links
for each row execute function public.crm_set_updated_at();

-- keep channel-store links at least for own channel store
insert into public.crm_channel_store_links (channel_id, store_id, is_active)
select c.id, c.store_id, true
from public.crm_channels c
on conflict (channel_id, store_id) do update
set is_active = excluded.is_active,
    updated_at = now();

-- shared channel visibility policy
alter table public.crm_channels enable row level security;
drop policy if exists crm_channels_store_scope on public.crm_channels;
create policy crm_channels_store_scope on public.crm_channels
for all to authenticated
using (
  public.crm_can_access_store(store_id)
  or exists (
    select 1
    from public.crm_channel_store_links l
    where l.channel_id = public.crm_channels.id
      and l.is_active = true
      and public.crm_can_access_store(l.store_id)
  )
)
with check (
  public.crm_can_access_store(store_id)
);

-- RLS and grants
alter table public.crm_automation_rules enable row level security;
alter table public.crm_message_templates enable row level security;
alter table public.crm_custom_fields enable row level security;
alter table public.crm_lead_custom_field_values enable row level security;
alter table public.crm_attendance_scripts enable row level security;
alter table public.crm_instagram_media_snapshots enable row level security;
alter table public.crm_instagram_comment_events enable row level security;
alter table public.crm_ui_preferences enable row level security;
alter table public.crm_channel_store_links enable row level security;
alter table public.crm_ai_agent_configs enable row level security;
alter table public.crm_utm_config enable row level security;
alter table public.crm_meta_ads_groups enable row level security;
alter table public.crm_meta_ads_attributions enable row level security;
alter table public.crm_public_registration_links enable row level security;
alter table public.crm_auth_handoffs enable row level security;

drop policy if exists crm_automation_rules_store_scope on public.crm_automation_rules;
create policy crm_automation_rules_store_scope on public.crm_automation_rules
for all to authenticated
using (public.crm_can_access_store(store_id))
with check (public.crm_can_access_store(store_id));

drop policy if exists crm_message_templates_store_scope on public.crm_message_templates;
create policy crm_message_templates_store_scope on public.crm_message_templates
for all to authenticated
using (public.crm_can_access_store(store_id))
with check (public.crm_can_access_store(store_id));

drop policy if exists crm_custom_fields_store_scope on public.crm_custom_fields;
create policy crm_custom_fields_store_scope on public.crm_custom_fields
for all to authenticated
using (public.crm_can_access_store(store_id))
with check (public.crm_can_access_store(store_id));

drop policy if exists crm_custom_values_store_scope on public.crm_lead_custom_field_values;
create policy crm_custom_values_store_scope on public.crm_lead_custom_field_values
for all to authenticated
using (public.crm_can_access_store(store_id))
with check (public.crm_can_access_store(store_id));

drop policy if exists crm_attendance_scripts_store_scope on public.crm_attendance_scripts;
create policy crm_attendance_scripts_store_scope on public.crm_attendance_scripts
for all to authenticated
using (public.crm_can_access_store(store_id))
with check (public.crm_can_access_store(store_id));

drop policy if exists crm_ig_media_store_scope on public.crm_instagram_media_snapshots;
create policy crm_ig_media_store_scope on public.crm_instagram_media_snapshots
for all to authenticated
using (public.crm_can_access_store(store_id))
with check (public.crm_can_access_store(store_id));

drop policy if exists crm_ig_comments_store_scope on public.crm_instagram_comment_events;
create policy crm_ig_comments_store_scope on public.crm_instagram_comment_events
for all to authenticated
using (public.crm_can_access_store(store_id))
with check (public.crm_can_access_store(store_id));

drop policy if exists crm_ui_preferences_store_scope on public.crm_ui_preferences;
create policy crm_ui_preferences_store_scope on public.crm_ui_preferences
for all to authenticated
using (public.crm_can_access_store(store_id) and user_id = auth.uid())
with check (public.crm_can_access_store(store_id) and user_id = auth.uid());

drop policy if exists crm_channel_store_links_scope on public.crm_channel_store_links;
create policy crm_channel_store_links_scope on public.crm_channel_store_links
for all to authenticated
using (public.crm_can_access_store(store_id))
with check (public.crm_can_access_store(store_id));

drop policy if exists crm_ai_agent_configs_store_scope on public.crm_ai_agent_configs;
create policy crm_ai_agent_configs_store_scope on public.crm_ai_agent_configs
for all to authenticated
using (public.crm_can_access_store(store_id))
with check (public.crm_can_access_store(store_id));

drop policy if exists crm_utm_config_store_scope on public.crm_utm_config;
create policy crm_utm_config_store_scope on public.crm_utm_config
for all to authenticated
using (public.crm_can_access_store(store_id))
with check (public.crm_can_access_store(store_id));

drop policy if exists crm_meta_ads_groups_store_scope on public.crm_meta_ads_groups;
create policy crm_meta_ads_groups_store_scope on public.crm_meta_ads_groups
for all to authenticated
using (public.crm_can_access_store(store_id))
with check (public.crm_can_access_store(store_id));

drop policy if exists crm_meta_ads_attr_store_scope on public.crm_meta_ads_attributions;
create policy crm_meta_ads_attr_store_scope on public.crm_meta_ads_attributions
for all to authenticated
using (public.crm_can_access_store(store_id))
with check (public.crm_can_access_store(store_id));

drop policy if exists crm_public_reg_links_store_scope on public.crm_public_registration_links;
create policy crm_public_reg_links_store_scope on public.crm_public_registration_links
for all to authenticated
using (public.crm_can_access_store(store_id))
with check (public.crm_can_access_store(store_id));

drop policy if exists crm_auth_handoffs_block_all on public.crm_auth_handoffs;
create policy crm_auth_handoffs_block_all on public.crm_auth_handoffs
for all to authenticated
using (false)
with check (false);

grant all on public.crm_automation_rules to authenticated;
grant all on public.crm_message_templates to authenticated;
grant all on public.crm_custom_fields to authenticated;
grant all on public.crm_lead_custom_field_values to authenticated;
grant all on public.crm_attendance_scripts to authenticated;
grant all on public.crm_instagram_media_snapshots to authenticated;
grant all on public.crm_instagram_comment_events to authenticated;
grant all on public.crm_ui_preferences to authenticated;
grant all on public.crm_channel_store_links to authenticated;
grant all on public.crm_ai_agent_configs to authenticated;
grant all on public.crm_utm_config to authenticated;
grant all on public.crm_meta_ads_groups to authenticated;
grant all on public.crm_meta_ads_attributions to authenticated;
grant all on public.crm_public_registration_links to authenticated;

-- =====================================================
-- RPCs
-- =====================================================

create or replace function public.get_crm_statistics(p_store_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_leads bigint := 0;
  v_total_customers bigint := 0;
  v_open_conversations bigint := 0;
  v_sent_24h bigint := 0;
  v_inbound_24h bigint := 0;
  v_pipeline_value numeric := 0;
begin
  select count(*) into v_total_leads from public.crm_leads l where l.store_id = p_store_id;
  select count(*) into v_total_customers from public.crm_leads l where l.store_id = p_store_id and l.is_customer = true;

  select count(*) into v_open_conversations
  from public.crm_conversations c
  where c.store_id = p_store_id and c.status in ('open', 'ai_handling', 'human_handling');

  select count(*) into v_sent_24h
  from public.crm_messages m
  where m.store_id = p_store_id
    and m.direction = 'outbound'
    and m.created_at >= now() - interval '24 hours';

  select count(*) into v_inbound_24h
  from public.crm_messages m
  where m.store_id = p_store_id
    and m.direction = 'inbound'
    and m.created_at >= now() - interval '24 hours';

  select coalesce(sum(l.last_order_value), 0)
    into v_pipeline_value
  from public.crm_leads l
  where l.store_id = p_store_id
    and coalesce(l.funnel_stage, '') not in ('lost', 'won');

  return jsonb_build_object(
    'total_leads', v_total_leads,
    'total_customers', v_total_customers,
    'open_conversations', v_open_conversations,
    'sent_messages_24h', v_sent_24h,
    'inbound_messages_24h', v_inbound_24h,
    'conversion_rate', case when v_total_leads = 0 then 0 else round((v_total_customers::numeric / v_total_leads::numeric) * 100, 1) end,
    'pipeline_value', coalesce(v_pipeline_value, 0)
  );
end;
$$;

create or replace function public.get_crm_ads_dashboard(p_store_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_groups jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb)
    into v_groups
  from (
    select
      g.group_key,
      g.auto_name,
      g.status,
      g.source_app,
      g.first_seen_at,
      g.last_seen_at,
      count(a.id)::integer as attributions
    from public.crm_meta_ads_groups g
    left join public.crm_meta_ads_attributions a
      on a.group_key = g.group_key
     and a.store_id = g.store_id
    where g.store_id = p_store_id
    group by g.group_key, g.auto_name, g.status, g.source_app, g.first_seen_at, g.last_seen_at
    order by g.last_seen_at desc nulls last
    limit 200
  ) x;

  return jsonb_build_object('groups', v_groups);
end;
$$;

create or replace function public.get_store_custom_fields(p_store_id text)
returns setof public.crm_custom_fields
language sql
security definer
set search_path = public
as $$
  select *
  from public.crm_custom_fields
  where store_id = p_store_id
    and is_active = true
  order by created_at asc;
$$;

create or replace function public.get_lead_custom_values(p_lead_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(cf.key, v.value),
    '{}'::jsonb
  )
  from public.crm_lead_custom_field_values v
  join public.crm_custom_fields cf on cf.id = v.field_id
  where v.lead_id = p_lead_id;
$$;

create or replace function public.set_lead_custom_field(
  p_lead_id text,
  p_field_id uuid,
  p_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id text;
begin
  if p_lead_id is null or p_field_id is null then
    return jsonb_build_object('success', false, 'error', 'lead_id e field_id são obrigatórios');
  end if;

  select l.store_id into v_store_id
  from public.crm_leads l
  where l.id = p_lead_id
  limit 1;

  if v_store_id is null then
    return jsonb_build_object('success', false, 'error', 'Lead não encontrado');
  end if;

  insert into public.crm_lead_custom_field_values (store_id, lead_id, field_id, value)
  values (v_store_id, p_lead_id, p_field_id, coalesce(p_value, '{}'::jsonb))
  on conflict (lead_id, field_id)
  do update set
    value = excluded.value,
    updated_at = now();

  return jsonb_build_object('success', true, 'lead_id', p_lead_id, 'field_id', p_field_id);
end;
$$;

create or replace function public.prepare_broadcast_recipients(p_broadcast_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_broadcast record;
  v_inserted integer := 0;
begin
  select * into v_broadcast
  from public.crm_broadcasts b
  where b.id = p_broadcast_id
  limit 1;

  if not found then
    return 0;
  end if;

  insert into public.crm_broadcast_recipients (broadcast_id, store_id, lead_id, channel_id, status)
  select
    v_broadcast.id,
    v_broadcast.store_id,
    l.id,
    coalesce(v_broadcast.channel_id, l.source_channel_id),
    'pending'
  from public.crm_leads l
  where l.store_id = v_broadcast.store_id
    and (
      (v_broadcast.recipient_filters ->> 'funnel_stage') is null
      or l.funnel_stage = (v_broadcast.recipient_filters ->> 'funnel_stage')
    )
    and (
      (v_broadcast.recipient_filters ? 'is_customer') = false
      or l.is_customer = ((v_broadcast.recipient_filters ->> 'is_customer')::boolean)
    )
  on conflict (broadcast_id, lead_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.get_broadcast_stats(p_broadcast_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_sent integer := 0;
  v_failed integer := 0;
  v_pending integer := 0;
begin
  select
    count(*)::integer,
    count(*) filter (where status = 'sent')::integer,
    count(*) filter (where status = 'failed')::integer,
    count(*) filter (where status = 'pending')::integer
  into v_total, v_sent, v_failed, v_pending
  from public.crm_broadcast_recipients
  where broadcast_id = p_broadcast_id;

  return jsonb_build_object(
    'total', v_total,
    'sent', v_sent,
    'failed', v_failed,
    'pending', v_pending
  );
end;
$$;

create or replace function public.cancel_broadcast(p_broadcast_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.crm_broadcasts
  set status = 'canceled', updated_at = now()
  where id = p_broadcast_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Broadcast não encontrado');
  end if;

  update public.crm_broadcast_recipients
  set status = 'skipped', error_message = 'broadcast_canceled'
  where broadcast_id = p_broadcast_id
    and status = 'pending';

  return jsonb_build_object('success', true, 'broadcast_id', p_broadcast_id);
end;
$$;

create or replace function public.add_lead_note(
  p_lead_id text,
  p_note text,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_store_id text;
  v_message_id uuid;
begin
  if p_lead_id is null or btrim(p_note) = '' then
    raise exception 'lead_id and note are required';
  end if;

  select l.store_id into v_store_id
  from public.crm_leads l
  where l.id = p_lead_id
  limit 1;

  if v_store_id is null then
    raise exception 'Lead not found';
  end if;

  select c.id into v_conversation_id
  from public.crm_conversations c
  where c.lead_id = p_lead_id
  order by c.updated_at desc nulls last
  limit 1;

  if v_conversation_id is null then
    insert into public.crm_conversations (store_id, lead_id, status, ai_enabled)
    values (v_store_id, p_lead_id, 'open', true)
    returning id into v_conversation_id;
  end if;

  insert into public.crm_messages (
    conversation_id,
    lead_id,
    store_id,
    direction,
    sender_type,
    content,
    status,
    webhook_payload
  )
  values (
    v_conversation_id,
    p_lead_id,
    v_store_id,
    'outbound',
    'system',
    p_note,
    'sent',
    jsonb_build_object('source', 'add_lead_note', 'created_by', p_created_by)
  )
  returning id into v_message_id;

  return v_message_id;
end;
$$;

create or replace function public.bulk_update_leads(
  p_store_id text,
  p_filters jsonb,
  p_patch jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
  v_stage text := nullif(btrim(coalesce(p_patch ->> 'funnel_stage', '')), '');
  v_intent text := nullif(btrim(coalesce(p_patch ->> 'intent', '')), '');
  v_customer boolean;
begin
  if p_store_id is null or btrim(p_store_id) = '' then
    return 0;
  end if;

  if p_patch ? 'is_customer' then
    v_customer := (p_patch ->> 'is_customer')::boolean;
  end if;

  update public.crm_leads l
  set
    funnel_stage = coalesce(v_stage, l.funnel_stage),
    intent = coalesce(v_intent, l.intent),
    is_customer = coalesce(v_customer, l.is_customer),
    updated_at = now(),
    last_interaction_at = now()
  where l.store_id = p_store_id
    and (
      (p_filters ->> 'funnel_stage') is null
      or l.funnel_stage = (p_filters ->> 'funnel_stage')
    )
    and (
      (p_filters ->> 'source_channel_id') is null
      or l.source_channel_id::text = (p_filters ->> 'source_channel_id')
    )
    and (
      (p_filters ->> 'search') is null
      or l.name ilike '%' || (p_filters ->> 'search') || '%'
      or l.phone ilike '%' || (p_filters ->> 'search') || '%'
    );

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public.transfer_lead_store(
  p_lead_id text,
  p_to_store_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_store text;
begin
  select l.store_id into v_from_store
  from public.crm_leads l
  where l.id = p_lead_id
  limit 1;

  if v_from_store is null then
    return jsonb_build_object('success', false, 'error', 'Lead não encontrado');
  end if;

  update public.crm_leads
  set store_id = p_to_store_id,
      updated_at = now()
  where id = p_lead_id;

  update public.crm_conversations
  set store_id = p_to_store_id,
      updated_at = now()
  where lead_id = p_lead_id;

  update public.crm_messages
  set store_id = p_to_store_id
  where lead_id = p_lead_id;

  update public.crm_event_log
  set store_id = p_to_store_id
  where lead_id = p_lead_id;

  return jsonb_build_object('success', true, 'from_store_id', v_from_store, 'to_store_id', p_to_store_id);
end;
$$;

create or replace function public.update_campaign_delivery_metrics(
  p_group_key uuid,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.crm_meta_ads_groups g
  set
    metrics = coalesce(g.metrics, '{}'::jsonb) || coalesce(p_payload, '{}'::jsonb),
    updated_at = now()
  where g.group_key = p_group_key;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Grupo não encontrado');
  end if;

  return jsonb_build_object('success', true, 'group_key', p_group_key);
end;
$$;

create or replace function public.preview_campaign_audience(
  p_store_id text,
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 100
)
returns table(
  lead_id text,
  name text,
  phone text,
  funnel_stage text,
  is_customer boolean
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.name,
    l.phone,
    l.funnel_stage,
    l.is_customer
  from public.crm_leads l
  where l.store_id = p_store_id
    and (
      (p_filters ->> 'funnel_stage') is null
      or l.funnel_stage = (p_filters ->> 'funnel_stage')
    )
    and (
      (p_filters ? 'is_customer') = false
      or l.is_customer = ((p_filters ->> 'is_customer')::boolean)
    )
  order by l.last_interaction_at desc nulls last
  limit greatest(coalesce(p_limit, 100), 1);
$$;

create or replace function public.sync_crm_campaign_tag_mappings(
  p_store_id text,
  p_mappings jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_value jsonb;
  v_source text;
  v_campaign text;
  v_medium text;
begin
  for v_key, v_value in select * from jsonb_each(coalesce(p_mappings, '{}'::jsonb))
  loop
    v_source := nullif(btrim(coalesce(v_value ->> 'source_key', v_key)), '');
    v_campaign := nullif(btrim(coalesce(v_value ->> 'campaign_key', v_key)), '');
    v_medium := nullif(btrim(coalesce(v_value ->> 'medium_key', '')), '');

    if v_source is null or v_campaign is null then
      continue;
    end if;

    insert into public.crm_utm_config (store_id, source_key, campaign_key, medium_key, is_active)
    values (p_store_id, v_source, v_campaign, v_medium, true)
    on conflict (store_id, source_key, campaign_key)
    do update set
      medium_key = excluded.medium_key,
      is_active = true,
      updated_at = now();
  end loop;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.test_webhook_subscription(p_subscription_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
begin
  select * into v_sub
  from public.crm_webhook_subscriptions s
  where s.id = p_subscription_id
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Webhook subscription não encontrada');
  end if;

  insert into public.crm_event_log (
    store_id,
    event_type,
    payload,
    is_outbound,
    webhook_url,
    sent,
    retry_count,
    processed,
    subscription_id
  )
  values (
    coalesce(v_sub.store_id, ''),
    'crm_webhook_test',
    jsonb_build_object('subscription_id', p_subscription_id, 'message', 'test ping'),
    true,
    v_sub.url,
    false,
    0,
    false,
    p_subscription_id
  );

  return jsonb_build_object('success', true, 'subscription_id', p_subscription_id);
end;
$$;

create or replace function public.get_cashback_summary(p_store_id text)
returns table(
  lead_id text,
  lead_name text,
  lifetime_value numeric,
  purchase_count integer,
  cashback_available numeric
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.name,
    coalesce(l.lifetime_value, 0),
    coalesce(l.purchase_count, 0),
    round(coalesce(l.lifetime_value, 0) * 0.03, 2) as cashback_available
  from public.crm_leads l
  where l.store_id = p_store_id
    and l.is_customer = true
  order by l.lifetime_value desc nulls last
  limit 300;
$$;

grant execute on function public.get_crm_statistics(text) to authenticated;
grant execute on function public.get_crm_ads_dashboard(text) to authenticated;
grant execute on function public.get_store_custom_fields(text) to authenticated;
grant execute on function public.get_lead_custom_values(text) to authenticated;
grant execute on function public.set_lead_custom_field(text, uuid, jsonb) to authenticated;
grant execute on function public.prepare_broadcast_recipients(uuid) to authenticated;
grant execute on function public.get_broadcast_stats(uuid) to authenticated;
grant execute on function public.cancel_broadcast(uuid) to authenticated;
grant execute on function public.add_lead_note(text, text, uuid) to authenticated;
grant execute on function public.bulk_update_leads(text, jsonb, jsonb) to authenticated;
grant execute on function public.transfer_lead_store(text, text) to authenticated;
grant execute on function public.update_campaign_delivery_metrics(uuid, jsonb) to authenticated;
grant execute on function public.preview_campaign_audience(text, jsonb, integer) to authenticated;
grant execute on function public.sync_crm_campaign_tag_mappings(text, jsonb) to authenticated;
grant execute on function public.test_webhook_subscription(uuid) to authenticated;
grant execute on function public.get_cashback_summary(text) to authenticated;

notify pgrst, 'reload schema';

commit;
