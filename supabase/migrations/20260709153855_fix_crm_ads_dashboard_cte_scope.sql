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
  with attr_lead as (
    select
      a.group_key,
      a.lead_id,
      count(a.id)::int as attributions,
      max(a.detected_at) as lead_last_detected_at,
      bool_or(coalesce(l.purchase_count, 0) > 0 or l.sales_stage = 'ganho') as legacy_is_buyer,
      max(coalesce(l.lifetime_value, 0)) as legacy_lifetime_value
    from public.crm_meta_ads_attributions a
    join public.crm_leads l on l.id = a.lead_id and l.store_id = a.store_id
    where a.store_id = p_store_id
      and a.lead_id is not null
    group by a.group_key, a.lead_id
  ),
  direct_sales as (
    select
      al.group_key,
      al.lead_id,
      count(distinct s.id)::int as direct_sale_count,
      coalesce(sum(s.total), 0) as direct_revenue
    from attr_lead al
    join public.sales s on s.crm_lead_id = al.lead_id
      and (s.store_id = p_store_id or s.store_id is null)
    group by al.group_key, al.lead_id
  ),
  lead_stats as (
    select
      al.group_key,
      al.lead_id,
      al.attributions,
      al.lead_last_detected_at,
      coalesce(ds.direct_sale_count, 0) as direct_sale_count,
      coalesce(ds.direct_revenue, 0) as direct_revenue,
      case
        when coalesce(ds.direct_sale_count, 0) > 0 then 0
        when al.legacy_is_buyer then al.legacy_lifetime_value
        else 0
      end as fallback_revenue,
      (coalesce(ds.direct_sale_count, 0) > 0 or al.legacy_is_buyer) as is_buyer,
      (coalesce(ds.direct_sale_count, 0) > 0) as is_real_buyer
    from attr_lead al
    left join direct_sales ds on ds.group_key = al.group_key and ds.lead_id = al.lead_id
  ),
  conversion_rows as (
    select distinct on (al.group_key, s.id)
      al.group_key,
      l.id as lead_id,
      coalesce(l.name, l.phone) as lead_name,
      l.phone as lead_phone,
      l.sales_stage as lead_stage,
      s.customer_id,
      c.name as customer_name,
      c.phone as customer_phone,
      s.id as sale_id,
      s.sale_number,
      s.total as sale_total,
      s.date as sale_date,
      coalesce(items.items_count, 0)::int as items_count,
      coalesce(items.product_models, array[]::text[]) as product_models,
      'direct_sale'::text as conversion_source
    from attr_lead al
    join public.crm_leads l on l.id = al.lead_id and l.store_id = p_store_id
    join public.sales s on s.crm_lead_id = al.lead_id
      and (s.store_id = p_store_id or s.store_id is null)
    left join public.customers c on c.id = s.customer_id
    left join lateral (
      select
        count(si.id)::int as items_count,
        array_remove(array_agg(distinct nullif(btrim(concat_ws(' ', sti.model, sti.capacity)), '')), null) as product_models
      from public.sale_items si
      left join public.stock_items sti on sti.id = si.stock_item_id
      where si.sale_id = s.id
    ) items on true
    order by al.group_key, s.id, s.date desc nulls last, s.sale_number desc nulls last
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

revoke all on function public.get_crm_ads_dashboard(text) from public;
grant execute on function public.get_crm_ads_dashboard(text) to authenticated;

notify pgrst, 'reload schema';

commit;
