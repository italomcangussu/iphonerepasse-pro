alter table public.crm_messages
  add column if not exists sender_user_id uuid references auth.users(id) on delete set null,
  add column if not exists sender_display_name text;

create index if not exists idx_crm_messages_sender_user
  on public.crm_messages (sender_user_id)
  where sender_user_id is not null;
