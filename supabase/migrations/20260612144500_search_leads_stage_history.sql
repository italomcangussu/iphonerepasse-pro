create or replace function public.search_leads(
  p_store_id text,
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_filters ->> 'search', '')), '');
  v_funnel_stage text := nullif(btrim(coalesce(p_filters ->> 'funnel_stage', '')), '');
  v_sales_stage text := nullif(btrim(coalesce(p_filters ->> 'sales_stage', '')), '');
  v_source_channel_id text := nullif(btrim(coalesce(p_filters ->> 'source_channel_id', '')), '');
  v_is_customer boolean;
  v_total bigint := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if p_store_id is null or btrim(p_store_id) = '' then
    return jsonb_build_object('success', false, 'error', 'store_id is required');
  end if;

  if p_filters ? 'is_customer' then
    if lower(coalesce(p_filters ->> 'is_customer', '')) in ('true', 'false') then
      v_is_customer := (p_filters ->> 'is_customer')::boolean;
    end if;
  end if;

  select count(*)
  into v_total
  from public.crm_leads l
  where l.store_id = p_store_id
    and (v_funnel_stage is null or l.funnel_stage = v_funnel_stage)
    and (v_sales_stage is null or l.sales_stage = v_sales_stage)
    and (v_source_channel_id is null or l.source_channel_id::text = v_source_channel_id)
    and (v_is_customer is null or l.is_customer = v_is_customer)
    and (
      v_search is null
      or l.name ilike '%' || v_search || '%'
      or l.first_name ilike '%' || v_search || '%'
      or l.phone ilike '%' || v_search || '%'
      or l.phone_normalized ilike '%' || regexp_replace(v_search, '[^0-9]', '', 'g') || '%'
    );

  select coalesce(jsonb_agg(to_jsonb(paged) order by paged.last_interaction_at desc nulls last), '[]'::jsonb)
  into v_items
  from (
    select
      l.id,
      l.store_id,
      l.name,
      l.first_name,
      l.phone,
      l.phone_normalized,
      l.email,
      l.source_channel_id,
      l.funnel_id,
      l.funnel_stage,
      l.sales_stage,
      l.attendance_owner,
      l.intent,
      l.tags,
      l.is_customer,
      l.customer_id,
      l.summary_operational,
      l.summary_short,
      l.last_message_content,
      l.last_event_name,
      l.last_event_at,
      l.purchase_count,
      l.last_purchase_at,
      l.last_order_id,
      l.last_order_at,
      l.last_order_value,
      l.last_order_summary,
      l.lifetime_value,
      l.first_contact_at,
      l.last_message_at,
      l.last_interaction_at,
      l.created_at,
      l.updated_at,
      c.name as customer_name,
      conv.id as conversation_id,
      conv.status as conversation_status,
      conv.unread_count,
      conv.message_count,
      ch.name as source_channel_name,
      ch.provider as source_channel_provider,
      coalesce(sh.stage_history, '[]'::jsonb) as stage_history
    from public.crm_leads l
    left join public.customers c on c.id = l.customer_id
    left join lateral (
      select c1.id, c1.status, c1.unread_count, c1.message_count, c1.last_message_at
      from public.crm_conversations c1
      where c1.lead_id = l.id
      order by c1.last_message_at desc nulls last, c1.created_at desc
      limit 1
    ) conv on true
    left join lateral (
      select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc nulls last, h.id desc), '[]'::jsonb) as stage_history
      from (
        select h.*
        from public.crm_lead_stage_history h
        where h.lead_id = l.id
        order by h.created_at desc nulls last, h.id desc
        limit 1
      ) h
    ) sh on true
    left join public.crm_channels ch on ch.id = l.source_channel_id
    where l.store_id = p_store_id
      and (v_funnel_stage is null or l.funnel_stage = v_funnel_stage)
      and (v_sales_stage is null or l.sales_stage = v_sales_stage)
      and (v_source_channel_id is null or l.source_channel_id::text = v_source_channel_id)
      and (v_is_customer is null or l.is_customer = v_is_customer)
      and (
        v_search is null
        or l.name ilike '%' || v_search || '%'
        or l.first_name ilike '%' || v_search || '%'
        or l.phone ilike '%' || v_search || '%'
        or l.phone_normalized ilike '%' || regexp_replace(v_search, '[^0-9]', '', 'g') || '%'
      )
    order by l.last_interaction_at desc nulls last
    limit v_limit
    offset v_offset
  ) paged;

  return jsonb_build_object(
    'success', true,
    'items', v_items,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

grant execute on function public.search_leads(text, jsonb, integer, integer) to anon, authenticated;
