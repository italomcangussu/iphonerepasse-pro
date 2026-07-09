begin;

alter table public.sales
  add column if not exists crm_lead_id text references public.crm_leads(id) on delete set null;

create index if not exists idx_sales_crm_lead_id
  on public.sales (crm_lead_id)
  where crm_lead_id is not null;

create index if not exists idx_sales_customer_store_date
  on public.sales (customer_id, store_id, date desc nulls last)
  where customer_id is not null;

comment on column public.sales.crm_lead_id is
  'Direct CRM Plus lead attribution for ERP sales. Used to prove Ads lead -> real sale conversion.';

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
  v_alternative_phone := public.normalize_phone(v_customer.alternative_phone); -- customers.alternative_phone

  if v_explicit_lead_id is not null then
    select l.id into v_candidate
    from public.crm_leads l
    where l.id = v_explicit_lead_id
      and (v_store_id is null or l.store_id = v_store_id)
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
        when coalesce(l.source, '') in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
          or l.source_ad_context is not null
        then 1 else 0
      end as ad_rank,
      coalesce(l.last_interaction_at, l.last_message_at, l.updated_at, l.created_at) as activity_at,
      l.created_at
    from public.crm_leads l
    where (v_store_id is null or l.store_id = v_store_id)
      and (
        l.customer_id = p_customer_id
        or (v_phone is not null and l.phone_normalized = v_phone)
        or (v_alternative_phone is not null and l.phone_normalized = v_alternative_phone)
      )
  ),
  ranked as (
    select
      c.*,
      row_number() over (
        order by c.match_rank asc, c.ad_rank desc, c.activity_at desc nulls last, c.created_at desc nulls last, c.id desc
      ) as rn,
      count(*) over (
        partition by c.match_rank, c.ad_rank, c.activity_at, c.created_at
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

revoke all on function public.resolve_crm_lead_for_sale(text, text, text, boolean) from public;
grant execute on function public.resolve_crm_lead_for_sale(text, text, text, boolean) to authenticated;

create or replace function public.sales_set_crm_lead_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.crm_lead_id := public.resolve_crm_lead_for_sale(
    new.customer_id,
    new.store_id,
    new.crm_lead_id,
    false
  );
  return new;
end;
$$;

drop trigger if exists trg_sales_set_crm_lead_id on public.sales;
create trigger trg_sales_set_crm_lead_id
before insert or update of customer_id, store_id, crm_lead_id on public.sales
for each row
execute function public.sales_set_crm_lead_id();

update public.sales s
set crm_lead_id = public.resolve_crm_lead_for_sale(s.customer_id, s.store_id, null, true)
where s.crm_lead_id is null
  and public.resolve_crm_lead_for_sale(s.customer_id, s.store_id, null, true) is not null;

create or replace function public.crm_refresh_lead_purchase_metrics(p_lead_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.crm_leads%rowtype;
  v_customer_id text;
  v_purchase_count integer := 0;
  v_last_purchase_at timestamptz;
  v_lifetime_value numeric := 0;
  v_last_order_id text;
  v_last_order_at timestamptz;
  v_last_order_value numeric;
  v_last_order_summary text;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    return;
  end if;

  select * into v_lead
  from public.crm_leads
  where id = p_lead_id
  for update;

  if not found then
    return;
  end if;

  v_customer_id := v_lead.customer_id;

  if v_customer_id is null then
    with candidate as (
      select c.id,
             row_number() over (order by c.updated_at desc nulls last, c.created_at desc nulls last, c.id) as rn,
             count(*) over () as total_rows
      from public.customers c
      where public.normalize_phone(c.phone) = v_lead.phone_normalized
         or public.normalize_phone(c.alternative_phone) = v_lead.phone_normalized
    )
    select id into v_customer_id
    from candidate
    where total_rows = 1 and rn = 1;
  end if;

  if v_customer_id is not null or exists (select 1 from public.sales s where s.crm_lead_id = p_lead_id) then
    with sale_scope as (
      select distinct s.*
      from public.sales s
      where s.crm_lead_id = p_lead_id
         or (v_customer_id is not null and s.customer_id = v_customer_id)
    )
    select
      count(*)::integer,
      max(s.date),
      coalesce(sum(s.total), 0),
      (array_agg(s.id order by s.date desc nulls last, s.created_at desc nulls last, s.id desc))[1],
      (array_agg(s.date order by s.date desc nulls last, s.created_at desc nulls last, s.id desc))[1],
      (array_agg(s.total order by s.date desc nulls last, s.created_at desc nulls last, s.id desc))[1]
    into
      v_purchase_count,
      v_last_purchase_at,
      v_lifetime_value,
      v_last_order_id,
      v_last_order_at,
      v_last_order_value
    from sale_scope s;

    if v_last_order_id is not null then
      select string_agg(distinct coalesce(si_model.model, 'Item'), ', ' order by coalesce(si_model.model, 'Item'))
      into v_last_order_summary
      from public.sale_items si
      left join public.stock_items si_model on si_model.id = si.stock_item_id
      where si.sale_id = v_last_order_id;
    end if;
  end if;

  update public.crm_leads
  set
    customer_id = coalesce(v_customer_id, customer_id),
    is_customer = (
      coalesce(v_customer_id, customer_id) is not null
      or coalesce(v_purchase_count, 0) > 0
      or coalesce(v_lifetime_value, 0) > 0
    ),
    purchase_count = coalesce(v_purchase_count, 0),
    last_purchase_at = v_last_purchase_at,
    last_order_id = v_last_order_id,
    last_order_at = v_last_order_at,
    last_order_value = v_last_order_value,
    last_order_summary = v_last_order_summary,
    lifetime_value = coalesce(v_lifetime_value, 0),
    updated_at = now()
  where id = p_lead_id;
end;
$$;

create or replace function public.crm_refresh_purchase_metrics_for_customer(p_customer_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_customer_phone text;
  v_customer_alternative_phone text;
begin
  if p_customer_id is null or btrim(p_customer_id) = '' then
    return;
  end if;

  select public.normalize_phone(c.phone), public.normalize_phone(c.alternative_phone)
    into v_customer_phone, v_customer_alternative_phone
  from public.customers c
  where c.id = p_customer_id
  limit 1;

  for r in
    select l.id
    from public.crm_leads l
    where l.customer_id = p_customer_id
       or (l.customer_id is null and v_customer_phone is not null and l.phone_normalized = v_customer_phone)
       or (l.customer_id is null and v_customer_alternative_phone is not null and l.phone_normalized = v_customer_alternative_phone)
       or exists (
         select 1 from public.sales s
         where s.customer_id = p_customer_id
           and s.crm_lead_id = l.id
       )
  loop
    perform public.crm_refresh_lead_purchase_metrics(r.id);
  end loop;
end;
$$;

create or replace function public.crm_sales_purchase_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    if new.customer_id is not null then
      perform public.crm_refresh_purchase_metrics_for_customer(new.customer_id);
    end if;

    if new.crm_lead_id is not null then
      perform public.crm_refresh_lead_purchase_metrics(new.crm_lead_id);
    end if;

    if tg_op = 'UPDATE' then
      if old.customer_id is not null and old.customer_id is distinct from new.customer_id then
        perform public.crm_refresh_purchase_metrics_for_customer(old.customer_id);
      end if;

      if old.crm_lead_id is not null and old.crm_lead_id is distinct from new.crm_lead_id then
        perform public.crm_refresh_lead_purchase_metrics(old.crm_lead_id);
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.customer_id is not null then
      perform public.crm_refresh_purchase_metrics_for_customer(old.customer_id);
    end if;

    if old.crm_lead_id is not null then
      perform public.crm_refresh_lead_purchase_metrics(old.crm_lead_id);
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_crm_sales_purchase_sync on public.sales;
create trigger trg_crm_sales_purchase_sync
after insert or update or delete on public.sales
for each row execute function public.crm_sales_purchase_sync_trigger();

create or replace function public.create_sale_full(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id text := p_payload->>'id';
  v_existing public.sales%rowtype;
  v_result jsonb;
begin
  if public.current_role() not in ('admin', 'seller') then
    raise exception 'Usuário sem permissão para criar venda.' using errcode = '42501';
  end if;

  if coalesce(v_sale_id, '') = '' then
    raise exception 'ID da venda é obrigatório.' using errcode = '22023';
  end if;

  select * into v_existing from public.sales where id = v_sale_id for update;

  if found then
    delete from public.debt_payments where debt_id in (select id from public.debts where sale_id = v_sale_id);
    delete from public.debts where sale_id = v_sale_id;
    delete from public.payable_debt_payments where payable_debt_id in (select id from public.payable_debts where sale_id = v_sale_id);
    delete from public.payable_debts where sale_id = v_sale_id;
    delete from public.transactions where sale_id = v_sale_id;
    delete from public.sale_trade_in_items where sale_id = v_sale_id;
    delete from public.payment_methods where sale_id = v_sale_id;
    delete from public.sale_items where sale_id = v_sale_id;
    delete from public.sales where id = v_sale_id;
  end if;

  perform public.pdv_insert_sale_full_payload(p_payload);

  update public.sales s
  set crm_lead_id = public.resolve_crm_lead_for_sale(s.customer_id, s.store_id, p_payload->>'crmLeadId', false)
  where s.id = v_sale_id;

  v_result := public.pdv_hydrate_sale_json(v_sale_id);

  return v_result;
end;
$$;

create or replace function public.update_sale_full(p_sale_id text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.sales%rowtype;
  v_result jsonb;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Apenas administradores podem editar vendas.' using errcode = '42501';
  end if;

  select * into v_existing from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda não encontrada: %', p_sale_id using errcode = 'P0002';
  end if;

  perform public.pdv_rebuild_sale_full_payload(p_sale_id, p_payload);

  update public.sales s
  set crm_lead_id = public.resolve_crm_lead_for_sale(s.customer_id, s.store_id, p_payload->>'crmLeadId', false)
  where s.id = p_sale_id;

  v_result := public.pdv_hydrate_sale_json(p_sale_id);

  return v_result;
end;
$$;

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
  v_traceability jsonb;
begin
  if p_lead_id is null or btrim(p_lead_id) = '' then
    return jsonb_build_object('success', false, 'error', 'lead_id is required');
  end if;

  select to_jsonb(l)
  into v_lead
  from public.crm_leads l
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
    order by c.last_message_at desc nulls last, c.created_at desc, c.id desc
    limit 1
  ) conv
  left join lateral (
    select coalesce(jsonb_agg(to_jsonb(m) - 'webhook_payload' order by m.created_at desc), '[]'::jsonb) as messages
    from (
      select m.*
      from public.crm_messages m
      where m.conversation_id = conv.id
      order by m.created_at desc, m.id desc
      limit 1
    ) m
  ) msg on true;

  select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc), '[]'::jsonb)
  into v_stage_history
  from (
    select h.*
    from public.crm_lead_stage_history h
    where h.lead_id = p_lead_id
    order by h.created_at desc nulls last, h.id desc
    limit 1
  ) h;

  with lead_row as (
    select l.*, c.name as customer_name, c.phone as customer_phone, c.alternative_phone as customer_alternative_phone
    from public.crm_leads l
    left join public.customers c on c.id = l.customer_id
    where l.id = p_lead_id
  ),
  ad_row as (
    select
      a.group_key,
      a.source_app,
      a.raw_source_id,
      a.detected_at,
      g.auto_name,
      g.sample_title,
      g.sample_body,
      g.sample_media_url,
      g.sample_thumbnail_url,
      g.sample_source_url
    from public.crm_meta_ads_attributions a
    left join public.crm_meta_ads_groups g on g.group_key = a.group_key
    where a.lead_id = p_lead_id
    order by a.detected_at desc nulls last, a.id desc
    limit 1
  ),
  direct_sales as (
    select s.*
    from public.sales s
    where s.crm_lead_id = p_lead_id
    order by s.date desc nulls last, s.created_at desc nulls last, s.id desc
    limit 10
  ),
  inferred_sales as (
    select s.*
    from public.sales s
    join lead_row l on l.customer_id is not null and s.customer_id = l.customer_id
    where s.crm_lead_id is distinct from p_lead_id
    order by s.date desc nulls last, s.created_at desc nulls last, s.id desc
    limit 10
  ),
  direct_summary as (
    select
      count(*)::int as direct_count,
      coalesce(sum(s.total), 0) as direct_revenue,
      coalesce(jsonb_agg(to_jsonb(s) order by s.date desc nulls last, s.created_at desc nulls last), '[]'::jsonb) as direct
    from direct_sales s
  ),
  inferred_summary as (
    select
      count(*)::int as inferred_count,
      coalesce(sum(s.total), 0) as inferred_revenue,
      coalesce(jsonb_agg(to_jsonb(s) order by s.date desc nulls last, s.created_at desc nulls last), '[]'::jsonb) as inferred
    from inferred_sales s
  )
  select jsonb_build_object(
    'customer_link', jsonb_build_object(
      'customer_id', l.customer_id,
      'customer_name', l.customer_name,
      'source', case
        when l.customer_id is not null then 'explicit_customer_id'
        when exists (
          select 1 from public.customers c
          where public.normalize_phone(c.phone) = l.phone_normalized
        ) then 'phone_match'
        when exists (
          select 1 from public.customers c
          where public.normalize_phone(c.alternative_phone) = l.phone_normalized
        ) then 'alternative_phone_match'
        else 'unmatched'
      end,
      'confidence', case
        when l.customer_id is not null then 'direct'
        when exists (
          select 1 from public.customers c
          where public.normalize_phone(c.phone) = l.phone_normalized
        ) then 'high'
        when exists (
          select 1 from public.customers c
          where public.normalize_phone(c.alternative_phone) = l.phone_normalized
        ) then 'medium'
        else 'none'
      end
    ),
    'ads', jsonb_build_object(
      'is_ad_lead', (
        coalesce(l.source, '') in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
        or l.source_ad_context is not null
        or ad.group_key is not null
      ),
      'source', l.source,
      'campaign_id', coalesce(l.source_campaign_id, l.source_ad_context->>'campaign_id', ad.raw_source_id),
      'campaign_title', coalesce(l.source_campaign_title, l.source_ad_context->>'campaign_title', ad.auto_name, ad.sample_title),
      'campaign_body', coalesce(l.source_ad_context->>'campaign_body', ad.sample_body),
      'group_key', ad.group_key,
      'source_app', ad.source_app,
      'sample_media_url', ad.sample_media_url,
      'sample_thumbnail_url', ad.sample_thumbnail_url,
      'sample_source_url', ad.sample_source_url
    ),
    'sales', jsonb_build_object(
      'direct', ds.direct,
      'inferred_by_customer', ins.inferred,
      'direct_revenue', ds.direct_revenue,
      'inferred_revenue', ins.inferred_revenue,
      'purchase_count', ds.direct_count + ins.inferred_count,
      'last_sale', (
        select to_jsonb(x)
        from (
          select * from direct_sales
          union all
          select * from inferred_sales
          order by date desc nulls last, created_at desc nulls last, id desc
          limit 1
        ) x
      )
    )
  )
  into v_traceability
  from lead_row l
  left join ad_row ad on true
  cross join direct_summary ds
  cross join inferred_summary ins;

  return jsonb_build_object(
    'success', true,
    'lead', v_lead,
    'conversations', coalesce(v_conversations, '[]'::jsonb),
    'stage_history', coalesce(v_stage_history, '[]'::jsonb),
    'traceability', coalesce(v_traceability, '{}'::jsonb)
  );
end;
$$;

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
      a.group_key,
      a.lead_id,
      count(distinct s.id)::int as direct_sale_count,
      coalesce(sum(s.total), 0) as direct_revenue
    from public.crm_meta_ads_attributions a
    join public.sales s on s.crm_lead_id = a.lead_id
    where a.store_id = p_store_id
    group by a.group_key, a.lead_id
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
      (coalesce(ds.direct_sale_count, 0) > 0 or al.legacy_is_buyer) as is_buyer
    from attr_lead al
    left join direct_sales ds on ds.group_key = al.group_key and ds.lead_id = al.lead_id
  ),
  group_stats as (
    select
      ls.group_key,
      sum(ls.attributions)::int as attributions,
      count(*)::int as leads,
      count(*) filter (where ls.is_buyer)::int as customers,
      coalesce(sum(ds.direct_revenue), 0) + coalesce(sum(ls.fallback_revenue), 0) as revenue,
      coalesce(sum(ls.direct_revenue), 0) as direct_revenue,
      coalesce(sum(ls.fallback_revenue), 0) as fallback_revenue,
      max(ls.lead_last_detected_at) as last_attribution_at
    from lead_stats ls
    left join direct_sales ds on ds.group_key = ls.group_key and ds.lead_id = ls.lead_id
    group by ls.group_key
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
      coalesce(gs.attributions, 0) as attributions,
      coalesce(gs.leads, 0) as leads,
      coalesce(gs.customers, 0) as customers,
      coalesce(gs.revenue, 0) as revenue,
      coalesce(gs.direct_revenue, 0) as direct_revenue,
      coalesce(gs.fallback_revenue, 0) as fallback_revenue,
      gs.last_attribution_at,
      case when coalesce(gs.leads, 0) > 0 then round(gs.customers::numeric / gs.leads, 4) else 0 end as conversion_rate,
      case when coalesce(gs.leads, 0) = 0 then 0 else least(round(gs.customers::numeric / gs.leads / 0.30 * 100)::int, 100) end as score,
      case
        when coalesce(gs.leads, 0) < 3 then 'novo'
        when gs.customers::numeric / gs.leads >= 0.25 then 'A'
        when gs.customers::numeric / gs.leads >= 0.15 then 'B'
        when gs.customers::numeric / gs.leads >= 0.07 then 'C'
        when gs.customers > 0 then 'D'
        else 'E'
      end as grade,
      (coalesce(gs.last_attribution_at, g.last_seen_at) >= now() - interval '7 days') as is_active
    from public.crm_meta_ads_groups g
    left join group_stats gs on gs.group_key = g.group_key
    where g.store_id = p_store_id
      and g.status <> 'ignored'
    order by score desc, g.last_seen_at desc nulls last
    limit 200
  ) x;

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
    'total_revenue', coalesce(sum(t.direct_revenue + t.fallback_revenue) filter (where t.is_buyer), 0),
    'direct_revenue', coalesce(sum(t.direct_revenue) filter (where t.is_buyer), 0),
    'fallback_revenue', coalesce(sum(t.fallback_revenue) filter (where t.is_buyer), 0),
    'conversion_rate', case
      when count(*) > 0 then round(count(*) filter (where t.is_buyer)::numeric / count(*), 4)
      else 0
    end
  )
    into v_summary
  from (
    select
      al.lead_id,
      (coalesce(ds.direct_sale_count, 0) > 0 or al.legacy_is_buyer) as is_buyer,
      coalesce(ds.direct_revenue, 0) as direct_revenue,
      case
        when coalesce(ds.direct_sale_count, 0) > 0 then 0
        when al.legacy_is_buyer then al.legacy_lifetime_value
        else 0
      end as fallback_revenue
    from (
      select
        a.lead_id,
        bool_or(coalesce(l.purchase_count, 0) > 0 or l.sales_stage = 'ganho') as legacy_is_buyer,
        max(coalesce(l.lifetime_value, 0)) as legacy_lifetime_value
      from public.crm_meta_ads_attributions a
      join public.crm_leads l on l.id = a.lead_id and l.store_id = a.store_id
      where a.store_id = p_store_id
        and a.lead_id is not null
      group by a.lead_id
    ) al
    left join (
      select s.crm_lead_id as lead_id, count(distinct s.id)::int as direct_sale_count, coalesce(sum(s.total), 0) as direct_revenue
      from public.sales s
      where s.crm_lead_id is not null
      group by s.crm_lead_id
    ) ds on ds.lead_id = al.lead_id
  ) t;

  return jsonb_build_object(
    'summary', coalesce(v_summary, jsonb_build_object(
      'active_campaigns', 0,
      'total_campaigns', 0,
      'total_leads', 0,
      'total_customers', 0,
      'total_revenue', 0,
      'direct_revenue', 0,
      'fallback_revenue', 0,
      'conversion_rate', 0
    )),
    'groups', v_groups
  );
end;
$$;

revoke all on function public.get_lead_full_data(text) from public;
grant execute on function public.get_lead_full_data(text) to anon, authenticated;

revoke all on function public.get_crm_ads_dashboard(text) from public;
grant execute on function public.get_crm_ads_dashboard(text) to authenticated;

revoke all on function public.create_sale_full(jsonb) from public;
revoke all on function public.create_sale_full(jsonb) from anon;
grant execute on function public.create_sale_full(jsonb) to authenticated;

revoke all on function public.update_sale_full(text, jsonb) from public;
revoke all on function public.update_sale_full(text, jsonb) from anon;
grant execute on function public.update_sale_full(text, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
