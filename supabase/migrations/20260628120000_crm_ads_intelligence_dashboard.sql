-- CRM Plus — Ads intelligence dashboard.
--
-- Evolves `get_crm_ads_dashboard` from a flat "groups + raw attribution count"
-- list into a real performance report grounded in the existing data:
--   crm_meta_ads_groups  → the campaign/creative (one row per Meta/IG ad creative)
--   crm_meta_ads_attributions → each lead that arrived from that creative
--   crm_leads            → purchase facts (purchase_count / sales_stage / lifetime_value)
--
-- For every campaign it now reports, over the *distinct* leads attributed to it:
--   • leads            — distinct leads that came from the campaign
--   • customers        — those leads that actually bought
--                        (purchase_count > 0  OR  sales_stage = 'ganho')
--   • conversion_rate  — customers / leads (0..1)
--   • revenue          — sum of attributed buyers' lifetime_value (real sales total)
--   • score (0..100)   — conversion scaled so 30% conversion = 100
--   • grade            — A / B / C / D / E, or 'novo' until there are >= 3 leads
--   • is_active        — had an attribution (or was last seen) within 7 days
--
-- Plus a store-level `summary` (active campaigns, distinct leads, buyers,
-- blended conversion rate, total revenue) computed from DISTINCT leads so a
-- lead attributed to two creatives is never double-counted.
--
-- Backwards compatible: the returned `groups[]` keep the original
-- group_key/auto_name/status/source_app/first_seen_at/last_seen_at/attributions
-- fields and only add new ones.

begin;

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
  -- Per (campaign, lead) rollup: collapse multiple message attributions of the
  -- same lead to one row, carrying that lead's purchase facts.
  with attr_lead as (
    select
      a.group_key,
      a.lead_id,
      count(a.id)::int                                   as attributions,
      max(a.detected_at)                                 as lead_last_detected_at,
      bool_or(
        coalesce(l.purchase_count, 0) > 0
        or l.sales_stage = 'ganho'
      )                                                  as is_buyer,
      max(coalesce(l.lifetime_value, 0))                 as lifetime_value
    from public.crm_meta_ads_attributions a
    join public.crm_leads l
      on l.id = a.lead_id
     and l.store_id = a.store_id
    where a.store_id = p_store_id
      and a.lead_id is not null
    group by a.group_key, a.lead_id
  ),
  group_stats as (
    select
      al.group_key,
      sum(al.attributions)::int                          as attributions,
      count(*)::int                                       as leads,
      count(*) filter (where al.is_buyer)::int            as customers,
      coalesce(sum(al.lifetime_value) filter (where al.is_buyer), 0) as revenue,
      max(al.lead_last_detected_at)                       as last_attribution_at
    from attr_lead al
    group by al.group_key
  )
  select coalesce(jsonb_agg(row_to_json(x) order by x.score desc, x.last_seen_at desc nulls last), '[]'::jsonb)
    into v_groups
  from (
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
      g.first_seen_at,
      g.last_seen_at,
      coalesce(gs.attributions, 0)                        as attributions,
      coalesce(gs.leads, 0)                               as leads,
      coalesce(gs.customers, 0)                           as customers,
      coalesce(gs.revenue, 0)                             as revenue,
      gs.last_attribution_at,
      case
        when coalesce(gs.leads, 0) > 0
          then round(gs.customers::numeric / gs.leads, 4)
        else 0
      end                                                 as conversion_rate,
      case
        when coalesce(gs.leads, 0) = 0 then 0
        else least(round(gs.customers::numeric / gs.leads / 0.30 * 100)::int, 100)
      end                                                 as score,
      case
        when coalesce(gs.leads, 0) < 3 then 'novo'
        when gs.customers::numeric / gs.leads >= 0.25 then 'A'
        when gs.customers::numeric / gs.leads >= 0.15 then 'B'
        when gs.customers::numeric / gs.leads >= 0.07 then 'C'
        when gs.customers > 0 then 'D'
        else 'E'
      end                                                 as grade,
      (coalesce(gs.last_attribution_at, g.last_seen_at) >= now() - interval '7 days') as is_active
    from public.crm_meta_ads_groups g
    left join group_stats gs on gs.group_key = g.group_key
    where g.store_id = p_store_id
      and g.status <> 'ignored'
    order by score desc, g.last_seen_at desc nulls last
    limit 200
  ) x;

  -- Store-level summary over DISTINCT leads (never double-count cross-creative leads).
  select jsonb_build_object(
    'active_campaigns', (
      select count(*)::int
      from public.crm_meta_ads_groups g
      where g.store_id = p_store_id
        and g.status <> 'ignored'
        and coalesce(
              (select max(a.detected_at)
                 from public.crm_meta_ads_attributions a
                where a.group_key = g.group_key),
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
    'total_revenue', coalesce(sum(t.lifetime_value) filter (where t.is_buyer), 0),
    'conversion_rate', case
      when count(*) > 0
        then round(count(*) filter (where t.is_buyer)::numeric / count(*), 4)
      else 0
    end
  )
    into v_summary
  from (
    select
      a.lead_id,
      bool_or(
        coalesce(l.purchase_count, 0) > 0
        or l.sales_stage = 'ganho'
      ) as is_buyer,
      max(coalesce(l.lifetime_value, 0)) as lifetime_value
    from public.crm_meta_ads_attributions a
    join public.crm_leads l
      on l.id = a.lead_id
     and l.store_id = a.store_id
    where a.store_id = p_store_id
      and a.lead_id is not null
    group by a.lead_id
  ) t;

  return jsonb_build_object(
    'summary', coalesce(v_summary, jsonb_build_object(
      'active_campaigns', 0,
      'total_campaigns', 0,
      'total_leads', 0,
      'total_customers', 0,
      'total_revenue', 0,
      'conversion_rate', 0
    )),
    'groups', v_groups
  );
end;
$$;

grant execute on function public.get_crm_ads_dashboard(text) to authenticated;

commit;
