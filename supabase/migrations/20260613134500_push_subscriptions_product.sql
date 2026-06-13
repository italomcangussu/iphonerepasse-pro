-- Add a product discriminator to push_subscriptions so the same backend can
-- target the two independent installable PWAs (ERP "iPhoneRepasse Pro" and
-- "CRM Plus") without cross-product notification leakage.
-- See tasks/prd-pwa-push-independente-erp-crmplus-ios.md (US-007).

alter table public.push_subscriptions
  add column product text not null default 'erp'
  check (product in ('erp', 'crmplus'));

comment on column public.push_subscriptions.product is
  'Which installable PWA this subscription belongs to: erp (iPhoneRepasse Pro) or crmplus (CRM Plus).';

-- Backfill: existing subscriptions carrying CRM-only topics belong to CRM Plus.
-- Everything else keeps the column default ('erp').
update public.push_subscriptions
set product = 'crmplus'
where topics && array['crm_inbox', 'transfer_pending']::text[];

-- Index for product+store targeting used by push-send fan-out.
create index push_subscriptions_store_product_active_idx
  on public.push_subscriptions (store_id, product)
  where is_active = true;

-- Index for product-only targeting.
create index push_subscriptions_product_active_idx
  on public.push_subscriptions (product)
  where is_active = true;
