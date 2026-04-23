begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crm-media',
  'crm-media',
  true,
  16777216,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/webm',
    'audio/wav',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public Read CRM Media" on storage.objects;
create policy "Public Read CRM Media"
on storage.objects
for select
to public
using (bucket_id = 'crm-media');

drop policy if exists "Auth Upload CRM Media" on storage.objects;
create policy "Auth Upload CRM Media"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'crm-media');

drop policy if exists "Auth Update CRM Media" on storage.objects;
create policy "Auth Update CRM Media"
on storage.objects
for update
to authenticated
using (bucket_id = 'crm-media')
with check (bucket_id = 'crm-media');

drop policy if exists "Auth Delete CRM Media" on storage.objects;
create policy "Auth Delete CRM Media"
on storage.objects
for delete
to authenticated
using (bucket_id = 'crm-media');

alter table public.crm_messages
  add column if not exists reply_to_provider_message_id text,
  add column if not exists reply_preview_text text,
  add column if not exists reaction_target_provider_message_id text,
  add column if not exists reaction_emoji text;

create index if not exists idx_crm_messages_reply_provider_target
  on public.crm_messages (conversation_id, reply_to_provider_message_id)
  where reply_to_provider_message_id is not null;

create index if not exists idx_crm_messages_reaction_provider_target
  on public.crm_messages (conversation_id, reaction_target_provider_message_id)
  where reaction_target_provider_message_id is not null;

create index if not exists idx_crm_conversations_store_status_last
  on public.crm_conversations (store_id, status, last_message_at desc nulls last);

create index if not exists idx_crm_conversations_channel_last
  on public.crm_conversations (channel_id, last_message_at desc nulls last)
  where channel_id is not null;

create index if not exists idx_crm_messages_conversation_created
  on public.crm_messages (conversation_id, created_at asc);

create index if not exists idx_crm_messages_channel_provider_lookup
  on public.crm_messages (channel_id, provider_message_id)
  where provider_message_id is not null;

commit;
