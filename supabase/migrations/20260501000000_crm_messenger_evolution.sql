-- CRM Plus: Messenger Evolution
-- US-006: ad source columns on crm_leads
-- US-008: crm_filter_views table
-- US-010: full-text search index + RPC

begin;

-- ── US-006: lead ad source tracking ─────────────────────────────────────────
alter table public.crm_leads
  add column if not exists source text,
  add column if not exists source_campaign_id text,
  add column if not exists source_campaign_title text;

create index if not exists idx_crm_leads_source_campaign
  on public.crm_leads (source_campaign_id)
  where source_campaign_id is not null;

create index if not exists idx_crm_leads_source
  on public.crm_leads (source)
  where source is not null;

-- ── US-008: saved filter views ──────────────────────────────────────────────
create table if not exists public.crm_filter_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id text,
  name text not null,
  filters_json jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_filter_views_user on public.crm_filter_views (user_id);
create index if not exists idx_crm_filter_views_shared on public.crm_filter_views (is_shared) where is_shared = true;

alter table public.crm_filter_views enable row level security;

drop policy if exists crm_filter_views_select on public.crm_filter_views;
create policy crm_filter_views_select on public.crm_filter_views
  for select to authenticated
  using (auth.uid() = user_id or is_shared = true);

drop policy if exists crm_filter_views_insert on public.crm_filter_views;
create policy crm_filter_views_insert on public.crm_filter_views
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists crm_filter_views_update on public.crm_filter_views;
create policy crm_filter_views_update on public.crm_filter_views
  for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists crm_filter_views_delete on public.crm_filter_views;
create policy crm_filter_views_delete on public.crm_filter_views
  for delete to authenticated
  using (auth.uid() = user_id);

-- ── US-010: full-text search ─────────────────────────────────────────────────
create index if not exists idx_crm_messages_content_fts
  on public.crm_messages
  using gin(to_tsvector('portuguese', coalesce(content, '')));

drop function if exists search_crm_messages(uuid, text, int);
create or replace function search_crm_messages(
  p_store_id text,
  p_query    text,
  p_limit    int default 20
)
returns table (
  conversation_id uuid,
  message_id      uuid,
  snippet         text,
  rank            real
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.conversation_id,
    m.id                                          as message_id,
    ts_headline(
      'portuguese',
      coalesce(m.content, ''),
      plainto_tsquery('portuguese', p_query),
      'MaxFragments=1, MaxWords=15, MinWords=5, StartSel=<mark>, StopSel=</mark>'
    )                                             as snippet,
    ts_rank(to_tsvector('portuguese', coalesce(m.content, '')), plainto_tsquery('portuguese', p_query)) as rank
  from public.crm_messages m
  where
    m.store_id = p_store_id
    and to_tsvector('portuguese', coalesce(m.content, '')) @@ plainto_tsquery('portuguese', p_query)
  order by rank desc
  limit p_limit;
$$;

grant execute on function search_crm_messages(text, text, int) to authenticated;

-- ── US-006 backfill: populate source fields from existing webhook_payload ────
-- Run idempotently: only updates rows where source is NULL and webhook has externalAdReply
update public.crm_leads l
set
  source = case
    when lower(
      coalesce(
        m.webhook_payload #>> '{data,message,contextInfo,externalAdReply,sourceApp}',
        m.webhook_payload #>> '{message,contextInfo,externalAdReply,sourceApp}',
        'instagram'
      )
    ) like '%face%' then 'meta_ads'
    else 'instagram_ads'
  end,
  source_campaign_id = coalesce(
    m.webhook_payload #>> '{data,message,contextInfo,externalAdReply,sourceID}',
    m.webhook_payload #>> '{message,contextInfo,externalAdReply,sourceID}',
    m.webhook_payload #>> '{data,message,contextInfo,externalAdReply,source_id}',
    m.webhook_payload #>> '{message,contextInfo,externalAdReply,source_id}'
  ),
  source_campaign_title = coalesce(
    m.webhook_payload #>> '{data,message,contextInfo,externalAdReply,title}',
    m.webhook_payload #>> '{message,contextInfo,externalAdReply,title}'
  )
from (
  select distinct on (conversation_id)
    conversation_id,
    webhook_payload
  from public.crm_messages
  where
    direction = 'inbound'
    and (
      webhook_payload #>> '{data,message,contextInfo,externalAdReply,sourceType}' is not null
      or webhook_payload #>> '{message,contextInfo,externalAdReply,sourceType}' is not null
    )
  order by conversation_id, created_at asc
) m
join public.crm_conversations conv on conv.id = m.conversation_id
where conv.lead_id = l.id
  and l.source is null;

commit;
