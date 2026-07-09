begin;

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

  if v_explicit_lead_id is not null then
    select l.id into v_candidate
    from public.crm_leads l
    where l.id = v_explicit_lead_id
      and (
        l.customer_id is null
        or l.customer_id = p_customer_id
        or (v_phone is not null and l.phone_normalized = v_phone)
        or (v_alternative_phone is not null and l.phone_normalized = v_alternative_phone)
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

with candidates as (
  select
    s.id as sale_id,
    l.id as candidate_lead_id,
    case
      when a.lead_id is not null then 1
      when coalesce(l.source, '') in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
        or l.source_ad_context is not null
        or l.source_campaign_id is not null
        or l.source_campaign_title is not null then 2
      when l.store_id = s.store_id then 3
      when l.customer_id = s.customer_id then 4
      else 5
    end as rank
  from public.sales s
  join public.customers c on c.id = s.customer_id
  join public.crm_leads l on (
    l.customer_id = s.customer_id
    or (public.normalize_phone(c.phone) is not null and l.phone_normalized = public.normalize_phone(c.phone))
    or (public.normalize_phone(c.alternative_phone) is not null and l.phone_normalized = public.normalize_phone(c.alternative_phone))
  )
  left join public.crm_meta_ads_attributions a on a.lead_id = l.id and a.store_id = l.store_id
  where s.crm_lead_id is null
),
ranked as (
  select
    *,
    row_number() over (partition by sale_id order by rank asc, candidate_lead_id desc) as rn,
    count(*) over (partition by sale_id, rank) as tied_at_rank
  from candidates
),
deterministic as (
  select sale_id, candidate_lead_id
  from ranked
  where rn = 1
    and tied_at_rank = 1
)
update public.sales s
set crm_lead_id = d.candidate_lead_id
from deterministic d
where s.id = d.sale_id
  and s.crm_lead_id is null;

revoke all on function public.resolve_crm_lead_for_sale(text, text, text, boolean) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
