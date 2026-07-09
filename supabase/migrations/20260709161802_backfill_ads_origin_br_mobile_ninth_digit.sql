begin;

-- Backfill Ads origin into the canonical CRM lead already linked to ERP sales
-- when UAZ/WhatsApp stored the same Brazilian mobile number with and without
-- the ninth digit. This preserves sales.crm_lead_id and keeps the originating
-- ad lead traceable in source_ad_context.
with recursive
ad_leads as (
  select distinct on (l.id)
    l.id as ad_lead_id,
    l.store_id,
    l.name as ad_lead_name,
    l.phone_normalized as ad_phone_normalized,
    regexp_replace(coalesce(l.phone_normalized, l.phone, ''), '\D', '', 'g') as ad_phone_digits,
    l.source,
    l.source_campaign_id,
    l.source_campaign_title,
    l.source_ad_context,
    a.id as attribution_id,
    a.message_id,
    a.group_key,
    a.detected_at as ad_detected_at,
    a.metadata as attribution_metadata
  from public.crm_leads l
  join public.crm_meta_ads_attributions a on a.lead_id = l.id
  where l.source in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
     or l.source_ad_context is not null
  order by l.id, a.detected_at asc nulls last, a.id asc
),
ad_phone_keys as (
  select
    al.*,
    case
      when al.ad_phone_digits ~ '^55[0-9]{10,11}$' then substring(al.ad_phone_digits from 3)
      else al.ad_phone_digits
    end as ad_local_phone
  from ad_leads al
),
ad_phone_no9 as (
  select
    apk.*,
    case
      when apk.ad_local_phone ~ '^[0-9]{2}9[0-9]{8}$'
        then substring(apk.ad_local_phone from 1 for 2) || substring(apk.ad_local_phone from 4)
      else apk.ad_local_phone
    end as ad_local_phone_no9
  from ad_phone_keys apk
),
sale_leads as (
  select
    s.id as sale_id,
    s.sale_number,
    s.date as sale_date,
    s.total as sale_total,
    s.crm_lead_id as canonical_lead_id,
    c.id as customer_id,
    c.name as customer_name,
    c.phone as customer_phone,
    regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') as customer_phone_digits,
    regexp_replace(coalesce(c.alternative_phone, ''), '\D', '', 'g') as customer_alt_phone_digits
  from public.sales s
  join public.customers c on c.id = s.customer_id
  where s.crm_lead_id is not null
),
sale_phone_keys as (
  select
    sl.*,
    case
      when sl.customer_phone_digits ~ '^55[0-9]{10,11}$' then substring(sl.customer_phone_digits from 3)
      else sl.customer_phone_digits
    end as customer_local_phone,
    case
      when sl.customer_alt_phone_digits ~ '^55[0-9]{10,11}$' then substring(sl.customer_alt_phone_digits from 3)
      else sl.customer_alt_phone_digits
    end as customer_alt_local_phone
  from sale_leads sl
),
sale_phone_no9 as (
  select
    spk.*,
    case
      when spk.customer_local_phone ~ '^[0-9]{2}9[0-9]{8}$'
        then substring(spk.customer_local_phone from 1 for 2) || substring(spk.customer_local_phone from 4)
      else spk.customer_local_phone
    end as customer_local_phone_no9,
    case
      when spk.customer_alt_local_phone ~ '^[0-9]{2}9[0-9]{8}$'
        then substring(spk.customer_alt_local_phone from 1 for 2) || substring(spk.customer_alt_local_phone from 4)
      else spk.customer_alt_local_phone
    end as customer_alt_local_phone_no9
  from sale_phone_keys spk
),
ranked_matches as (
  select
    spn.*,
    apn.ad_lead_id,
    apn.ad_lead_name,
    apn.ad_phone_normalized,
    apn.source,
    apn.source_campaign_id,
    apn.source_campaign_title,
    apn.source_ad_context,
    apn.attribution_id,
    apn.message_id,
    apn.group_key,
    apn.ad_detected_at,
    row_number() over (
      partition by spn.canonical_lead_id
      order by apn.ad_detected_at asc nulls last, spn.sale_date asc nulls last, spn.sale_id asc
    ) as rn
  from sale_phone_no9 spn
  join ad_phone_no9 apn on apn.store_id = (
      select cl.store_id from public.crm_leads cl where cl.id = spn.canonical_lead_id
    )
    and apn.ad_local_phone_no9 <> ''
    and apn.ad_local_phone_no9 in (spn.customer_local_phone_no9, spn.customer_alt_local_phone_no9)
    and apn.ad_lead_id <> spn.canonical_lead_id
    and apn.ad_detected_at <= spn.sale_date
),
deterministic_matches as (
  select rm.*
  from ranked_matches rm
  join public.crm_leads canonical on canonical.id = rm.canonical_lead_id
  where rm.rn = 1
    and coalesce(canonical.source, '') not in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
    and canonical.source_ad_context is null
),
updated_leads as (
  update public.crm_leads canonical
  set
    source = dm.source,
    source_campaign_id = coalesce(canonical.source_campaign_id, dm.source_campaign_id),
    source_campaign_title = coalesce(canonical.source_campaign_title, dm.source_campaign_title),
    source_ad_context = jsonb_strip_nulls(
      coalesce(dm.source_ad_context, '{}'::jsonb)
      || jsonb_build_object(
        'is_from_ad', true,
        'source', dm.source,
        'campaign_id', dm.source_campaign_id,
        'campaign_title', dm.source_campaign_title,
        'detected_at', dm.ad_detected_at,
        'message_id', dm.message_id,
        'backfilled_from_lead_id', dm.ad_lead_id,
        'backfilled_from_lead_name', dm.ad_lead_name,
        'backfilled_from_phone', dm.ad_phone_normalized,
        'backfill_reason', 'br_mobile_ninth_digit_equivalent_sale',
        'backfill_sale_id', dm.sale_id,
        'backfill_sale_number', dm.sale_number,
        'backfill_customer_id', dm.customer_id,
        'backfill_customer_name', dm.customer_name,
        'backfill_customer_phone', dm.customer_phone
      )
    ),
    updated_at = now()
  from deterministic_matches dm
  where canonical.id = dm.canonical_lead_id
  returning canonical.id as canonical_lead_id
)
select count(*) as updated_canonical_ad_leads
from updated_leads;

