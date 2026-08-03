-- A single inbound CRM message identifies one ads attribution. When a sale
-- matches an ad lead by phone, the sale's canonical lead gets its own
-- attribution; it must keep the original message as provenance, not copy it
-- into a second row and violate crm_meta_ads_attributions_message_id_key.
begin;

set local lock_timeout = '5s';

create or replace function public.crm_backfill_sale_ads_origin_from_phone_match(p_sale_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_customer public.customers%rowtype;
  v_canonical public.crm_leads%rowtype;
  v_ad record;
begin
  if nullif(btrim(coalesce(p_sale_id, '')), '') is null then
    return;
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id;

  if not found or v_sale.crm_lead_id is null or v_sale.customer_id is null then
    return;
  end if;

  select * into v_customer
  from public.customers
  where id = v_sale.customer_id;

  if not found then
    return;
  end if;

  select * into v_canonical
  from public.crm_leads
  where id = v_sale.crm_lead_id
  for update;

  if not found then
    return;
  end if;

  if coalesce(v_canonical.source, '') in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
     or v_canonical.source_ad_context is not null then
    perform public.crm_upsert_ad_attribution(v_canonical.id);
    return;
  end if;

  select distinct on (l.id)
    l.id as ad_lead_id,
    l.name as ad_lead_name,
    l.phone_normalized as ad_phone_normalized,
    l.source,
    l.source_campaign_id,
    l.source_campaign_title,
    l.source_ad_context,
    a.id as attribution_id,
    a.message_id,
    a.group_key,
    a.detected_at as ad_detected_at
  into v_ad
  from public.crm_leads l
  join public.crm_meta_ads_attributions a on a.lead_id = l.id
  where l.store_id = v_canonical.store_id
    and l.id <> v_canonical.id
    and (
      coalesce(l.source, '') in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
      or l.source_ad_context is not null
    )
    and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) in (
      public.crm_br_phone_match_key(coalesce(public.normalize_phone(v_customer.phone), v_customer.phone)),
      public.crm_br_phone_match_key(coalesce(public.normalize_phone(v_customer.alternative_phone), v_customer.alternative_phone))
    )
    and a.detected_at <= coalesce(v_sale.date, now())
  order by l.id, a.detected_at asc nulls last, a.id asc;

  if v_ad.ad_lead_id is null then
    return;
  end if;

  update public.crm_leads l
  set
    source = v_ad.source,
    source_campaign_id = coalesce(l.source_campaign_id, v_ad.source_campaign_id),
    source_campaign_title = coalesce(l.source_campaign_title, v_ad.source_campaign_title),
    source_ad_context = jsonb_strip_nulls(
      coalesce(v_ad.source_ad_context, '{}'::jsonb)
      || jsonb_build_object(
        'is_from_ad', true,
        'source', v_ad.source,
        'campaign_id', v_ad.source_campaign_id,
        'campaign_title', v_ad.source_campaign_title,
        'detected_at', v_ad.ad_detected_at,
        'message_id', v_ad.message_id,
        'backfilled_from_lead_id', v_ad.ad_lead_id,
        'backfilled_from_lead_name', v_ad.ad_lead_name,
        'backfilled_from_phone', v_ad.ad_phone_normalized,
        'backfill_reason', 'automatic_br_phone_equivalent_sale',
        'backfill_sale_id', v_sale.id,
        'backfill_sale_number', v_sale.sale_number,
        'backfill_customer_id', v_customer.id,
        'backfill_customer_name', v_customer.name,
        'backfill_customer_phone', v_customer.phone
      )
    ),
    updated_at = now()
  where l.id = v_canonical.id
    and coalesce(l.source, '') not in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
    and l.source_ad_context is null;

  perform public.crm_upsert_ad_attribution(v_canonical.id);

  update public.crm_meta_ads_attributions ca
  set
    -- Preserve the unique owner of the inbound message. The canonical lead
    -- already retains this provenance in source_ad_context and metadata.
    message_id = case
      when ca.message_id is not null then ca.message_id
      when v_ad.message_id is not null
        and not exists (
          select 1
          from public.crm_meta_ads_attributions other
          where other.message_id = v_ad.message_id
            and other.id <> ca.id
        ) then v_ad.message_id
      else null
    end,
    detected_at = coalesce(v_ad.ad_detected_at, ca.detected_at),
    metadata = jsonb_strip_nulls(
      coalesce(ca.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'backfill_reason', 'automatic_br_phone_equivalent_sale',
        'backfilled_from_lead_id', v_ad.ad_lead_id,
        'backfill_sale_id', v_sale.id,
        'backfill_sale_number', v_sale.sale_number,
        'source_detected_at', v_ad.ad_detected_at,
        'source_message_id', v_ad.message_id
      )
    )
  where ca.lead_id = v_canonical.id
    and ca.group_key = v_ad.group_key;
end;
$$;

revoke all on function public.crm_backfill_sale_ads_origin_from_phone_match(text) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
