-- user_consents: rastreia consentimentos granulares do usuário (LGPD art. 8º §1º)
create table if not exists public.user_consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  consent_key  text not null,        -- 'push' | 'terms_accepted' | 'privacy_accepted'
  granted      boolean not null,
  policy_version text not null,      -- ex: '2026-05' — re-pede consentimento se mudar
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  user_agent   text,
  constraint user_consents_user_key unique (user_id, consent_key, policy_version)
);

alter table public.user_consents enable row level security;

-- Usuário vê e gerencia apenas seus próprios consentimentos
create policy "user_consents_select_own" on public.user_consents
  for select using (auth.uid() = user_id);

create policy "user_consents_insert_own" on public.user_consents
  for insert with check (auth.uid() = user_id);

create policy "user_consents_update_own" on public.user_consents
  for update using (auth.uid() = user_id);

create index if not exists user_consents_user_id_idx on public.user_consents (user_id);
create index if not exists user_consents_key_idx on public.user_consents (user_id, consent_key);

-- account_deletion_requests: soft-delete com janela de 30 dias
create table if not exists public.account_deletion_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  scheduled_delete_at timestamptz not null default (now() + interval '30 days'),
  cancelled_at timestamptz,
  completed_at timestamptz,
  reason      text,
  unique (user_id)  -- apenas uma request ativa por usuário
);

alter table public.account_deletion_requests enable row level security;

create policy "deletion_requests_own" on public.account_deletion_requests
  for all using (auth.uid() = user_id);

create index if not exists deletion_requests_scheduled_idx
  on public.account_deletion_requests (scheduled_delete_at)
  where cancelled_at is null and completed_at is null;
