begin;

create or replace function public.crm_ads_is_probable_image_url(p_url text)
returns boolean
language sql
immutable
as $$
  select nullif(btrim(coalesce(p_url, '')), '') is not null
    and lower(btrim(p_url)) ~ '^https?://'
    and lower(btrim(p_url)) !~ '(instagram\.com/(p|reel|stories)/|facebook\.com/|fb\.watch|wa\.me/)';
$$;

update public.crm_meta_ads_attributions a
set message_id = (l.source_ad_context->>'message_id')::uuid
from public.crm_leads l
where l.id = a.lead_id
  and a.message_id is null
  and (l.source_ad_context->>'message_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.crm_messages m
    where m.id::text = l.source_ad_context->>'message_id'
  );

with recovered as (
  select distinct on (g.group_key)
    g.group_key,
    media.url as image_url
  from public.crm_meta_ads_groups g
  join public.crm_meta_ads_attributions a on a.group_key = g.group_key
  left join public.crm_leads l on l.id = a.lead_id
  left join public.crm_messages m on m.id::text = coalesce(a.message_id::text, l.source_ad_context->>'message_id')
  cross join lateral (
    values
      (nullif(btrim(l.source_ad_context->>'thumbnail_url'), ''), 1),
      (nullif(btrim(l.source_ad_context->>'image_url'), ''), 2),
      (nullif(btrim(l.source_ad_context->>'media_url'), ''), 3),
      (nullif(btrim(l.source_ad_context->>'thumbnailURL'), ''), 4),
      (nullif(btrim(l.source_ad_context->>'mediaURL'), ''), 5),
      (nullif(btrim(l.source_ad_context->>'originalImageURL'), ''), 6),
      (nullif(btrim(m.webhook_payload #>> '{message,content,contextInfo,externalAdReply,thumbnailURL}'), ''), 7),
      (nullif(btrim(m.webhook_payload #>> '{message,content,contextInfo,externalAdReply,mediaURL}'), ''), 8),
      (nullif(btrim(m.webhook_payload #>> '{message,content,contextInfo,externalAdReply,originalImageURL}'), ''), 9),
      (nullif(btrim(m.webhook_payload #>> '{message,contextInfo,externalAdReply,thumbnailURL}'), ''), 10),
      (nullif(btrim(m.webhook_payload #>> '{message,contextInfo,externalAdReply,mediaURL}'), ''), 11)
  ) as media(url, priority)
  where public.crm_ads_is_probable_image_url(media.url)
  order by g.group_key, media.priority asc, a.detected_at asc nulls last, a.id asc
)
update public.crm_meta_ads_groups g
set
  sample_thumbnail_url = case
    when public.crm_ads_is_probable_image_url(g.sample_thumbnail_url) then g.sample_thumbnail_url
    else recovered.image_url
  end,
  updated_at = now()
from recovered
where recovered.group_key = g.group_key
  and not (
    public.crm_ads_is_probable_image_url(g.sample_thumbnail_url)
    or public.crm_ads_is_probable_image_url(g.sample_media_url)
  );

with recovered_sources as (
  select distinct on (g.group_key)
    g.group_key,
    source.url as source_url
  from public.crm_meta_ads_groups g
  join public.crm_meta_ads_attributions a on a.group_key = g.group_key
  left join public.crm_leads l on l.id = a.lead_id
  left join public.crm_messages m on m.id::text = coalesce(a.message_id::text, l.source_ad_context->>'message_id')
  cross join lateral (
    values
      (nullif(btrim(l.source_ad_context->>'source_url'), ''), 1),
      (nullif(btrim(l.source_ad_context->>'sourceURL'), ''), 2),
      (nullif(btrim(m.webhook_payload #>> '{message,content,contextInfo,externalAdReply,sourceURL}'), ''), 3),
      (nullif(btrim(m.webhook_payload #>> '{message,contextInfo,externalAdReply,sourceURL}'), ''), 4)
  ) as source(url, priority)
  where nullif(source.url, '') is not null
    and lower(source.url) ~ '^https?://'
  order by g.group_key, source.priority asc, a.detected_at asc nulls last, a.id asc
)
update public.crm_meta_ads_groups g
set
  sample_source_url = coalesce(g.sample_source_url, recovered_sources.source_url),
  updated_at = now()
from recovered_sources
where recovered_sources.group_key = g.group_key
  and g.sample_source_url is null;

create or replace function public.get_crm_ads_dashboard(p_store_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_groups jsonb;
  v_summary jsonb;
begin
  with attr_lead as (
    select
      a.group_key,
      a.store_id,
      a.lead_id,
      count(a.id)::int as attributions,
      max(a.detected_at) as lead_last_detected_at,
      bool_or(coalesce(l.purchase_count, 0) > 0 or l.sales_stage = 'ganho') as legacy_is_buyer,
      max(coalesce(l.lifetime_value, 0)) as legacy_lifetime_value,
      max(l.customer_id) as lead_customer_id,
      max(l.phone_normalized) as lead_phone_normalized
    from public.crm_meta_ads_attributions a
    join public.crm_leads l on l.id = a.lead_id and l.store_id = a.store_id
    where a.store_id = p_store_id
      and a.lead_id is not null
    group by a.group_key, a.store_id, a.lead_id
  ),
  candidate_sales as (
    select distinct on (al.group_key, al.lead_id, s.id)
      al.group_key,
      al.lead_id,
      s.id as sale_id,
      s.store_id as sale_store_id,
      s.customer_id,
      s.sale_number,
      s.total as sale_total,
      s.date as sale_date,
      case
        when s.crm_lead_id = al.lead_id then 'direct_sale'
        when al.lead_customer_id is not null and s.customer_id = al.lead_customer_id then 'customer_id_sale'
        else 'phone_customer_sale'
      end as conversion_source,
      case
        when s.crm_lead_id = al.lead_id then 1
        when al.lead_customer_id is not null and s.customer_id = al.lead_customer_id then 2
        else 3
      end as conversion_rank
    from attr_lead al
    join public.customers c on (
      (al.lead_customer_id is not null and c.id = al.lead_customer_id)
      or (
        al.lead_phone_normalized is not null
        and (
          public.normalize_phone(c.phone) = al.lead_phone_normalized
          or public.normalize_phone(c.alternative_phone) = al.lead_phone_normalized
        )
      )
    )
    join public.sales s on s.customer_id = c.id
    order by al.group_key, al.lead_id, s.id,
      case
        when s.crm_lead_id = al.lead_id then 1
        when al.lead_customer_id is not null and s.customer_id = al.lead_customer_id then 2
        else 3
      end
  ),
  real_sales_by_lead as (
    select
      cs.group_key,
      cs.lead_id,
      count(distinct cs.sale_id)::int as real_sale_count,
      coalesce(sum(cs.sale_total), 0) as real_revenue,
      max(cs.sale_date) as last_sale_at
    from candidate_sales cs
    group by cs.group_key, cs.lead_id
  ),
  lead_stats as (
    select
      al.group_key,
      al.lead_id,
      al.attributions,
      al.lead_last_detected_at,
      coalesce(rs.real_sale_count, 0) as direct_sale_count,
      coalesce(rs.real_revenue, 0) as direct_revenue,
      case
        when coalesce(rs.real_sale_count, 0) > 0 then 0
        when al.legacy_is_buyer then al.legacy_lifetime_value
        else 0
      end as fallback_revenue,
      (coalesce(rs.real_sale_count, 0) > 0 or al.legacy_is_buyer) as is_buyer,
      (coalesce(rs.real_sale_count, 0) > 0) as is_real_buyer
    from attr_lead al
    left join real_sales_by_lead rs on rs.group_key = al.group_key and rs.lead_id = al.lead_id
  ),
  conversion_rows as (
    select
      cs.group_key,
      l.id as lead_id,
      coalesce(l.name, l.phone) as lead_name,
      l.phone as lead_phone,
      l.sales_stage as lead_stage,
      cs.customer_id,
      c.name as customer_name,
      c.phone as customer_phone,
      cs.sale_id,
      cs.sale_store_id,
      cs.sale_number,
      cs.sale_total,
      cs.sale_date,
      coalesce(items.items_count, 0)::int as items_count,
      coalesce(items.product_models, array[]::text[]) as product_models,
      cs.conversion_source
    from candidate_sales cs
    join public.crm_leads l on l.id = cs.lead_id and l.store_id = p_store_id
    left join public.customers c on c.id = cs.customer_id
    left join lateral (
      select
        count(si.id)::int as items_count,
        array_remove(array_agg(distinct nullif(btrim(concat_ws(' ', sti.model, sti.capacity)), '')), null) as product_models
      from public.sale_items si
      left join public.stock_items sti on sti.id = si.stock_item_id
      where si.sale_id = cs.sale_id
    ) items on true
  ),
  conversion_details as (
    select
      c.group_key,
      coalesce(jsonb_agg(row_to_json(c) order by c.sale_date desc nulls last, c.sale_number desc nulls last), '[]'::jsonb) as conversions
    from conversion_rows c
    group by c.group_key
  ),
  group_stats as (
    select
      ls.group_key,
      sum(ls.attributions)::int as attributions,
      count(*)::int as leads,
      count(*) filter (where ls.is_buyer)::int as customers,
      count(*) filter (where ls.is_real_buyer)::int as real_customers,
      coalesce(sum(ls.direct_revenue), 0) + coalesce(sum(ls.fallback_revenue), 0) as revenue,
      coalesce(sum(ls.direct_revenue), 0) as direct_revenue,
      coalesce(sum(ls.fallback_revenue), 0) as fallback_revenue,
      max(ls.lead_last_detected_at) as last_attribution_at
    from lead_stats ls
    group by ls.group_key
  ),
  recovered_group_media as (
    select distinct on (a.group_key)
      a.group_key,
      media.url as creative_image_url
    from public.crm_meta_ads_attributions a
    left join public.crm_leads l on l.id = a.lead_id
    left join public.crm_messages m on m.id::text = coalesce(a.message_id::text, l.source_ad_context->>'message_id')
    cross join lateral (
      values
        (nullif(btrim(l.source_ad_context->>'thumbnail_url'), ''), 1),
        (nullif(btrim(l.source_ad_context->>'image_url'), ''), 2),
        (nullif(btrim(l.source_ad_context->>'media_url'), ''), 3),
        (nullif(btrim(l.source_ad_context->>'thumbnailURL'), ''), 4),
        (nullif(btrim(l.source_ad_context->>'mediaURL'), ''), 5),
        (nullif(btrim(l.source_ad_context->>'originalImageURL'), ''), 6),
        (nullif(btrim(m.webhook_payload #>> '{message,content,contextInfo,externalAdReply,thumbnailURL}'), ''), 7),
        (nullif(btrim(m.webhook_payload #>> '{message,content,contextInfo,externalAdReply,mediaURL}'), ''), 8),
        (nullif(btrim(m.webhook_payload #>> '{message,content,contextInfo,externalAdReply,originalImageURL}'), ''), 9),
        (nullif(btrim(m.webhook_payload #>> '{message,contextInfo,externalAdReply,thumbnailURL}'), ''), 10),
        (nullif(btrim(m.webhook_payload #>> '{message,contextInfo,externalAdReply,mediaURL}'), ''), 11)
    ) as media(url, priority)
    where a.store_id = p_store_id
      and public.crm_ads_is_probable_image_url(media.url)
    order by a.group_key, media.priority asc, a.detected_at asc nulls last, a.id asc
  ),
  recovered_group_source as (
    select distinct on (a.group_key)
      a.group_key,
      source.url as creative_source_url
    from public.crm_meta_ads_attributions a
    left join public.crm_leads l on l.id = a.lead_id
    left join public.crm_messages m on m.id::text = coalesce(a.message_id::text, l.source_ad_context->>'message_id')
    cross join lateral (
      values
        (nullif(btrim(l.source_ad_context->>'source_url'), ''), 1),
        (nullif(btrim(l.source_ad_context->>'sourceURL'), ''), 2),
        (nullif(btrim(m.webhook_payload #>> '{message,content,contextInfo,externalAdReply,sourceURL}'), ''), 3),
        (nullif(btrim(m.webhook_payload #>> '{message,contextInfo,externalAdReply,sourceURL}'), ''), 4)
    ) as source(url, priority)
    where a.store_id = p_store_id
      and nullif(source.url, '') is not null
      and lower(source.url) ~ '^https?://'
    order by a.group_key, source.priority asc, a.detected_at asc nulls last, a.id asc
  ),
  group_rows as (
    select
      g.group_key,
      g.auto_name,
      g.status,
      g.source_app,
      g.sample_title,
      g.sample_body,
      g.sample_media_url,
      g.sample_thumbnail_url,
      g.sample_source_url,
      coalesce(
        case when public.crm_ads_is_probable_image_url(g.sample_thumbnail_url) then g.sample_thumbnail_url end,
        case when public.crm_ads_is_probable_image_url(g.sample_media_url) then g.sample_media_url end,
        rgm.creative_image_url
      ) as creative_image_url,
      coalesce(g.sample_source_url, rgs.creative_source_url) as creative_source_url,
      g.first_seen_at,
      g.last_seen_at,
      coalesce(gs.attributions, 0) as attributions,
      coalesce(gs.leads, 0) as leads,
      coalesce(gs.customers, 0) as customers,
      coalesce(gs.real_customers, 0) as real_customers,
      coalesce(gs.revenue, 0) as revenue,
      coalesce(gs.direct_revenue, 0) as direct_revenue,
      coalesce(gs.fallback_revenue, 0) as fallback_revenue,
      gs.last_attribution_at,
      case when coalesce(gs.leads, 0) > 0 then round(gs.customers::numeric / gs.leads, 4) else 0 end as assisted_conversion_rate,
      case when coalesce(gs.leads, 0) > 0 then round(gs.real_customers::numeric / gs.leads, 4) else 0 end as real_conversion_rate,
      case when coalesce(gs.leads, 0) > 0 then round(gs.real_customers::numeric / gs.leads, 4) else 0 end as conversion_rate,
      case when coalesce(gs.leads, 0) = 0 then 0 else least(round(gs.real_customers::numeric / gs.leads / 0.30 * 100)::int, 100) end as score,
      case
        when coalesce(gs.leads, 0) < 3 then 'novo'
        when gs.real_customers::numeric / gs.leads >= 0.25 then 'A'
        when gs.real_customers::numeric / gs.leads >= 0.15 then 'B'
        when gs.real_customers::numeric / gs.leads >= 0.07 then 'C'
        when gs.real_customers > 0 then 'D'
        else 'E'
      end as grade,
      coalesce(cd.conversions, '[]'::jsonb) as conversions,
      (coalesce(gs.last_attribution_at, g.last_seen_at) >= now() - interval '7 days') as is_active
    from public.crm_meta_ads_groups g
    left join group_stats gs on gs.group_key = g.group_key
    left join conversion_details cd on cd.group_key = g.group_key
    left join recovered_group_media rgm on rgm.group_key = g.group_key
    left join recovered_group_source rgs on rgs.group_key = g.group_key
    where g.store_id = p_store_id
      and g.status <> 'ignored'
    order by score desc, g.last_seen_at desc nulls last
    limit 200
  ),
  groups_payload as (
    select coalesce(jsonb_agg(row_to_json(gr) order by gr.score desc, gr.last_seen_at desc nulls last), '[]'::jsonb) as groups
    from group_rows gr
  ),
  summary_payload as (
    select jsonb_build_object(
      'active_campaigns', (
        select count(*)::int
        from public.crm_meta_ads_groups g
        where g.store_id = p_store_id
          and g.status <> 'ignored'
          and coalesce(
                (select max(a.detected_at) from public.crm_meta_ads_attributions a where a.group_key = g.group_key),
                g.last_seen_at
              ) >= now() - interval '7 days'
      ),
      'total_campaigns', (
        select count(*)::int
        from public.crm_meta_ads_groups g
        where g.store_id = p_store_id
          and g.status <> 'ignored'
      ),
      'total_leads', count(*)::int,
      'total_customers', count(*) filter (where t.is_buyer)::int,
      'real_customers', count(*) filter (where t.is_real_buyer)::int,
      'total_revenue', coalesce(sum(t.direct_revenue + t.fallback_revenue) filter (where t.is_buyer), 0),
      'direct_revenue', coalesce(sum(t.direct_revenue) filter (where t.is_real_buyer), 0),
      'fallback_revenue', coalesce(sum(t.fallback_revenue) filter (where t.is_buyer), 0),
      'assisted_conversion_rate', case
        when count(*) > 0 then round(count(*) filter (where t.is_buyer)::numeric / count(*), 4)
        else 0
      end,
      'real_conversion_rate', case
        when count(*) > 0 then round(count(*) filter (where t.is_real_buyer)::numeric / count(*), 4)
        else 0
      end,
      'conversion_rate', case
        when count(*) > 0 then round(count(*) filter (where t.is_real_buyer)::numeric / count(*), 4)
        else 0
      end
    ) as summary
    from lead_stats t
  )
  select gp.groups, sp.summary
    into v_groups, v_summary
  from groups_payload gp
  cross join summary_payload sp;

  return jsonb_build_object(
    'summary', coalesce(v_summary, jsonb_build_object(
      'active_campaigns', 0,
      'total_campaigns', 0,
      'total_leads', 0,
      'total_customers', 0,
      'real_customers', 0,
      'total_revenue', 0,
      'direct_revenue', 0,
      'fallback_revenue', 0,
      'assisted_conversion_rate', 0,
      'real_conversion_rate', 0,
      'conversion_rate', 0
    )),
    'groups', coalesce(v_groups, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.crm_ads_is_probable_image_url(text) from public, anon, authenticated;
revoke all on function public.get_crm_ads_dashboard(text) from public;
grant execute on function public.get_crm_ads_dashboard(text) to authenticated;

notify pgrst, 'reload schema';

commit;
