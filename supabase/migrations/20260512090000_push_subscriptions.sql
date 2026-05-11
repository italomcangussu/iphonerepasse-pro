-- Web Push subscriptions table.
-- Stores PushSubscription objects (endpoint + keys) per authenticated user.
-- One row per device/browser. Endpoint is globally unique (browsers enforce this).

create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  store_id     text references public.stores(id) on delete set null,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  -- 'ios' | 'android' | 'desktop' — populated by client
  platform     text check (platform in ('ios', 'android', 'desktop')),
  -- Array of topic keys this device subscribes to.
  -- e.g. ['crm_inbox', 'new_lead', 'sale', 'debt_due']
  topics       text[] not null default '{"crm_inbox","new_lead","sale"}',
  is_active    boolean not null default true,
  last_seen_at timestamptz not null default now(),
  last_error_at     timestamptz,
  last_error_message text,
  created_at   timestamptz not null default now(),
  -- Endpoint is unique across all users (a device can only belong to one user).
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

comment on table public.push_subscriptions is
  'One row per browser/device push subscription. Managed by the push-subscribe edge function.';

-- Partial index: fast lookup of active subscriptions by user.
create index push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id)
  where is_active = true;

-- Partial index: lookup active subs by store and topic for fan-out sends.
create index push_subscriptions_store_topics_idx
  on public.push_subscriptions using gin (topics)
  where is_active = true;

create index push_subscriptions_store_active_idx
  on public.push_subscriptions (store_id)
  where is_active = true;

-- RLS
alter table public.push_subscriptions enable row level security;

-- Users can only see and manage their own subscriptions.
create policy "users manage own push subscriptions"
  on public.push_subscriptions
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role (edge functions) bypasses RLS automatically.
