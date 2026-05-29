begin;

create or replace function public.get_lead_full_data(
  p_lead_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead jsonb;
  v_conversations jsonb;
  v_stage_history jsonb;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    return jsonb_build_object('success', false, 'error', 'lead_id is required');
  end if;

  select to_jsonb(l)
  into v_lead
  from public.crm_leads l
  where l.id = p_lead_id
  limit 1;

  if v_lead is null then
    return jsonb_build_object('success', false, 'error', 'Lead not found', 'lead_id', p_lead_id);
  end if;

  select coalesce(jsonb_agg(
    to_jsonb(conv) || jsonb_build_object(
      'messages', coalesce(msg.messages, '[]'::jsonb)
    )
    order by conv.last_message_at desc nulls last
  ), '[]'::jsonb)
  into v_conversations
  from (
    select c.*
    from public.crm_conversations c
    where c.lead_id = p_lead_id
    order by c.last_message_at desc nulls last
    limit 20
  ) conv
  left join lateral (
    select coalesce(jsonb_agg(to_jsonb(m) - 'webhook_payload' order by m.created_at desc), '[]'::jsonb) as messages
    from (
      select m.*
      from public.crm_messages m
      where m.conversation_id = conv.id
      order by m.created_at desc
      limit 50
    ) m
  ) msg on true;

  select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc), '[]'::jsonb)
  into v_stage_history
  from (
    select h.*
    from public.crm_lead_stage_history h
    where h.lead_id = p_lead_id
    order by h.created_at desc nulls last, h.id desc
    limit 1
  ) h;

  return jsonb_build_object(
    'success', true,
    'lead', v_lead,
    'conversations', coalesce(v_conversations, '[]'::jsonb),
    'stage_history', coalesce(v_stage_history, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_lead_full_data(text) from public;
grant execute on function public.get_lead_full_data(text) to anon, authenticated;

commit;