do $$
declare
  r record;
begin
  for r in
    select id
    from public.crm_leads
    where source_ad_context->>'backfill_reason' = 'br_mobile_ninth_digit_equivalent_sale'
  loop
    perform public.crm_upsert_ad_attribution(r.id);
  end loop;
end $$;

with backfilled as (
  select
    l.id as canonical_lead_id,
    (l.source_ad_context->>'backfilled_from_lead_id') as source_ad_lead_id,
    (l.source_ad_context->>'detected_at')::timestamptz as source_detected_at,
    l.source_ad_context
  from public.crm_leads l
  where l.source_ad_context->>'backfill_reason' = 'br_mobile_ninth_digit_equivalent_sale'
),
source_attrs as (
  select distinct on (b.canonical_lead_id)
    b.canonical_lead_id,
    sa.message_id,
    sa.group_key,
    b.source_detected_at,
    b.source_ad_context
  from backfilled b
  join public.crm_meta_ads_attributions sa on sa.lead_id = b.source_ad_lead_id
  order by b.canonical_lead_id, sa.detected_at asc nulls last, sa.id asc
)
update public.crm_meta_ads_attributions ca
set
  message_id = coalesce(ca.message_id, sa.message_id),
  detected_at = coalesce(sa.source_detected_at, ca.detected_at),
  metadata = jsonb_strip_nulls(
    coalesce(ca.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'backfill_reason', 'br_mobile_ninth_digit_equivalent_sale',
      'backfilled_from_lead_id', sa.source_ad_context->>'backfilled_from_lead_id',
      'backfill_sale_id', sa.source_ad_context->>'backfill_sale_id',
      'backfill_sale_number', sa.source_ad_context->>'backfill_sale_number',
      'source_detected_at', sa.source_detected_at
    )
  )
from source_attrs sa
where ca.lead_id = sa.canonical_lead_id
  and ca.group_key = sa.group_key;

notify pgrst, 'reload schema';

commit;
