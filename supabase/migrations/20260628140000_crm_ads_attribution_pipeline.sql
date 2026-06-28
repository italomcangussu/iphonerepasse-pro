-- CRM Plus — Ads attribution ingestion pipeline.
--
-- ROOT CAUSE this migration fixes: the Ads dashboard (`get_crm_ads_dashboard`)
-- reads exclusively from `crm_meta_ads_groups` (the creative/campaign) and
-- `crm_meta_ads_attributions` (each lead that arrived from a creative), but
-- NOTHING in the codebase ever inserted into those two tables. The inbound
-- webhook (`crm-uaz-webhook-receiver`) only persisted the ad origin onto the
-- lead row (`crm_leads.source` / `source_campaign_id` / `source_campaign_title`
-- / `source_ad_context`). So the dashboard's source tables were orphaned and
-- the page was always empty even though hundreds of leads came from Meta/IG ads.
--
-- This wires the ingestion at the database layer (so it covers every path that
-- writes ad origin onto a lead — WhatsApp, Instagram, manual, RPC):
--   1. helper: derive a stable `creative_signature` per (store, campaign)
--   2. helper: map the lead's ad `source` to the groups table's source_app enum
--   3. `crm_upsert_ad_attribution(lead_id)` — idempotent: upserts the group by
--      (store_id, creative_signature) and inserts at most one attribution per
--      (group, lead).
--   4. AFTER INSERT/UPDATE trigger on the ad columns of `crm_leads`.
--   5. one-time backfill of every existing ad lead.

begin;

-- 1. Stable signature for a creative/campaign within a store. Prefer the Meta
--    numeric campaign id (shared by every lead from the same ad), then the
--    campaign title, then the source/image url. Returns null when there is no
--    usable signal (caller then skips attribution).
create or replace function public.crm_ad_creative_signature(
  p_source_campaign_id text,
  p_source_campaign_title text,
  p_source_ad_context jsonb
)
returns text
language sql
immutable
as $$
  select nullif(trim(coalesce(
    nullif(trim(p_source_campaign_id), ''),
    nullif(trim(p_source_ad_context->>'campaign_id'), ''),
    lower(nullif(trim(p_source_campaign_title), '')),
    lower(nullif(trim(p_source_ad_context->>'campaign_title'), '')),
    nullif(trim(p_source_ad_context->>'source_url'), ''),
    nullif(trim(p_source_ad_context->>'image_url'), '')
  )), '');
$$;

-- 2. Map the lead-level ad source ('meta_ads' | 'instagram_ads' |
--    'click_to_whatsapp') to the groups table's CHECK enum ('instagram' |
--    'facebook'). Anything Facebook/Meta-flavoured -> facebook, else instagram.
create or replace function public.crm_ad_source_app(
  p_source text,
  p_ctx jsonb
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(lower(p_source), lower(p_ctx->>'source'), '') ~ '(meta|face|fb)'
      then 'facebook'
    else 'instagram'
  end;
$$;

-- 3. Idempotent attribution upsert for a single lead. Safe to call repeatedly.
create or replace function public.crm_upsert_ad_attribution(p_lead_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.crm_leads%rowtype;
  v_ctx jsonb;
  v_sig text;
  v_app text;
  v_group_key uuid;
  v_detected_at timestamptz;
begin
  select * into l from public.crm_leads where id = p_lead_id;
  if not found then
    return;
  end if;

  v_ctx := l.source_ad_context;

  -- Only leads that actually came from a paid ad.
  if not (
       coalesce(l.source, '') in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
       or (v_ctx is not null and coalesce((v_ctx->>'is_from_ad')::boolean, false))
     ) then
    return;
  end if;

  v_sig := public.crm_ad_creative_signature(
    l.source_campaign_id, l.source_campaign_title, v_ctx
  );
  if v_sig is null then
    return;
  end if;

  v_app := public.crm_ad_source_app(l.source, v_ctx);
  v_detected_at := coalesce(l.first_contact_at, l.created_at, now());

  insert into public.crm_meta_ads_groups as g (
    store_id, creative_signature, source_app, auto_name, status,
    sample_title, sample_body, sample_media_url, sample_thumbnail_url,
    sample_source_url, first_seen_at, last_seen_at
  ) values (
    l.store_id, v_sig, v_app,
    coalesce(l.source_campaign_title, v_ctx->>'campaign_title'),
    'pending_review',
    coalesce(l.source_campaign_title, v_ctx->>'campaign_title'),
    v_ctx->>'campaign_body',
    v_ctx->>'image_url',
    coalesce(v_ctx->>'thumbnail_url', v_ctx->>'image_url'),
    v_ctx->>'source_url',
    v_detected_at, v_detected_at
  )
  on conflict (store_id, creative_signature) do update set
    last_seen_at         = greatest(coalesce(g.last_seen_at, excluded.last_seen_at), excluded.last_seen_at),
    first_seen_at        = least(coalesce(g.first_seen_at, excluded.first_seen_at), excluded.first_seen_at),
    auto_name            = coalesce(g.auto_name, excluded.auto_name),
    sample_title         = coalesce(g.sample_title, excluded.sample_title),
    sample_body          = coalesce(g.sample_body, excluded.sample_body),
    sample_media_url     = coalesce(g.sample_media_url, excluded.sample_media_url),
    sample_thumbnail_url = coalesce(g.sample_thumbnail_url, excluded.sample_thumbnail_url),
    sample_source_url    = coalesce(g.sample_source_url, excluded.sample_source_url),
    updated_at           = now()
  returning g.group_key into v_group_key;

  -- At most one attribution per (group, lead).
  if not exists (
    select 1 from public.crm_meta_ads_attributions a
    where a.group_key = v_group_key and a.lead_id = l.id
  ) then
    insert into public.crm_meta_ads_attributions (
      store_id, lead_id, group_key, source_app, raw_source_id, detected_at
    ) values (
      l.store_id, l.id, v_group_key, v_app,
      coalesce(l.source_campaign_id, v_ctx->>'campaign_id'),
      v_detected_at
    );

    update public.crm_meta_ads_groups
       set total_attributions = total_attributions + 1,
           updated_at = now()
     where group_key = v_group_key;
  end if;
end;
$$;

-- 4. Trigger: fire only when an ad column on the lead changes (cheap — the
--    webhook sets these once, on first detection).
create or replace function public.crm_trg_attribute_lead_ad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.crm_upsert_ad_attribution(new.id);
  return null;
end;
$$;

drop trigger if exists trg_crm_attribute_lead_ad on public.crm_leads;
create trigger trg_crm_attribute_lead_ad
after insert or update of source, source_ad_context, source_campaign_id, source_campaign_title
on public.crm_leads
for each row
execute function public.crm_trg_attribute_lead_ad();

-- 5. Backfill every existing ad lead.
do $$
declare
  r record;
begin
  for r in
    select id
    from public.crm_leads
    where source in ('meta_ads', 'instagram_ads', 'click_to_whatsapp')
       or source_ad_context is not null
  loop
    perform public.crm_upsert_ad_attribution(r.id);
  end loop;
end $$;

grant execute on function public.crm_ad_creative_signature(text, text, jsonb) to authenticated;
grant execute on function public.crm_ad_source_app(text, jsonb) to authenticated;
grant execute on function public.crm_upsert_ad_attribution(text) to authenticated;

commit;
