begin;

-- Canonical comparison key for Brazilian mobile numbers across the variants we
-- receive from CRM/UAZ and ERP forms:
--   +558899990507, 558899990507, 8899990507
--   +5588999990507, 5588999990507, 88999990507
-- all become the same DDD+8-digits key when they represent the same line.
create or replace function public.crm_br_phone_match_key(p_phone text)
returns text
language sql
immutable
as $$
  with digits as (
    select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as value
  ),
  local_phone as (
    select case
      when value ~ '^55[0-9]{10,11}$' then substring(value from 3)
      else value
    end as value
    from digits
  )
  select nullif(
    case
      when value ~ '^[0-9]{2}9[0-9]{8}$'
        then substring(value from 1 for 2) || substring(value from 4)
      else value
    end,
    ''
  )
  from local_phone;
$$;

create or replace function public.resolve_crm_lead_for_sale(
  p_customer_id text,
  p_store_id text default null,
  p_explicit_lead_id text default null,
  p_conservative boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_store_id text := nullif(btrim(coalesce(p_store_id, '')), '');
  v_explicit_lead_id text := nullif(btrim(coalesce(p_explicit_lead_id, '')), '');
  v_phone text;
  v_alternative_phone text;
  v_phone_key text;
  v_alternative_phone_key text;
  v_candidate text;
  v_tie_count integer := 0;
begin
  if nullif(btrim(coalesce(p_customer_id, '')), '') is null then
    return null;
  end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id
  limit 1;

  if not found then
    return null;
  end if;

  v_phone := public.normalize_phone(v_customer.phone);
  v_alternative_phone := public.normalize_phone(v_customer.alternative_phone);
  v_phone_key := public.crm_br_phone_match_key(coalesce(v_phone, v_customer.phone));
  v_alternative_phone_key := public.crm_br_phone_match_key(coalesce(v_alternative_phone, v_customer.alternative_phone));

  if v_explicit_lead_id is not null then
    select l.id into v_candidate
    from public.crm_leads l
    where l.id = v_explicit_lead_id
      and (
        l.customer_id is null
        or l.customer_id = p_customer_id
        or (v_phone is not null and l.phone_normalized = v_phone)
        or (v_alternative_phone is not null and l.phone_normalized = v_alternative_phone)
        or (v_phone_key is not null and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) = v_phone_key)
        or (v_alternative_phone_key is not null and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) = v_alternative_phone_key)
      )
    limit 1;

    if v_candidate is not null then
      return v_candidate;
    end if;
  end if;

  with candidates as (
    select
      l.id,
      case
        when l.customer_id = p_customer_id then 1
        when v_phone is not null and l.phone_normalized = v_phone then 2
        when v_alternative_phone is not null and l.phone_normalized = v_alternative_phone then 3
        when v_phone_key is not null and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) = v_phone_key then 4
        when v_alternative_phone_key is not null and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) = v_alternative_phone_key then 5
        else 9
      end as match_rank,
      case
        when exists (
          select 1
          from public.crm_meta_ads_attributions a
          where a.lead_id = l.id
            and a.store_id = l.store_id
        )
          or coalesce(l.source, '') in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
          or l.source_ad_context is not null
          or l.source_campaign_id is not null
          or l.source_campaign_title is not null
        then 0 else 1
      end as ads_rank,
      case when v_store_id is not null and l.store_id = v_store_id then 0 else 1 end as store_rank,
      coalesce(l.last_interaction_at, l.last_message_at, l.updated_at, l.created_at) as activity_at,
      l.created_at
    from public.crm_leads l
    where l.customer_id = p_customer_id
       or (v_phone is not null and l.phone_normalized = v_phone)
       or (v_alternative_phone is not null and l.phone_normalized = v_alternative_phone)
       or (v_phone_key is not null and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) = v_phone_key)
       or (v_alternative_phone_key is not null and public.crm_br_phone_match_key(coalesce(l.phone_normalized, l.phone, l.id)) = v_alternative_phone_key)
  ),
  ranked as (
    select
      c.*,
      row_number() over (
        order by c.match_rank asc, c.ads_rank asc, c.store_rank asc, c.activity_at desc nulls last, c.created_at desc nulls last, c.id desc
      ) as rn,
      count(*) over (
        partition by c.match_rank, c.ads_rank, c.store_rank, c.activity_at, c.created_at
      ) as same_rank_count
    from candidates c
  )
  select id, same_rank_count
    into v_candidate, v_tie_count
  from ranked
  where rn = 1;

  if p_conservative and coalesce(v_tie_count, 0) > 1 then
    return null;
  end if;

  return v_candidate;
end;
$$;

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
    message_id = coalesce(ca.message_id, v_ad.message_id),
    detected_at = coalesce(v_ad.ad_detected_at, ca.detected_at),
    metadata = jsonb_strip_nulls(
      coalesce(ca.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'backfill_reason', 'automatic_br_phone_equivalent_sale',
        'backfilled_from_lead_id', v_ad.ad_lead_id,
        'backfill_sale_id', v_sale.id,
        'backfill_sale_number', v_sale.sale_number,
        'source_detected_at', v_ad.ad_detected_at
      )
    )
  where ca.lead_id = v_canonical.id
    and ca.group_key = v_ad.group_key;
end;
$$;

create or replace function public.sales_backfill_ads_origin_from_phone_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.crm_backfill_sale_ads_origin_from_phone_match(new.id);
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sales_backfill_ads_origin_from_phone_match on public.sales;
create trigger trg_sales_backfill_ads_origin_from_phone_match
after insert or update of customer_id, store_id, crm_lead_id, date on public.sales
for each row
execute function public.sales_backfill_ads_origin_from_phone_match();

revoke all on function public.crm_br_phone_match_key(text) from public, anon, authenticated;
revoke all on function public.resolve_crm_lead_for_sale(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.crm_backfill_sale_ads_origin_from_phone_match(text) from public, anon, authenticated;
revoke all on function public.sales_backfill_ads_origin_from_phone_match() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
