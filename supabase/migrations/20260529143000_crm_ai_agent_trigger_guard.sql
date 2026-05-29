begin;

create or replace function public.crm_sync_lead_attendance_from_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_owner text;
  v_last_agent text;
begin
  v_status := case
    when new.status = 'ai_handling' then 'em_atendimento_ia'
    when new.status = 'human_handling' then 'em_atendimento_humano'
    when new.status = 'closed' then 'encerrado'
    else null
  end;

  v_owner := case
    when new.status = 'ai_handling' then 'ia'
    when new.status = 'human_handling' then 'humano_loja'
    else null
  end;

  v_last_agent := case
    when new.status = 'ai_handling' then 'alana'
    when new.status = 'human_handling' then 'humano'
    else null
  end;

  update public.crm_leads l
  set
    conversation_status = coalesce(v_status, l.conversation_status),
    attendance_owner = coalesce(v_owner, l.attendance_owner),
    handoff_at = case
      when new.status = 'human_handling' and tg_op = 'UPDATE' and old.status = 'ai_handling' then coalesce(l.handoff_at, now())
      when new.status = 'ai_handling' then now()
      else l.handoff_at
    end,
    human_started_at = case
      when new.status = 'human_handling' then coalesce(l.human_started_at, now())
      else l.human_started_at
    end,
    last_agent_type = coalesce(v_last_agent, l.last_agent_type),
    updated_at = now()
  where l.id = new.lead_id;

  return new;
end;
$$;

commit;
