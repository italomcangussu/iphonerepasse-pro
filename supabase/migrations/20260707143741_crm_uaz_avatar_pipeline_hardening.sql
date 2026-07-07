begin;

alter table public.crm_leads
  add column if not exists avatar_storage_path text,
  add column if not exists avatar_content_hash text,
  add column if not exists avatar_missing_count integer not null default 0,
  add column if not exists avatar_missing_since timestamptz;

alter table public.crm_leads
  drop constraint if exists crm_leads_avatar_missing_count_nonnegative;

alter table public.crm_leads
  add constraint crm_leads_avatar_missing_count_nonnegative
  check (avatar_missing_count >= 0);

create table public.crm_uaz_avatar_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  lead_id text not null unique references public.crm_leads(id) on delete cascade,
  channel_id uuid not null references public.crm_channels(id) on delete cascade,
  conversation_id uuid references public.crm_conversations(id) on delete set null,
  talk_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  force_refresh boolean not null default false,
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_uaz_avatar_jobs_due_idx
  on public.crm_uaz_avatar_jobs (available_at, created_at)
  where status in ('pending', 'retry');

create index crm_uaz_avatar_jobs_expired_lease_idx
  on public.crm_uaz_avatar_jobs (lease_expires_at)
  where status = 'processing';

create index crm_uaz_avatar_jobs_store_idx
  on public.crm_uaz_avatar_jobs (store_id);

alter table public.crm_uaz_avatar_jobs enable row level security;
revoke all on public.crm_uaz_avatar_jobs from public;
revoke all on public.crm_uaz_avatar_jobs from anon, authenticated;
grant all on public.crm_uaz_avatar_jobs to service_role;

create or replace function public.enqueue_crm_uaz_avatar_job(
  p_store_id text,
  p_lead_id text,
  p_channel_id uuid,
  p_conversation_id uuid,
  p_talk_id text,
  p_force boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
begin
  if nullif(btrim(p_store_id), '') is null
    or nullif(btrim(p_lead_id), '') is null
    or p_channel_id is null
    or nullif(btrim(p_talk_id), '') is null then
    raise exception 'Avatar job requires store, lead, channel and talk id.';
  end if;

  insert into public.crm_uaz_avatar_jobs (
    store_id,
    lead_id,
    channel_id,
    conversation_id,
    talk_id,
    status,
    attempts,
    force_refresh,
    available_at,
    lease_expires_at,
    last_error_code,
    updated_at
  )
  select
    p_store_id,
    p_lead_id,
    p_channel_id,
    p_conversation_id,
    btrim(p_talk_id),
    'pending',
    0,
    p_force,
    now(),
    null,
    null,
    now()
  from public.crm_leads lead
  join public.crm_channels channel
    on channel.id = p_channel_id
   and channel.store_id = p_store_id
   and channel.provider = 'uazapi'
   and channel.is_active is true
  where lead.id = p_lead_id
    and lead.store_id = p_store_id
    and (
      p_force
      or lead.avatar_last_checked_at is null
      or lead.avatar_last_checked_at <= now() - interval '24 hours'
    )
  on conflict (lead_id) do update
  set
    store_id = excluded.store_id,
    channel_id = excluded.channel_id,
    conversation_id = excluded.conversation_id,
    talk_id = excluded.talk_id,
    status = case
      when crm_uaz_avatar_jobs.status = 'processing'
        and crm_uaz_avatar_jobs.lease_expires_at > now()
        then crm_uaz_avatar_jobs.status
      else 'pending'
    end,
    attempts = case
      when crm_uaz_avatar_jobs.status = 'processing'
        and crm_uaz_avatar_jobs.lease_expires_at > now()
        then crm_uaz_avatar_jobs.attempts
      else 0
    end,
    force_refresh = crm_uaz_avatar_jobs.force_refresh or excluded.force_refresh,
    available_at = case
      when crm_uaz_avatar_jobs.status = 'processing'
        and crm_uaz_avatar_jobs.lease_expires_at > now()
        then crm_uaz_avatar_jobs.available_at
      else now()
    end,
    lease_expires_at = case
      when crm_uaz_avatar_jobs.status = 'processing'
        and crm_uaz_avatar_jobs.lease_expires_at > now()
        then crm_uaz_avatar_jobs.lease_expires_at
      else null
    end,
    last_error_code = null,
    updated_at = now()
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.claim_crm_uaz_avatar_jobs(
  p_limit integer default 3,
  p_lease_seconds integer default 120
)
returns setof public.crm_uaz_avatar_jobs
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception 'Avatar job claim limit must be between 1 and 20.';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception 'Avatar job lease must be between 30 and 600 seconds.';
  end if;

  return query
  with due as (
    select job.id
    from public.crm_uaz_avatar_jobs job
    where (
      (job.status in ('pending', 'retry') and job.available_at <= now())
      or (job.status = 'processing' and job.lease_expires_at <= now())
    )
    order by job.available_at, job.created_at
    limit p_limit
    for update skip locked
  )
  update public.crm_uaz_avatar_jobs job
  set
    status = 'processing',
    attempts = job.attempts + 1,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    updated_at = now()
  from due
  where job.id = due.id
  returning job.*;
end;
$$;

create or replace function public.complete_crm_uaz_avatar_job(
  p_job_id uuid,
  p_store_id text,
  p_status text,
  p_error_code text default null,
  p_available_at timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('retry', 'completed', 'failed') then
    raise exception 'Invalid avatar job completion status.';
  end if;
  if p_status = 'retry' and p_available_at is null then
    raise exception 'Retry jobs require available_at.';
  end if;

  update public.crm_uaz_avatar_jobs
  set
    status = p_status,
    available_at = coalesce(p_available_at, available_at),
    lease_expires_at = null,
    force_refresh = case when p_status = 'completed' then false else force_refresh end,
    last_error_code = p_error_code,
    updated_at = now()
  where store_id = p_store_id
    and id = p_job_id;
end;
$$;

revoke all on function public.enqueue_crm_uaz_avatar_job(text, text, uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.claim_crm_uaz_avatar_jobs(integer, integer) from public, anon, authenticated;
revoke all on function public.complete_crm_uaz_avatar_job(uuid, text, text, text, timestamptz) from public, anon, authenticated;

grant execute on function public.enqueue_crm_uaz_avatar_job(text, text, uuid, uuid, text, boolean) to service_role;
grant execute on function public.claim_crm_uaz_avatar_jobs(integer, integer) to service_role;
grant execute on function public.complete_crm_uaz_avatar_job(uuid, text, text, text, timestamptz) to service_role;

drop policy if exists "Public Read CRM Media" on storage.objects;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'crm_leads'
    ) then
    execute 'alter publication supabase_realtime add table public.crm_leads';
  end if;
end;
$$;

comment on table public.crm_uaz_avatar_jobs is
  'Durable, coalesced UAZAPI lead avatar work. Browser roles have no access.';
comment on column public.crm_leads.avatar_storage_path is
  'Current crm-media object path for lifecycle deletion; never a provider CDN URL.';
comment on column public.crm_leads.avatar_content_hash is
  'SHA-256 of the normalized WebP bytes used to skip identical uploads.';
comment on column public.crm_leads.avatar_missing_count is
  'Consecutive successful UAZAPI checks without a visible profile image.';

notify pgrst, 'reload schema';

commit;
