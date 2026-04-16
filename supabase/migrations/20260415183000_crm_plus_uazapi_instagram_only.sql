begin;

-- =====================================================
-- CRM Plus convergence migration
-- Scope locked to providers: uazapi | instagram_official
-- =====================================================

-- -------------------------------------
-- Helpers
-- -------------------------------------

create extension if not exists pgcrypto;

create or replace function public.normalize_phone(phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g');
  if v_digits = '' then
    return null;
  end if;

  if left(v_digits, 2) <> '55' then
    v_digits := '55' || v_digits;
  end if;

  return '+' || v_digits;
end;
$$;

create or replace function public.crm_identity_fallback_phone(
  p_identity_type text,
  p_identity_value text
)
returns text
language sql
immutable
as $$
  select '+55' || substr(translate(md5(lower(coalesce(p_identity_type, '') || ':' || coalesce(p_identity_value, ''))), 'abcdef', '123456'), 1, 10);
$$;

create or replace function public.crm_jsonb_to_text_array(p_value jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(
    array(
      select distinct trimmed
      from (
        select btrim(value) as trimmed
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(coalesce(p_value, '[]'::jsonb)) = 'array' then coalesce(p_value, '[]'::jsonb)
            else '[]'::jsonb
          end
        ) as value
      ) normalized
      where trimmed <> ''
    ),
    array[]::text[]
  );
$$;

create or replace function public.current_store_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.store_id
  from public.user_profiles up
  join public.sellers s on s.id = up.seller_id
  where up.id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_store_id() from public;
grant execute on function public.current_store_id() to authenticated;

create or replace function public.crm_can_access_store(p_store_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_role() = 'admin' then true
    when public.current_role() = 'seller' then p_store_id is not null and p_store_id = public.current_store_id()
    else false
  end;
$$;

revoke all on function public.crm_can_access_store(text) from public;
grant execute on function public.crm_can_access_store(text) to authenticated;

create or replace function public.crm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -------------------------------------
-- Core tables (create if missing)
-- -------------------------------------

create table if not exists public.crm_funnels (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  channel_id uuid,
  name text not null,
  description text,
  stages jsonb not null default '[]'::jsonb,
  funnel_type text not null default 'sales' check (funnel_type in ('sales', 'post_sale')),
  is_default boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.crm_funnel_stages (
  id text primary key,
  funnel_type text not null check (funnel_type in ('sales', 'post_sale')),
  name text not null,
  color text not null default '#64748B',
  "order" integer not null default 0,
  is_won boolean default false,
  is_lost boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.crm_channels (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  name text not null,
  phone_number text not null default '',
  api_endpoint text,
  api_key text,
  provider text not null default 'uazapi',
  uaz_subdomain text not null default 'api',
  webhook_secret text,
  instagram_verify_token text,
  instagram_ig_user_id text,
  instagram_username text,
  instagram_access_token text,
  use_for_manual boolean not null default true,
  use_for_automation boolean not null default true,
  inbound_funnel_id uuid,
  inbound_funnel_stage text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.crm_leads (
  id text primary key,
  store_id text not null references public.stores(id) on delete cascade,
  customer_id text references public.customers(id) on delete set null,
  phone text not null,
  phone_normalized text generated always as (public.normalize_phone(phone)) stored,
  name text,
  email text,
  avatar_url text,
  avatar_lead_updated boolean default false,
  contact_id text,
  entity_id text,
  source_channel_id uuid references public.crm_channels(id) on delete set null,
  utm_source text,
  utm_campaign text,
  utm_medium text,
  utm_content text,
  utm_term text,
  first_message text,
  funnel_id uuid references public.crm_funnels(id) on delete set null,
  funnel_stage text default 'new_lead',
  lifetime_value numeric default 0,
  is_customer boolean default false,
  tags text[] default '{}'::text[],
  intent text,
  last_auto_followup_at timestamptz,
  purchase_count integer not null default 0,
  last_purchase_at timestamptz,
  last_order_id text,
  last_order_at timestamptz,
  last_order_value numeric,
  last_order_summary text,
  first_contact_at timestamptz default now(),
  last_message_at timestamptz,
  last_interaction_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.crm_lead_identities (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references public.crm_leads(id) on delete cascade,
  store_id text not null,
  identity_type text not null,
  identity_value text not null,
  identity_value_normalized text generated always as (lower(btrim(identity_value))) stored,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_crm_lead_identities_type
    check (identity_type in ('phone', 'email', 'instagram_igsid', 'instagram_username'))
);

create table if not exists public.crm_conversations (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  lead_id text not null references public.crm_leads(id) on delete cascade,
  channel_id uuid references public.crm_channels(id) on delete set null,
  talk_id text,
  status text default 'open' check (status in ('open', 'ai_handling', 'human_handling', 'closed')),
  assigned_to uuid,
  ai_enabled boolean default true,
  unread_count integer default 0,
  message_count integer default 0,
  last_message_at timestamptz,
  last_customer_message_at timestamptz,
  last_response_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.crm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.crm_conversations(id) on delete cascade,
  lead_id text references public.crm_leads(id) on delete set null,
  store_id text,
  channel_id uuid references public.crm_channels(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('customer', 'human', 'ai', 'system')),
  content text,
  media_url text,
  media_type text,
  external_id text,
  provider_message_id text,
  event_origin text,
  provider_error jsonb,
  webhook_payload jsonb,
  status text default 'pending' check (status in ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.crm_lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references public.crm_leads(id) on delete cascade,
  store_id text,
  from_stage text,
  to_stage text,
  changed_by uuid,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.crm_scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references public.crm_leads(id) on delete cascade,
  conversation_id uuid references public.crm_conversations(id) on delete cascade,
  automation_rule_id uuid,
  channel_id uuid references public.crm_channels(id) on delete set null,
  store_id text,
  message_content text,
  media_url text,
  media_type text,
  metadata jsonb default '{}'::jsonb,
  scheduled_for timestamptz not null,
  status text default 'pending',
  error_message text,
  retry_count integer default 0,
  sent_at timestamptz,
  message_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.crm_event_log (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  event_type text not null,
  payload jsonb,
  is_outbound boolean default false,
  webhook_url text,
  sent boolean default false,
  sent_at timestamptz,
  error_message text,
  retry_count integer default 0,
  processed boolean default false,
  processed_at timestamptz,
  subscription_id uuid,
  channel_id uuid,
  lead_id text,
  conversation_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.crm_webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id text,
  name text not null,
  url text not null,
  secret text,
  subscribed_events text[] not null default '{}'::text[],
  is_active boolean not null default true,
  failure_count integer not null default 0,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_broadcasts (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  channel_id uuid references public.crm_channels(id) on delete set null,
  name text not null,
  message_template text not null,
  recipient_filters jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'processing', 'completed', 'failed', 'canceled')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.crm_broadcasts(id) on delete cascade,
  store_id text not null,
  lead_id text not null references public.crm_leads(id) on delete cascade,
  conversation_id uuid references public.crm_conversations(id) on delete set null,
  channel_id uuid references public.crm_channels(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error_message text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (broadcast_id, lead_id)
);

create table if not exists public.crm_dispatch_runtime (
  id text primary key,
  worker_name text not null unique,
  last_run_at timestamptz,
  lock_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- -------------------------------------
-- Convergence alters
-- -------------------------------------

alter table public.crm_channels
  add column if not exists provider text,
  add column if not exists uaz_subdomain text,
  add column if not exists webhook_secret text,
  add column if not exists instagram_verify_token text,
  add column if not exists instagram_ig_user_id text,
  add column if not exists instagram_username text,
  add column if not exists instagram_access_token text,
  add column if not exists use_for_manual boolean,
  add column if not exists use_for_automation boolean,
  add column if not exists inbound_funnel_id uuid,
  add column if not exists inbound_funnel_stage text;

alter table public.crm_channels
  drop column if exists phone_number_evolution,
  drop column if exists instance_name;

update public.crm_channels
set
  provider = coalesce(nullif(btrim(provider), ''), 'uazapi'),
  uaz_subdomain = coalesce(nullif(btrim(uaz_subdomain), ''), 'api'),
  use_for_manual = coalesce(use_for_manual, true),
  use_for_automation = coalesce(use_for_automation, true)
where true;

do $$
begin
  if exists (
    select 1
    from public.crm_channels
    where provider not in ('uazapi', 'instagram_official')
  ) then
    raise exception 'Unsupported CRM provider found. Allowed providers: uazapi, instagram_official.';
  end if;
end $$;

alter table public.crm_channels
  alter column provider set not null,
  alter column provider set default 'uazapi',
  alter column uaz_subdomain set not null,
  alter column uaz_subdomain set default 'api',
  alter column use_for_manual set not null,
  alter column use_for_manual set default true,
  alter column use_for_automation set not null,
  alter column use_for_automation set default true;

alter table public.crm_channels drop constraint if exists crm_channels_provider_check;
alter table public.crm_channels
  add constraint crm_channels_provider_check
  check (provider in ('uazapi', 'instagram_official'));

alter table public.crm_channels drop constraint if exists crm_channels_uaz_subdomain_check;
alter table public.crm_channels
  add constraint crm_channels_uaz_subdomain_check
  check (uaz_subdomain in ('api', 'free'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'crm_channels_inbound_funnel_id_fkey'
      and conrelid = 'public.crm_channels'::regclass
  ) then
    alter table public.crm_channels
      add constraint crm_channels_inbound_funnel_id_fkey
      foreign key (inbound_funnel_id) references public.crm_funnels(id) on delete set null;
  end if;
end $$;

alter table public.crm_leads
  add column if not exists purchase_count integer,
  add column if not exists last_purchase_at timestamptz,
  add column if not exists last_order_id text,
  add column if not exists last_order_at timestamptz,
  add column if not exists last_order_value numeric,
  add column if not exists last_order_summary text;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'crm_leads'
      and column_name = 'phone_normalized'
  ) then
    alter table public.crm_leads
      add column phone_normalized text generated always as (public.normalize_phone(phone)) stored;
  end if;
end $$;

update public.crm_leads
set purchase_count = coalesce(purchase_count, 0)
where purchase_count is null;

alter table public.crm_leads
  alter column purchase_count set not null,
  alter column purchase_count set default 0;

alter table public.crm_messages
  add column if not exists lead_id text,
  add column if not exists provider_message_id text,
  add column if not exists event_origin text,
  add column if not exists provider_error jsonb;

alter table public.crm_event_log
  add column if not exists webhook_url text,
  add column if not exists sent boolean,
  add column if not exists sent_at timestamptz,
  add column if not exists error_message text,
  add column if not exists retry_count integer,
  add column if not exists processed boolean,
  add column if not exists processed_at timestamptz,
  add column if not exists subscription_id uuid,
  add column if not exists channel_id uuid,
  add column if not exists lead_id text,
  add column if not exists conversation_id uuid;

update public.crm_event_log
set
  sent = coalesce(sent, false),
  retry_count = coalesce(retry_count, 0),
  processed = coalesce(processed, false)
where true;

alter table public.crm_event_log
  alter column sent set default false,
  alter column retry_count set default 0,
  alter column processed set default false;

alter table public.crm_scheduled_messages
  add column if not exists store_id text,
  add column if not exists metadata jsonb,
  add column if not exists updated_at timestamptz;

update public.crm_scheduled_messages
set
  metadata = coalesce(metadata, '{}'::jsonb),
  updated_at = coalesce(updated_at, created_at, now())
where true;

alter table public.crm_scheduled_messages
  alter column metadata set default '{}'::jsonb,
  alter column updated_at set default now();

alter table public.crm_lead_stage_history
  add column if not exists store_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'crm_messages_lead_id_fkey'
      and conrelid = 'public.crm_messages'::regclass
  ) then
    alter table public.crm_messages
      add constraint crm_messages_lead_id_fkey
      foreign key (lead_id) references public.crm_leads(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'crm_event_log_subscription_id_fkey'
      and conrelid = 'public.crm_event_log'::regclass
  ) then
    alter table public.crm_event_log
      add constraint crm_event_log_subscription_id_fkey
      foreign key (subscription_id) references public.crm_webhook_subscriptions(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'crm_event_log_channel_id_fkey'
      and conrelid = 'public.crm_event_log'::regclass
  ) then
    alter table public.crm_event_log
      add constraint crm_event_log_channel_id_fkey
      foreign key (channel_id) references public.crm_channels(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'crm_event_log_lead_id_fkey'
      and conrelid = 'public.crm_event_log'::regclass
  ) then
    alter table public.crm_event_log
      add constraint crm_event_log_lead_id_fkey
      foreign key (lead_id) references public.crm_leads(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'crm_event_log_conversation_id_fkey'
      and conrelid = 'public.crm_event_log'::regclass
  ) then
    alter table public.crm_event_log
      add constraint crm_event_log_conversation_id_fkey
      foreign key (conversation_id) references public.crm_conversations(id) on delete set null;
  end if;
end $$;

-- -------------------------------------
-- Indexes
-- -------------------------------------

create index if not exists idx_crm_channels_store_id on public.crm_channels (store_id);
create index if not exists idx_crm_channels_provider_store on public.crm_channels (provider, store_id);
create index if not exists idx_crm_channels_store_manual_active on public.crm_channels (store_id, provider) where is_active = true and use_for_manual = true;
create index if not exists idx_crm_channels_store_automation_active on public.crm_channels (store_id, provider) where is_active = true and use_for_automation = true;
create unique index if not exists crm_channels_store_instagram_ig_user_unique on public.crm_channels (store_id, instagram_ig_user_id)
  where provider = 'instagram_official' and instagram_ig_user_id is not null and btrim(instagram_ig_user_id) <> '';

create index if not exists idx_crm_leads_store on public.crm_leads (store_id);
create index if not exists idx_crm_leads_store_phone_normalized on public.crm_leads (store_id, phone_normalized) where phone_normalized is not null;
create index if not exists idx_crm_leads_is_customer on public.crm_leads (store_id, is_customer);
create index if not exists idx_crm_leads_last_purchase_at on public.crm_leads (last_purchase_at desc nulls last);

create index if not exists idx_crm_conversations_store on public.crm_conversations (store_id);
create index if not exists idx_crm_conversations_lead on public.crm_conversations (lead_id);
create unique index if not exists unique_crm_conversations_store_lead on public.crm_conversations (store_id, lead_id);

create index if not exists idx_crm_messages_conversation on public.crm_messages (conversation_id);
create index if not exists idx_crm_messages_store_created on public.crm_messages (store_id, created_at desc);
create unique index if not exists crm_messages_channel_provider_message_unique
  on public.crm_messages (channel_id, provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_crm_lead_stage_history_lead on public.crm_lead_stage_history (lead_id, created_at desc);
create index if not exists idx_crm_event_log_pending on public.crm_event_log (created_at) where is_outbound = true and sent = false;
create index if not exists idx_crm_scheduled_messages_pending on public.crm_scheduled_messages (scheduled_for) where status in ('pending', 'scheduled');
create index if not exists idx_crm_webhook_subscriptions_store on public.crm_webhook_subscriptions (store_id, is_active);
create index if not exists idx_crm_broadcasts_status_schedule on public.crm_broadcasts (status, scheduled_for);
create index if not exists idx_crm_broadcast_recipients_status on public.crm_broadcast_recipients (broadcast_id, status);

create unique index if not exists crm_lead_identities_store_type_value_unique
  on public.crm_lead_identities (store_id, identity_type, identity_value_normalized);
create index if not exists idx_crm_lead_identities_lead on public.crm_lead_identities (lead_id);

-- -------------------------------------
-- Updated_at triggers and sync triggers
-- -------------------------------------

drop trigger if exists trg_crm_channels_set_updated_at on public.crm_channels;
create trigger trg_crm_channels_set_updated_at
before update on public.crm_channels
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_funnels_set_updated_at on public.crm_funnels;
create trigger trg_crm_funnels_set_updated_at
before update on public.crm_funnels
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_funnel_stages_set_updated_at on public.crm_funnel_stages;
create trigger trg_crm_funnel_stages_set_updated_at
before update on public.crm_funnel_stages
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_leads_set_updated_at on public.crm_leads;
create trigger trg_crm_leads_set_updated_at
before update on public.crm_leads
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_conversations_set_updated_at on public.crm_conversations;
create trigger trg_crm_conversations_set_updated_at
before update on public.crm_conversations
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_scheduled_messages_set_updated_at on public.crm_scheduled_messages;
create trigger trg_crm_scheduled_messages_set_updated_at
before update on public.crm_scheduled_messages
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_webhook_subscriptions_set_updated_at on public.crm_webhook_subscriptions;
create trigger trg_crm_webhook_subscriptions_set_updated_at
before update on public.crm_webhook_subscriptions
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_broadcasts_set_updated_at on public.crm_broadcasts;
create trigger trg_crm_broadcasts_set_updated_at
before update on public.crm_broadcasts
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_dispatch_runtime_set_updated_at on public.crm_dispatch_runtime;
create trigger trg_crm_dispatch_runtime_set_updated_at
before update on public.crm_dispatch_runtime
for each row execute function public.crm_set_updated_at();

drop trigger if exists trg_crm_lead_identities_set_updated_at on public.crm_lead_identities;
create trigger trg_crm_lead_identities_set_updated_at
before update on public.crm_lead_identities
for each row execute function public.crm_set_updated_at();

create or replace function public.crm_sync_lead_store_to_related_tables()
returns trigger
language plpgsql
as $$
declare
  v_store_id text;
begin
  if tg_table_name = 'crm_conversations' then
    select l.store_id into v_store_id from public.crm_leads l where l.id = new.lead_id limit 1;
    if v_store_id is null then
      raise exception 'Lead not found for conversation: %', new.lead_id;
    end if;
    new.store_id := v_store_id;
    return new;
  end if;

  if tg_table_name = 'crm_messages' then
    if new.conversation_id is null then
      return new;
    end if;

    select c.store_id, c.lead_id, c.channel_id
      into v_store_id, new.lead_id, new.channel_id
    from public.crm_conversations c
    where c.id = new.conversation_id
    limit 1;

    if v_store_id is null then
      raise exception 'Conversation not found for message: %', new.conversation_id;
    end if;

    new.store_id := v_store_id;
    return new;
  end if;

  if tg_table_name = 'crm_lead_stage_history' then
    select l.store_id into v_store_id from public.crm_leads l where l.id = new.lead_id limit 1;
    new.store_id := v_store_id;
    return new;
  end if;

  if tg_table_name = 'crm_scheduled_messages' then
    select l.store_id into v_store_id from public.crm_leads l where l.id = new.lead_id limit 1;
    new.store_id := v_store_id;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_crm_conversations_sync_store on public.crm_conversations;
create trigger trg_crm_conversations_sync_store
before insert or update of lead_id on public.crm_conversations
for each row execute function public.crm_sync_lead_store_to_related_tables();

drop trigger if exists trg_crm_messages_sync_store on public.crm_messages;
create trigger trg_crm_messages_sync_store
before insert or update of conversation_id on public.crm_messages
for each row execute function public.crm_sync_lead_store_to_related_tables();

drop trigger if exists trg_crm_stage_history_sync_store on public.crm_lead_stage_history;
create trigger trg_crm_stage_history_sync_store
before insert or update of lead_id on public.crm_lead_stage_history
for each row execute function public.crm_sync_lead_store_to_related_tables();

drop trigger if exists trg_crm_scheduled_sync_store on public.crm_scheduled_messages;
create trigger trg_crm_scheduled_sync_store
before insert or update of lead_id on public.crm_scheduled_messages
for each row execute function public.crm_sync_lead_store_to_related_tables();

create or replace function public.crm_after_message_insert()
returns trigger
language plpgsql
as $$
begin
  update public.crm_conversations
  set
    message_count = coalesce(message_count, 0) + 1,
    unread_count = case
      when new.direction = 'inbound' then coalesce(unread_count, 0) + 1
      else coalesce(unread_count, 0)
    end,
    last_message_at = coalesce(new.created_at, now()),
    last_customer_message_at = case
      when new.direction = 'inbound' then coalesce(new.created_at, now())
      else last_customer_message_at
    end,
    last_response_at = case
      when new.direction = 'outbound' then coalesce(new.created_at, now())
      else last_response_at
    end,
    updated_at = now()
  where id = new.conversation_id;

  update public.crm_leads
  set
    last_message_at = coalesce(new.created_at, now()),
    last_interaction_at = coalesce(new.created_at, now()),
    updated_at = now()
  where id = new.lead_id;

  return new;
end;
$$;

drop trigger if exists trg_crm_messages_after_insert on public.crm_messages;
create trigger trg_crm_messages_after_insert
after insert on public.crm_messages
for each row execute function public.crm_after_message_insert();

-- -------------------------------------
-- Purchase intelligence (lead <-> customer)
-- -------------------------------------

create or replace function public.crm_refresh_lead_purchase_metrics(p_lead_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.crm_leads%rowtype;
  v_customer_id text;
  v_purchase_count integer := 0;
  v_last_purchase_at timestamptz;
  v_lifetime_value numeric := 0;
  v_last_order_id text;
  v_last_order_at timestamptz;
  v_last_order_value numeric;
  v_last_order_summary text;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    return;
  end if;

  select * into v_lead
  from public.crm_leads
  where id = p_lead_id
  for update;

  if not found then
    return;
  end if;

  v_customer_id := v_lead.customer_id;

  if v_customer_id is null then
    with candidate as (
      select c.id,
             row_number() over (order by c.updated_at desc nulls last, c.created_at desc nulls last, c.id) as rn,
             count(*) over () as total_rows
      from public.customers c
      where public.normalize_phone(c.phone) = v_lead.phone_normalized
    )
    select id into v_customer_id
    from candidate
    where total_rows = 1 and rn = 1;
  end if;

  if v_customer_id is not null then
    select
      count(*)::integer,
      max(s.date),
      coalesce(sum(s.total), 0),
      (array_agg(s.id order by s.date desc nulls last, s.created_at desc nulls last, s.id desc))[1],
      (array_agg(s.date order by s.date desc nulls last, s.created_at desc nulls last, s.id desc))[1],
      (array_agg(s.total order by s.date desc nulls last, s.created_at desc nulls last, s.id desc))[1]
    into
      v_purchase_count,
      v_last_purchase_at,
      v_lifetime_value,
      v_last_order_id,
      v_last_order_at,
      v_last_order_value
    from public.sales s
    where s.customer_id = v_customer_id;

    if v_last_order_id is not null then
      select string_agg(distinct coalesce(si_model.model, 'Item'), ', ' order by coalesce(si_model.model, 'Item'))
      into v_last_order_summary
      from public.sale_items si
      left join public.stock_items si_model on si_model.id = si.stock_item_id
      where si.sale_id = v_last_order_id;
    end if;
  end if;

  update public.crm_leads
  set
    customer_id = coalesce(v_customer_id, customer_id),
    is_customer = (
      coalesce(v_customer_id, customer_id) is not null
      or coalesce(v_purchase_count, 0) > 0
      or coalesce(v_lifetime_value, 0) > 0
    ),
    purchase_count = coalesce(v_purchase_count, 0),
    last_purchase_at = v_last_purchase_at,
    last_order_id = v_last_order_id,
    last_order_at = v_last_order_at,
    last_order_value = v_last_order_value,
    last_order_summary = v_last_order_summary,
    lifetime_value = coalesce(v_lifetime_value, 0),
    updated_at = now()
  where id = p_lead_id;
end;
$$;

create or replace function public.crm_refresh_purchase_metrics_for_customer(p_customer_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_customer_phone text;
begin
  if p_customer_id is null or btrim(p_customer_id) = '' then
    return;
  end if;

  select public.normalize_phone(c.phone)
    into v_customer_phone
  from public.customers c
  where c.id = p_customer_id
  limit 1;

  for r in
    select l.id
    from public.crm_leads l
    where l.customer_id = p_customer_id
       or (l.customer_id is null and v_customer_phone is not null and l.phone_normalized = v_customer_phone)
  loop
    perform public.crm_refresh_lead_purchase_metrics(r.id);
  end loop;
end;
$$;

create or replace function public.crm_sales_purchase_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    if new.customer_id is not null then
      perform public.crm_refresh_purchase_metrics_for_customer(new.customer_id);
    end if;

    if tg_op = 'UPDATE' and old.customer_id is not null and old.customer_id is distinct from new.customer_id then
      perform public.crm_refresh_purchase_metrics_for_customer(old.customer_id);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.customer_id is not null then
      perform public.crm_refresh_purchase_metrics_for_customer(old.customer_id);
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_crm_sales_purchase_sync on public.sales;
create trigger trg_crm_sales_purchase_sync
after insert or update or delete on public.sales
for each row execute function public.crm_sales_purchase_sync_trigger();

create or replace function public.crm_lead_purchase_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.crm_refresh_lead_purchase_metrics(new.id);
  return new;
end;
$$;

drop trigger if exists trg_crm_lead_purchase_sync on public.crm_leads;
create trigger trg_crm_lead_purchase_sync
after insert or update of customer_id, phone on public.crm_leads
for each row execute function public.crm_lead_purchase_sync_trigger();

-- -------------------------------------
-- Seed default funnels/stages
-- -------------------------------------

insert into public.crm_funnels (store_id, name, description, funnel_type, is_default, is_active, stages)
select
  s.id,
  'Funil CRM',
  'Funil padrão do CRM Plus',
  'sales',
  true,
  true,
  '[]'::jsonb
from public.stores s
where not exists (
  select 1
  from public.crm_funnels f
  where f.store_id = s.id and f.funnel_type = 'sales'
);

insert into public.crm_funnel_stages (id, funnel_type, name, color, "order", is_won, is_lost, is_active)
values
  ('new_lead', 'sales', 'Novo Lead', '#3B82F6', 1, false, false, true),
  ('recurring_lead', 'sales', 'Lead Recorrente', '#06B6D4', 2, false, false, true),
  ('in_negotiation', 'sales', 'Em Negociação', '#F59E0B', 3, false, false, true),
  ('no_response', 'sales', 'Sem Resposta', '#F97316', 4, false, false, true),
  ('lost', 'sales', 'Perdido', '#EF4444', 5, false, true, true),
  ('won', 'sales', 'Ganho', '#10B981', 6, true, false, true)
on conflict (id) do nothing;

with default_funnel as (
  select distinct on (f.store_id)
    f.store_id,
    f.id as funnel_id
  from public.crm_funnels f
  where f.funnel_type = 'sales'
    and coalesce(f.is_active, true) = true
  order by f.store_id, coalesce(f.is_default, false) desc, f.created_at asc
)
update public.crm_leads l
set
  funnel_id = coalesce(l.funnel_id, df.funnel_id),
  funnel_stage = coalesce(nullif(btrim(l.funnel_stage), ''), 'new_lead'),
  updated_at = now()
from default_funnel df
where l.store_id = df.store_id
  and (l.funnel_id is null or l.funnel_stage is null or btrim(l.funnel_stage) = '');

-- -------------------------------------
-- Core RPCs
-- -------------------------------------

drop function if exists public.upsert_crm_lead(text, text, text, text, text, uuid, text, text, text, text, text, text, text, text);
create or replace function public.upsert_crm_lead(
  p_store_id text,
  p_phone text,
  p_name text default null,
  p_contact_id text default null,
  p_entity_id text default null,
  p_channel_id uuid default null,
  p_email text default null,
  p_utm_source text default null,
  p_utm_campaign text default null,
  p_utm_medium text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_first_message text default null,
  p_intent text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id text := nullif(btrim(coalesce(p_store_id, '')), '');
  v_phone_normalized text;
  v_funnel_id uuid;
  v_lead_id text;
  v_existing_lead_id text;
begin
  if v_store_id is null then
    raise exception 'store_id is required';
  end if;

  v_phone_normalized := public.normalize_phone(p_phone);
  if v_phone_normalized is null or btrim(v_phone_normalized) = '' then
    raise exception 'phone is required';
  end if;

  select f.id into v_funnel_id
  from public.crm_funnels f
  where f.store_id = v_store_id
    and f.funnel_type = 'sales'
    and coalesce(f.is_active, true) = true
  order by coalesce(f.is_default, false) desc, f.created_at asc
  limit 1;

  select l.id
    into v_existing_lead_id
  from public.crm_leads l
  where l.store_id = v_store_id
    and l.phone_normalized = v_phone_normalized
  order by l.updated_at desc nulls last, l.created_at desc nulls last, l.id
  limit 1
  for update;

  if v_existing_lead_id is null then
    insert into public.crm_leads (
      id,
      store_id,
      phone,
      name,
      email,
      contact_id,
      entity_id,
      source_channel_id,
      utm_source,
      utm_campaign,
      utm_medium,
      utm_content,
      utm_term,
      first_message,
      intent,
      funnel_id,
      funnel_stage,
      first_contact_at,
      last_message_at,
      last_interaction_at,
      updated_at
    )
    values (
      v_phone_normalized || '-' || v_store_id,
      v_store_id,
      v_phone_normalized,
      nullif(btrim(p_name), ''),
      nullif(btrim(p_email), ''),
      p_contact_id,
      p_entity_id,
      p_channel_id,
      nullif(btrim(p_utm_source), ''),
      nullif(btrim(p_utm_campaign), ''),
      nullif(btrim(p_utm_medium), ''),
      nullif(btrim(p_utm_content), ''),
      nullif(btrim(p_utm_term), ''),
      nullif(btrim(p_first_message), ''),
      nullif(btrim(p_intent), ''),
      v_funnel_id,
      'new_lead',
      now(),
      now(),
      now(),
      now()
    )
    returning id into v_lead_id;
  else
    update public.crm_leads
    set
      phone = v_phone_normalized,
      name = coalesce(nullif(btrim(public.crm_leads.name), ''), nullif(btrim(p_name), ''), public.crm_leads.name),
      email = coalesce(nullif(btrim(public.crm_leads.email), ''), nullif(btrim(p_email), ''), public.crm_leads.email),
      contact_id = coalesce(p_contact_id, public.crm_leads.contact_id),
      entity_id = coalesce(p_entity_id, public.crm_leads.entity_id),
      source_channel_id = coalesce(p_channel_id, public.crm_leads.source_channel_id),
      utm_source = coalesce(nullif(btrim(public.crm_leads.utm_source), ''), nullif(btrim(p_utm_source), ''), public.crm_leads.utm_source),
      utm_campaign = coalesce(nullif(btrim(public.crm_leads.utm_campaign), ''), nullif(btrim(p_utm_campaign), ''), public.crm_leads.utm_campaign),
      utm_medium = coalesce(nullif(btrim(public.crm_leads.utm_medium), ''), nullif(btrim(p_utm_medium), ''), public.crm_leads.utm_medium),
      utm_content = coalesce(nullif(btrim(public.crm_leads.utm_content), ''), nullif(btrim(p_utm_content), ''), public.crm_leads.utm_content),
      utm_term = coalesce(nullif(btrim(public.crm_leads.utm_term), ''), nullif(btrim(p_utm_term), ''), public.crm_leads.utm_term),
      first_message = coalesce(nullif(btrim(public.crm_leads.first_message), ''), nullif(btrim(p_first_message), ''), public.crm_leads.first_message),
      intent = coalesce(nullif(btrim(p_intent), ''), public.crm_leads.intent),
      funnel_id = coalesce(public.crm_leads.funnel_id, v_funnel_id),
      funnel_stage = coalesce(nullif(public.crm_leads.funnel_stage, ''), 'new_lead'),
      last_message_at = now(),
      last_interaction_at = now(),
      updated_at = now()
    where id = v_existing_lead_id
    returning id into v_lead_id;
  end if;

  perform public.crm_refresh_lead_purchase_metrics(v_lead_id);
  return v_lead_id;
end;
$$;

drop function if exists public.upsert_crm_lead(text, text, text, text, text, uuid);
create or replace function public.upsert_crm_lead(
  p_store_id text,
  p_phone text,
  p_name text default null,
  p_contact_id text default null,
  p_entity_id text default null,
  p_channel_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.upsert_crm_lead(
    p_store_id,
    p_phone,
    p_name,
    p_contact_id,
    p_entity_id,
    p_channel_id,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  );
end;
$$;

create or replace function public.crm_upsert_lead_by_identity(
  p_store_id text,
  p_identity_type text,
  p_identity_value text,
  p_name text default null,
  p_channel_id uuid default null,
  p_phone text default null,
  p_email text default null,
  p_contact_id text default null,
  p_entity_id text default null,
  p_first_message text default null,
  p_utm_source text default null,
  p_utm_campaign text default null,
  p_utm_medium text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_intent text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id text := nullif(btrim(coalesce(p_store_id, '')), '');
  v_identity_type text := lower(nullif(btrim(coalesce(p_identity_type, '')), ''));
  v_identity_value text := nullif(btrim(coalesce(p_identity_value, '')), '');
  v_lead_id text;
  v_phone text;
  v_has_primary boolean;
begin
  if v_store_id is null then
    raise exception 'store_id is required';
  end if;

  if v_identity_type is null or v_identity_type not in ('phone', 'email', 'instagram_igsid', 'instagram_username') then
    raise exception 'Unsupported identity_type: %', coalesce(v_identity_type, '<null>');
  end if;

  if v_identity_value is null then
    raise exception 'identity_value is required';
  end if;

  select li.lead_id
    into v_lead_id
  from public.crm_lead_identities li
  where li.store_id = v_store_id
    and li.identity_type = v_identity_type
    and li.identity_value_normalized = lower(v_identity_value)
  limit 1;

  if v_lead_id is null then
    v_phone := case
      when v_identity_type = 'phone' then v_identity_value
      else coalesce(nullif(btrim(coalesce(p_phone, '')), ''), public.crm_identity_fallback_phone(v_identity_type, v_identity_value))
    end;

    v_lead_id := public.upsert_crm_lead(
      v_store_id,
      v_phone,
      p_name,
      p_contact_id,
      p_entity_id,
      p_channel_id,
      p_email,
      p_utm_source,
      p_utm_campaign,
      p_utm_medium,
      p_utm_content,
      p_utm_term,
      p_first_message,
      p_intent
    );
  else
    update public.crm_leads
    set
      name = coalesce(nullif(btrim(public.crm_leads.name), ''), nullif(btrim(p_name), ''), public.crm_leads.name),
      email = coalesce(nullif(btrim(public.crm_leads.email), ''), nullif(btrim(p_email), ''), public.crm_leads.email),
      source_channel_id = coalesce(p_channel_id, public.crm_leads.source_channel_id),
      updated_at = now(),
      last_message_at = now(),
      last_interaction_at = now()
    where id = v_lead_id;
  end if;

  select exists (
    select 1
    from public.crm_lead_identities li
    where li.lead_id = v_lead_id
      and li.identity_type = v_identity_type
      and li.is_primary = true
  )
  into v_has_primary;

  insert into public.crm_lead_identities (
    lead_id,
    store_id,
    identity_type,
    identity_value,
    is_primary,
    metadata
  )
  values (
    v_lead_id,
    v_store_id,
    v_identity_type,
    v_identity_value,
    not v_has_primary,
    jsonb_build_object('source', 'crm_upsert_lead_by_identity', 'updated_at', now())
  )
  on conflict (store_id, identity_type, identity_value_normalized)
  do update
  set
    lead_id = excluded.lead_id,
    identity_value = excluded.identity_value,
    metadata = coalesce(public.crm_lead_identities.metadata, '{}'::jsonb) || jsonb_build_object('updated_at', now()),
    updated_at = now();

  perform public.crm_refresh_lead_purchase_metrics(v_lead_id);
  return v_lead_id;
end;
$$;

create or replace function public.crm_upsert_lead_by_identity_rpc(
  p_store_id text,
  p_identity_type text,
  p_identity_value text,
  p_name text default null,
  p_channel_id uuid default null,
  p_phone text default null,
  p_email text default null,
  p_contact_id text default null,
  p_entity_id text default null,
  p_first_message text default null,
  p_utm_source text default null,
  p_utm_campaign text default null,
  p_utm_medium text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_intent text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.crm_upsert_lead_by_identity(
    p_store_id,
    p_identity_type,
    p_identity_value,
    p_name,
    p_channel_id,
    p_phone,
    p_email,
    p_contact_id,
    p_entity_id,
    p_first_message,
    p_utm_source,
    p_utm_campaign,
    p_utm_medium,
    p_utm_content,
    p_utm_term,
    p_intent
  );
end;
$$;

create or replace function public.move_crm_lead_stage(
  p_lead_id text,
  p_to_stage text,
  p_to_funnel_id uuid default null,
  p_changed_by uuid default null,
  p_notes text default null
)
returns table(
  lead_id text,
  from_stage text,
  to_stage text,
  from_funnel_id uuid,
  to_funnel_id uuid,
  changed_at timestamptz,
  history_logged boolean,
  was_noop boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.crm_leads%rowtype;
  v_changed_at timestamptz := now();
  v_target_stage text;
  v_target_funnel_id uuid;
  v_history_logged boolean := false;
  v_was_noop boolean := false;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    raise exception 'lead_id is required';
  end if;

  v_target_stage := coalesce(nullif(btrim(p_to_stage), ''), 'new_lead');

  select * into v_lead
  from public.crm_leads l
  where l.id = p_lead_id
  for update;

  if not found then
    raise exception 'Lead not found: %', p_lead_id;
  end if;

  v_target_funnel_id := coalesce(p_to_funnel_id, v_lead.funnel_id);

  if v_lead.funnel_stage is not distinct from v_target_stage
     and v_lead.funnel_id is not distinct from v_target_funnel_id then
    v_was_noop := true;
  else
    update public.crm_leads
    set
      funnel_stage = v_target_stage,
      funnel_id = v_target_funnel_id,
      updated_at = v_changed_at,
      last_interaction_at = greatest(coalesce(last_interaction_at, v_changed_at), v_changed_at)
    where id = p_lead_id;

    insert into public.crm_lead_stage_history (
      lead_id,
      store_id,
      from_stage,
      to_stage,
      changed_by,
      notes,
      created_at
    )
    values (
      p_lead_id,
      v_lead.store_id,
      v_lead.funnel_stage,
      v_target_stage,
      p_changed_by,
      p_notes,
      v_changed_at
    );

    v_history_logged := true;
  end if;

  return query
  select
    p_lead_id,
    v_lead.funnel_stage,
    v_target_stage,
    v_lead.funnel_id,
    v_target_funnel_id,
    v_changed_at,
    v_history_logged,
    v_was_noop;
end;
$$;

create or replace function public.update_lead_basic_data(
  p_lead_id text,
  p_name text default null,
  p_email text default null,
  p_tags jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tags text[];
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    return jsonb_build_object('success', false, 'error', 'lead_id is required');
  end if;

  if p_tags is not null then
    v_tags := public.crm_jsonb_to_text_array(p_tags);
  end if;

  update public.crm_leads
  set
    name = case
      when p_name is null then name
      when btrim(p_name) = '' then null
      else btrim(p_name)
    end,
    email = case
      when p_email is null then email
      when btrim(p_email) = '' then null
      else btrim(p_email)
    end,
    tags = case
      when p_tags is null then tags
      else v_tags
    end,
    updated_at = now(),
    last_interaction_at = now()
  where id = p_lead_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Lead not found', 'lead_id', p_lead_id);
  end if;

  return jsonb_build_object('success', true, 'lead_id', p_lead_id);
end;
$$;

create or replace function public.update_lead_funnel(
  p_lead_id text,
  p_funnel_stage text default null,
  p_intent text default null,
  p_reason text default null,
  p_funnel_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage_changed boolean := false;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    return jsonb_build_object('success', false, 'error', 'lead_id is required');
  end if;

  if p_funnel_stage is not null or p_funnel_id is not null then
    perform *
    from public.move_crm_lead_stage(
      p_lead_id => p_lead_id,
      p_to_stage => coalesce(p_funnel_stage, 'new_lead'),
      p_to_funnel_id => p_funnel_id,
      p_changed_by => null,
      p_notes => p_reason
    );

    v_stage_changed := true;
  end if;

  if p_intent is not null then
    update public.crm_leads
    set
      intent = nullif(btrim(p_intent), ''),
      updated_at = now(),
      last_interaction_at = now()
    where id = p_lead_id;

    if not found then
      return jsonb_build_object('success', false, 'error', 'Lead not found', 'lead_id', p_lead_id);
    end if;
  end if;

  return jsonb_build_object('success', true, 'lead_id', p_lead_id, 'stage_changed', v_stage_changed);
end;
$$;

create or replace function public.mark_lead_as_customer(
  p_lead_id text,
  p_customer_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id text := nullif(btrim(coalesce(p_customer_id, '')), '');
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    return jsonb_build_object('success', false, 'error', 'lead_id is required');
  end if;

  if v_customer_id is not null and not exists (
    select 1 from public.customers c where c.id = v_customer_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Customer not found', 'customer_id', v_customer_id);
  end if;

  update public.crm_leads
  set
    customer_id = coalesce(v_customer_id, customer_id),
    is_customer = true,
    updated_at = now(),
    last_interaction_at = now()
  where id = p_lead_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Lead not found', 'lead_id', p_lead_id);
  end if;

  perform public.crm_refresh_lead_purchase_metrics(p_lead_id);
  return jsonb_build_object('success', true, 'lead_id', p_lead_id);
end;
$$;

create or replace function public.get_lead_full_data(
  p_lead_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead jsonb;
  v_conversations jsonb;
  v_stage_history jsonb;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    return jsonb_build_object('success', false, 'error', 'lead_id is required');
  end if;

  select to_jsonb(l) || jsonb_build_object(
      'customer', to_jsonb(c),
      'source_channel', to_jsonb(ch)
    )
  into v_lead
  from public.crm_leads l
  left join public.customers c on c.id = l.customer_id
  left join public.crm_channels ch on ch.id = l.source_channel_id
  where l.id = p_lead_id
  limit 1;

  if v_lead is null then
    return jsonb_build_object('success', false, 'error', 'Lead not found', 'lead_id', p_lead_id);
  end if;

  select coalesce(jsonb_agg(
    to_jsonb(conv) || jsonb_build_object(
      'messages', coalesce(msg.messages, '[]'::jsonb)
    )
    order by conv.last_message_at desc nulls last
  ), '[]'::jsonb)
  into v_conversations
  from (
    select c.*
    from public.crm_conversations c
    where c.lead_id = p_lead_id
    order by c.last_message_at desc nulls last
    limit 20
  ) conv
  left join lateral (
    select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc), '[]'::jsonb) as messages
    from (
      select m.*
      from public.crm_messages m
      where m.conversation_id = conv.id
      order by m.created_at desc
      limit 50
    ) m
  ) msg on true;

  select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc), '[]'::jsonb)
  into v_stage_history
  from public.crm_lead_stage_history h
  where h.lead_id = p_lead_id;

  return jsonb_build_object(
    'success', true,
    'lead', v_lead,
    'conversations', coalesce(v_conversations, '[]'::jsonb),
    'stage_history', coalesce(v_stage_history, '[]'::jsonb)
  );
end;
$$;

create or replace function public.search_leads(
  p_store_id text,
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_filters ->> 'search', '')), '');
  v_funnel_stage text := nullif(btrim(coalesce(p_filters ->> 'funnel_stage', '')), '');
  v_source_channel_id text := nullif(btrim(coalesce(p_filters ->> 'source_channel_id', '')), '');
  v_is_customer boolean;
  v_total bigint := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if p_store_id is null or btrim(p_store_id) = '' then
    return jsonb_build_object('success', false, 'error', 'store_id is required');
  end if;

  if p_filters ? 'is_customer' then
    if lower(coalesce(p_filters ->> 'is_customer', '')) in ('true', 'false') then
      v_is_customer := (p_filters ->> 'is_customer')::boolean;
    end if;
  end if;

  select count(*)
  into v_total
  from public.crm_leads l
  where l.store_id = p_store_id
    and (v_funnel_stage is null or l.funnel_stage = v_funnel_stage)
    and (v_source_channel_id is null or l.source_channel_id::text = v_source_channel_id)
    and (v_is_customer is null or l.is_customer = v_is_customer)
    and (
      v_search is null
      or l.name ilike '%' || v_search || '%'
      or l.phone ilike '%' || v_search || '%'
      or l.phone_normalized ilike '%' || regexp_replace(v_search, '[^0-9]', '', 'g') || '%'
    );

  select coalesce(jsonb_agg(to_jsonb(paged) order by paged.last_interaction_at desc nulls last), '[]'::jsonb)
  into v_items
  from (
    select
      l.id,
      l.store_id,
      l.name,
      l.phone,
      l.phone_normalized,
      l.email,
      l.source_channel_id,
      l.funnel_id,
      l.funnel_stage,
      l.intent,
      l.tags,
      l.is_customer,
      l.customer_id,
      l.purchase_count,
      l.last_purchase_at,
      l.last_order_id,
      l.last_order_at,
      l.last_order_value,
      l.last_order_summary,
      l.lifetime_value,
      l.first_contact_at,
      l.last_message_at,
      l.last_interaction_at,
      l.created_at,
      l.updated_at,
      c.name as customer_name,
      conv.id as conversation_id,
      conv.status as conversation_status,
      conv.unread_count,
      conv.message_count,
      ch.name as source_channel_name,
      ch.provider as source_channel_provider
    from public.crm_leads l
    left join public.customers c on c.id = l.customer_id
    left join lateral (
      select c1.id, c1.status, c1.unread_count, c1.message_count, c1.last_message_at
      from public.crm_conversations c1
      where c1.lead_id = l.id
      order by c1.last_message_at desc nulls last, c1.created_at desc
      limit 1
    ) conv on true
    left join public.crm_channels ch on ch.id = l.source_channel_id
    where l.store_id = p_store_id
      and (v_funnel_stage is null or l.funnel_stage = v_funnel_stage)
      and (v_source_channel_id is null or l.source_channel_id::text = v_source_channel_id)
      and (v_is_customer is null or l.is_customer = v_is_customer)
      and (
        v_search is null
        or l.name ilike '%' || v_search || '%'
        or l.phone ilike '%' || v_search || '%'
        or l.phone_normalized ilike '%' || regexp_replace(v_search, '[^0-9]', '', 'g') || '%'
      )
    order by l.last_interaction_at desc nulls last
    limit v_limit
    offset v_offset
  ) paged;

  return jsonb_build_object(
    'success', true,
    'items', v_items,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

create or replace function public.crm_apply_channel_to_conversation(
  p_conversation_id uuid,
  p_channel_id uuid,
  p_changed_by uuid default null,
  p_reason text default null
)
returns table(
  conversation_id uuid,
  lead_id text,
  from_channel_id uuid,
  to_channel_id uuid,
  from_funnel_id uuid,
  to_funnel_id uuid,
  from_stage text,
  to_stage text,
  channel_changed boolean,
  stage_changed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_conversation public.crm_conversations%rowtype;
  v_lead public.crm_leads%rowtype;
  v_channel record;
  v_target_funnel_id uuid;
  v_target_stage text;
  v_channel_changed boolean := false;
  v_stage_changed boolean := false;
begin
  if p_conversation_id is null then
    raise exception 'conversation_id is required';
  end if;

  if p_channel_id is null then
    raise exception 'channel_id is required';
  end if;

  select * into v_conversation
  from public.crm_conversations
  where id = p_conversation_id
  for update;

  if not found then
    raise exception 'Conversation not found: %', p_conversation_id;
  end if;

  select * into v_lead
  from public.crm_leads
  where id = v_conversation.lead_id
  for update;

  if not found then
    raise exception 'Lead not found for conversation: %', p_conversation_id;
  end if;

  select c.id, c.store_id, c.inbound_funnel_id, c.inbound_funnel_stage
  into v_channel
  from public.crm_channels c
  where c.id = p_channel_id
  limit 1;

  if not found then
    raise exception 'Channel not found: %', p_channel_id;
  end if;

  if v_channel.store_id <> v_lead.store_id then
    raise exception 'Channel store mismatch for conversation/lead';
  end if;

  v_target_funnel_id := coalesce(v_channel.inbound_funnel_id, v_lead.funnel_id);
  v_target_stage := coalesce(nullif(btrim(v_channel.inbound_funnel_stage), ''), v_lead.funnel_stage, 'new_lead');

  if v_conversation.channel_id is distinct from p_channel_id then
    update public.crm_conversations
    set channel_id = p_channel_id,
        updated_at = v_now
    where id = p_conversation_id;
    v_channel_changed := true;
  end if;

  if v_lead.funnel_id is distinct from v_target_funnel_id
     or v_lead.funnel_stage is distinct from v_target_stage then
    update public.crm_leads
    set
      funnel_id = v_target_funnel_id,
      funnel_stage = v_target_stage,
      updated_at = v_now,
      last_interaction_at = greatest(coalesce(last_interaction_at, v_now), v_now)
    where id = v_lead.id;

    insert into public.crm_lead_stage_history (
      lead_id,
      store_id,
      from_stage,
      to_stage,
      changed_by,
      notes,
      created_at
    )
    values (
      v_lead.id,
      v_lead.store_id,
      v_lead.funnel_stage,
      v_target_stage,
      p_changed_by,
      coalesce(nullif(btrim(p_reason), ''), 'channel_switch'),
      v_now
    );

    v_stage_changed := true;
  end if;

  insert into public.crm_event_log (
    store_id,
    event_type,
    payload,
    is_outbound,
    channel_id,
    lead_id,
    conversation_id,
    created_at
  )
  values (
    v_lead.store_id,
    'crm_channel_applied_to_conversation',
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'lead_id', v_lead.id,
      'from_channel_id', v_conversation.channel_id,
      'to_channel_id', p_channel_id,
      'from_funnel_id', v_lead.funnel_id,
      'to_funnel_id', v_target_funnel_id,
      'from_stage', v_lead.funnel_stage,
      'to_stage', v_target_stage,
      'reason', coalesce(nullif(btrim(p_reason), ''), 'manual_or_webhook_switch')
    ),
    false,
    p_channel_id,
    v_lead.id,
    p_conversation_id,
    v_now
  );

  return query
  select
    p_conversation_id,
    v_lead.id,
    v_conversation.channel_id,
    p_channel_id,
    v_lead.funnel_id,
    v_target_funnel_id,
    v_lead.funnel_stage,
    v_target_stage,
    v_channel_changed,
    v_stage_changed;
end;
$$;

create or replace function public.crm_fanout_event_log(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_sub record;
  v_count integer := 0;
begin
  for v_event in
    select *
    from public.crm_event_log e
    where e.is_outbound = true
      and coalesce(e.sent, false) = false
      and e.subscription_id is null
    order by e.created_at asc
    limit greatest(coalesce(p_limit, 100), 1)
  loop
    for v_sub in
      select s.*
      from public.crm_webhook_subscriptions s
      where s.is_active = true
        and (s.store_id is null or s.store_id = v_event.store_id)
        and (
          cardinality(s.subscribed_events) = 0
          or v_event.event_type = any(s.subscribed_events)
        )
    loop
      insert into public.crm_event_log (
        store_id,
        event_type,
        payload,
        is_outbound,
        webhook_url,
        sent,
        retry_count,
        processed,
        subscription_id,
        channel_id,
        lead_id,
        conversation_id,
        created_at
      )
      values (
        v_event.store_id,
        v_event.event_type,
        v_event.payload,
        true,
        v_sub.url,
        false,
        0,
        false,
        v_sub.id,
        v_event.channel_id,
        v_event.lead_id,
        v_event.conversation_id,
        v_event.created_at
      );
      v_count := v_count + 1;
    end loop;

    update public.crm_event_log
    set processed = true,
        processed_at = now()
    where id = v_event.id;
  end loop;

  return v_count;
end;
$$;

-- -------------------------------------
-- Backfill purchase metrics
-- -------------------------------------

do $$
declare
  r record;
begin
  for r in select id from public.crm_leads
  loop
    perform public.crm_refresh_lead_purchase_metrics(r.id);
  end loop;
end $$;

-- -------------------------------------
-- Grants
-- -------------------------------------

grant all on public.crm_channels to authenticated;
grant all on public.crm_funnels to authenticated;
grant all on public.crm_funnel_stages to authenticated;
grant all on public.crm_leads to authenticated;
grant all on public.crm_lead_identities to authenticated;
grant all on public.crm_conversations to authenticated;
grant all on public.crm_messages to authenticated;
grant all on public.crm_lead_stage_history to authenticated;
grant all on public.crm_scheduled_messages to authenticated;
grant all on public.crm_event_log to authenticated;
grant all on public.crm_webhook_subscriptions to authenticated;
grant all on public.crm_broadcasts to authenticated;
grant all on public.crm_broadcast_recipients to authenticated;
grant all on public.crm_dispatch_runtime to authenticated;

grant select, insert, update on public.crm_channels to anon;
grant select, insert, update on public.crm_leads to anon;
grant select, insert, update on public.crm_lead_identities to anon;
grant select, insert, update on public.crm_conversations to anon;
grant select, insert, update on public.crm_messages to anon;
grant select, insert, update on public.crm_event_log to anon;
grant execute on function public.upsert_crm_lead(text, text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.upsert_crm_lead(text, text, text, text, text, uuid, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.crm_upsert_lead_by_identity(text, text, text, text, uuid, text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.crm_upsert_lead_by_identity_rpc(text, text, text, text, uuid, text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.move_crm_lead_stage(text, text, uuid, uuid, text) to anon, authenticated;
grant execute on function public.update_lead_basic_data(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.update_lead_funnel(text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.mark_lead_as_customer(text, text) to anon, authenticated;
grant execute on function public.search_leads(text, jsonb, integer, integer) to anon, authenticated;
grant execute on function public.get_lead_full_data(text) to anon, authenticated;
grant execute on function public.crm_apply_channel_to_conversation(uuid, uuid, uuid, text) to anon, authenticated;
grant execute on function public.crm_fanout_event_log(integer) to anon, authenticated;

-- -------------------------------------
-- RLS by store
-- -------------------------------------

alter table public.crm_channels enable row level security;
alter table public.crm_funnels enable row level security;
alter table public.crm_funnel_stages enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_lead_identities enable row level security;
alter table public.crm_conversations enable row level security;
alter table public.crm_messages enable row level security;
alter table public.crm_lead_stage_history enable row level security;
alter table public.crm_scheduled_messages enable row level security;
alter table public.crm_event_log enable row level security;
alter table public.crm_webhook_subscriptions enable row level security;
alter table public.crm_broadcasts enable row level security;
alter table public.crm_broadcast_recipients enable row level security;
alter table public.crm_dispatch_runtime enable row level security;

-- store-scoped policies

drop policy if exists crm_channels_store_scope on public.crm_channels;
create policy crm_channels_store_scope on public.crm_channels
  for all to authenticated
  using (public.crm_can_access_store(store_id))
  with check (public.crm_can_access_store(store_id));

drop policy if exists crm_funnels_store_scope on public.crm_funnels;
create policy crm_funnels_store_scope on public.crm_funnels
  for all to authenticated
  using (public.crm_can_access_store(store_id))
  with check (public.crm_can_access_store(store_id));

drop policy if exists crm_funnel_stages_read_auth on public.crm_funnel_stages;
create policy crm_funnel_stages_read_auth on public.crm_funnel_stages
  for select to authenticated
  using (true);

drop policy if exists crm_funnel_stages_admin_write on public.crm_funnel_stages;
create policy crm_funnel_stages_admin_write on public.crm_funnel_stages
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists crm_leads_store_scope on public.crm_leads;
create policy crm_leads_store_scope on public.crm_leads
  for all to authenticated
  using (public.crm_can_access_store(store_id))
  with check (public.crm_can_access_store(store_id));

drop policy if exists crm_lead_identities_store_scope on public.crm_lead_identities;
create policy crm_lead_identities_store_scope on public.crm_lead_identities
  for all to authenticated
  using (public.crm_can_access_store(store_id))
  with check (public.crm_can_access_store(store_id));

drop policy if exists crm_conversations_store_scope on public.crm_conversations;
create policy crm_conversations_store_scope on public.crm_conversations
  for all to authenticated
  using (public.crm_can_access_store(store_id))
  with check (public.crm_can_access_store(store_id));

drop policy if exists crm_messages_store_scope on public.crm_messages;
create policy crm_messages_store_scope on public.crm_messages
  for all to authenticated
  using (public.crm_can_access_store(store_id))
  with check (public.crm_can_access_store(store_id));

drop policy if exists crm_stage_history_store_scope on public.crm_lead_stage_history;
create policy crm_stage_history_store_scope on public.crm_lead_stage_history
  for all to authenticated
  using (public.crm_can_access_store(store_id))
  with check (public.crm_can_access_store(store_id));

drop policy if exists crm_scheduled_messages_store_scope on public.crm_scheduled_messages;
create policy crm_scheduled_messages_store_scope on public.crm_scheduled_messages
  for all to authenticated
  using (public.crm_can_access_store(store_id))
  with check (public.crm_can_access_store(store_id));

drop policy if exists crm_event_log_store_scope on public.crm_event_log;
create policy crm_event_log_store_scope on public.crm_event_log
  for all to authenticated
  using (public.crm_can_access_store(store_id))
  with check (public.crm_can_access_store(store_id));

drop policy if exists crm_webhook_subscriptions_store_scope on public.crm_webhook_subscriptions;
create policy crm_webhook_subscriptions_store_scope on public.crm_webhook_subscriptions
  for all to authenticated
  using (store_id is null or public.crm_can_access_store(store_id))
  with check (store_id is null or public.crm_can_access_store(store_id));

drop policy if exists crm_broadcasts_store_scope on public.crm_broadcasts;
create policy crm_broadcasts_store_scope on public.crm_broadcasts
  for all to authenticated
  using (public.crm_can_access_store(store_id))
  with check (public.crm_can_access_store(store_id));

drop policy if exists crm_broadcast_recipients_store_scope on public.crm_broadcast_recipients;
create policy crm_broadcast_recipients_store_scope on public.crm_broadcast_recipients
  for all to authenticated
  using (public.crm_can_access_store(store_id))
  with check (public.crm_can_access_store(store_id));

drop policy if exists crm_dispatch_runtime_admin_scope on public.crm_dispatch_runtime;
create policy crm_dispatch_runtime_admin_scope on public.crm_dispatch_runtime
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

notify pgrst, 'reload schema';

commit;
