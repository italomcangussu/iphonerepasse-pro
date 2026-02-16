begin;

create table if not exists public.warranty_public_tokens (
  id uuid primary key default gen_random_uuid(),
  sale_id text not null references public.sales(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz null
);

create unique index if not exists idx_warranty_public_tokens_token_hash
  on public.warranty_public_tokens(token_hash);

create index if not exists idx_warranty_public_tokens_sale_id
  on public.warranty_public_tokens(sale_id);

create index if not exists idx_warranty_public_tokens_expires_at
  on public.warranty_public_tokens(expires_at);

alter table public.warranty_public_tokens enable row level security;

drop policy if exists warranty_public_tokens_admin_all on public.warranty_public_tokens;
create policy warranty_public_tokens_admin_all on public.warranty_public_tokens
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists warranty_public_tokens_seller_select on public.warranty_public_tokens;
create policy warranty_public_tokens_seller_select on public.warranty_public_tokens
  for select to authenticated
  using (public.current_role() = 'seller');

commit;
