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

  select to_jsonb(l) || jsonb_build_object(
      'customer', to_jsonb(c),
      'source_channel', case
        when ch.id is null then null
        else jsonb_build_object(
          'id', ch.id,
          'store_id', ch.store_id,
          'name', ch.name,
          'provider', ch.provider,
          'phone_number', ch.phone_number,
          'is_active', ch.is_active,
          'use_for_manual', ch.use_for_manual,
          'use_for_automation', ch.use_for_automation,
          'inbound_funnel_id', ch.inbound_funnel_id,
          'inbound_funnel_stage', ch.inbound_funnel_stage,
          'instagram_username', ch.instagram_username,
          'uaz_instance_name', ch.uaz_instance_name,
          'uaz_connection_status', ch.uaz_connection_status,
          'uaz_last_status_at', ch.uaz_last_status_at,
          'ai_resume_webhook_url', ch.ai_resume_webhook_url,
          'created_at', ch.created_at,
          'updated_at', ch.updated_at
        )
      end
    )
  into v_lead
  from public.crm_leads l
  left join public.customers c on c.id = l.customer_id
  left join public.crm_channels ch on ch.id = l.source_channel_id
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
  from public.crm_lead_stage_history h
  where h.lead_id = p_lead_id;

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
