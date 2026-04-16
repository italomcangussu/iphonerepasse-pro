-- Ensure PostgREST can embed crm_channels from crm_conversations.
-- Some environments were missing this FK due historical schema drift.

update public.crm_conversations c
set channel_id = null
where channel_id is not null
  and not exists (
    select 1
    from public.crm_channels ch
    where ch.id = c.channel_id
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'crm_conversations_channel_id_fkey'
      and conrelid = 'public.crm_conversations'::regclass
  ) then
    alter table public.crm_conversations
      add constraint crm_conversations_channel_id_fkey
      foreign key (channel_id) references public.crm_channels(id) on delete set null;
  end if;
end $$;
