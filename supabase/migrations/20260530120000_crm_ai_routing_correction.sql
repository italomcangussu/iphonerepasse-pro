begin;

alter table public.crm_channels
  add column if not exists ai_entry_mode text not null default 'inherit';

alter table public.crm_channels drop constraint if exists chk_crm_channels_ai_entry_mode;
alter table public.crm_channels add constraint chk_crm_channels_ai_entry_mode check (
  ai_entry_mode in ('inherit', 'force_ai', 'force_human')
);

insert into public.crm_ai_entry_settings (
  store_id,
  is_enabled,
  fallback_mode,
  reopen_hours,
  business_hours,
  special_business_hours
)
select
  s.id,
  true,
  'force_human',
  24,
  '{}'::jsonb,
  '{}'::jsonb
from public.stores s
on conflict (store_id) do update
set
  is_enabled = true,
  fallback_mode = case
    when public.crm_ai_entry_settings.fallback_mode in ('force_ai', 'force_human') then public.crm_ai_entry_settings.fallback_mode
    else 'force_human'
  end,
  updated_at = now();

create or replace function public.update_lead_memory(
  p_lead_id text,
  p_summary_short text default null,
  p_summary_operational text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.crm_leads%rowtype;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    raise exception 'lead_id is required';
  end if;

  update public.crm_leads
  set
    summary_short = case
      when nullif(btrim(coalesce(p_summary_short, '')), '') is not null then btrim(p_summary_short)
      else summary_short
    end,
    summary_operational = case
      when nullif(btrim(coalesce(p_summary_operational, '')), '') is not null then btrim(p_summary_operational)
      else summary_operational
    end,
    updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  if v_lead.id is null then
    raise exception 'Lead not found: %', p_lead_id;
  end if;

  return jsonb_build_object(
    'lead_id', v_lead.id,
    'summary_short', v_lead.summary_short,
    'summary_operational', v_lead.summary_operational
  );
end;
$$;

revoke all on function public.update_lead_memory(text, text, text) from public, anon, authenticated;
grant execute on function public.update_lead_memory(text, text, text) to authenticated;

with invalid_ai as (
  select c.id, c.store_id, c.lead_id, c.channel_id
  from public.crm_conversations c
  left join public.crm_channels ch on ch.id = c.channel_id
  where c.status = 'ai_handling'
    and (
      ch.id is null
      or ch.ai_resume_webhook_url is null
      or btrim(ch.ai_resume_webhook_url) = ''
      or lower(btrim(ch.ai_resume_webhook_url)) not like 'https://%'
    )
),
logged as (
  insert into public.crm_event_log (
    store_id,
    event_type,
    payload,
    is_outbound,
    channel_id,
    lead_id,
    conversation_id
  )
  select
    invalid_ai.store_id,
    'crm_ai_unavailable_fallback',
    jsonb_build_object(
      'reason', 'migration_invalid_ai_webhook',
      'conversation_id', invalid_ai.id,
      'channel_id', invalid_ai.channel_id
    ),
    false,
    invalid_ai.channel_id,
    invalid_ai.lead_id,
    invalid_ai.id
  from invalid_ai
  returning conversation_id
)
update public.crm_conversations c
set
  status = 'human_handling',
  ai_enabled = false,
  updated_at = now()
where c.id in (select id from invalid_ai);

update public.crm_leads l
set
  conversation_status = 'em_atendimento_humano',
  attendance_owner = 'humano_loja',
  last_agent_type = case when l.last_agent_type = 'alana' then 'evento' else l.last_agent_type end,
  updated_at = now()
from public.crm_conversations c
where c.lead_id = l.id
  and c.status <> 'ai_handling'
  and (
    l.conversation_status = 'em_atendimento_ia'
    or l.attendance_owner = 'ia'
  );

update public.crm_leads
set
  summary_short = null,
  updated_at = now()
where summary_short is not null
  and summary_short ~* '^[^|]+\s*\|\s*\+?[0-9][0-9\s().-]*\s*\|\s*etapa:\s*';

update public.crm_leads
set
  summary_operational = null,
  updated_at = now()
where summary_operational is not null
  and summary_operational ~* '^lead:\s*.+\s*\|\s*etapa:\s*';

commit;
