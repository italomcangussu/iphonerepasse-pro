begin;

with ad_messages as (
  select distinct on (coalesce(m.lead_id, conv.lead_id))
    coalesce(m.lead_id, conv.lead_id) as lead_id,
    m.store_id,
    m.id as message_id,
    m.created_at,
    coalesce(
      m.webhook_payload #> '{message,content,contextInfo,externalAdReply}',
      m.webhook_payload #> '{message,contextInfo,externalAdReply}',
      m.webhook_payload #> '{data,message,contextInfo,externalAdReply}',
      m.webhook_payload #> '{contextInfo,externalAdReply}',
      m.webhook_payload #> '{externalAdReply}'
    ) as ext
  from public.crm_messages m
  left join public.crm_conversations conv on conv.id = m.conversation_id
  where coalesce(m.lead_id, conv.lead_id) is not null
    and coalesce(
      m.webhook_payload #> '{message,content,contextInfo,externalAdReply}',
      m.webhook_payload #> '{message,contextInfo,externalAdReply}',
      m.webhook_payload #> '{data,message,contextInfo,externalAdReply}',
      m.webhook_payload #> '{contextInfo,externalAdReply}',
      m.webhook_payload #> '{externalAdReply}'
    ) is not null
  order by coalesce(m.lead_id, conv.lead_id), m.created_at asc, m.id asc
),
ad_contexts as (
  select
    am.lead_id,
    am.message_id,
    am.created_at,
    case
      when lower(coalesce(am.ext->>'sourceApp', am.ext->>'source_app', '')) like '%face%'
        or lower(coalesce(am.ext->>'sourceApp', am.ext->>'source_app', '')) like '%meta%'
      then 'meta_ads'
      else 'instagram_ads'
    end as source,
    nullif(btrim(coalesce(am.ext->>'sourceID', am.ext->>'sourceId', am.ext->>'source_id')), '') as campaign_id,
    nullif(btrim(coalesce(am.ext->>'title', am.ext->>'campaignTitle', am.ext->>'campaign_title')), '') as campaign_title,
    nullif(btrim(coalesce(am.ext->>'body', am.ext->>'description')), '') as campaign_body,
    nullif(btrim(coalesce(am.ext->>'mediaURL', am.ext->>'mediaUrl', am.ext->>'media_url', am.ext->>'thumbnailURL', am.ext->>'thumbnailUrl', am.ext->>'thumbnail_url', am.ext->>'originalImageURL', am.ext->>'originalImageUrl')), '') as image_url,
    nullif(btrim(coalesce(am.ext->>'thumbnailURL', am.ext->>'thumbnailUrl', am.ext->>'thumbnail_url', am.ext->>'originalImageURL', am.ext->>'originalImageUrl')), '') as thumbnail_url,
    nullif(btrim(coalesce(am.ext->>'sourceURL', am.ext->>'sourceUrl', am.ext->>'source_url', am.ext->>'mediaURL', am.ext->>'mediaUrl')), '') as source_url,
    nullif(btrim(coalesce(am.ext->>'ctwaClid', am.ext->>'ctwa_clid')), '') as ctwa_clid
  from ad_messages am
),
updated as (
  update public.crm_leads l
  set
    source = coalesce(l.source, ac.source),
    source_campaign_id = coalesce(l.source_campaign_id, ac.campaign_id),
    source_campaign_title = coalesce(l.source_campaign_title, ac.campaign_title),
    source_ad_context = coalesce(
      l.source_ad_context,
      jsonb_strip_nulls(jsonb_build_object(
        'is_from_ad', true,
        'source', ac.source,
        'campaign_id', ac.campaign_id,
        'campaign_title', ac.campaign_title,
        'campaign_body', ac.campaign_body,
        'image_url', ac.image_url,
        'thumbnail_url', ac.thumbnail_url,
        'source_url', ac.source_url,
        'ctwa_clid', ac.ctwa_clid,
        'message_id', ac.message_id,
        'detected_at', ac.created_at
      ))
    ),
    updated_at = now()
  from ad_contexts ac
  where l.id = ac.lead_id
    and (
      l.source is null
      or l.source_campaign_id is null
      or l.source_campaign_title is null
      or l.source_ad_context is null
    )
  returning l.id as lead_id
)
select count(*) from updated;

do $$
declare
  r record;
begin
  for r in
    select distinct coalesce(m.lead_id, conv.lead_id) as lead_id
    from public.crm_messages m
    left join public.crm_conversations conv on conv.id = m.conversation_id
    where coalesce(m.lead_id, conv.lead_id) is not null
      and coalesce(
        m.webhook_payload #> '{message,content,contextInfo,externalAdReply}',
        m.webhook_payload #> '{message,contextInfo,externalAdReply}',
        m.webhook_payload #> '{data,message,contextInfo,externalAdReply}',
        m.webhook_payload #> '{contextInfo,externalAdReply}',
        m.webhook_payload #> '{externalAdReply}'
      ) is not null
  loop
    perform public.crm_upsert_ad_attribution(r.lead_id);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
