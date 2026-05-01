-- CRM conversations: WhatsApp group metadata

begin;

alter table public.crm_conversations
  add column if not exists is_group boolean not null default false,
  add column if not exists group_name text,
  add column if not exists group_avatar_url text;

create index if not exists idx_crm_conversations_group
  on public.crm_conversations (store_id, is_group, last_message_at desc nulls last)
  where is_group = true;

commit;
