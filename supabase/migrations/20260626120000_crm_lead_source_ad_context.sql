-- CRM Plus: persist the full Meta-ad creative context on the lead so the AI agent
-- (both on manual handoff to AI and on AI attendance) can recognize that the lead
-- arrived from a campaign image and understand which device the customer clicked.
--
-- The existing `source` / `source_campaign_id` / `source_campaign_title` columns only
-- carry the campaign title. A carousel ad sends, with the clicked card, a richer
-- `externalAdReply` (title + body + thumbnail/media image + source url). We capture a
-- compact snapshot of that here, plus a deterministically parsed `product_hint`
-- (model + capacity), so the n8n agent can greet like a human specialist would
-- ("você garantiu o iPhone 11 da oferta relâmpago — vamos reservar?").

begin;

alter table public.crm_leads
  add column if not exists source_ad_context jsonb;

comment on column public.crm_leads.source_ad_context is
  'Compact snapshot of the Meta/Instagram ad creative the lead arrived from '
  '(externalAdReply): { is_from_ad, source, campaign_id, campaign_title, '
  'campaign_body, campaign_name, image_url, source_url, product_hint }. '
  'Set once on first inbound detection; carried into the AI payload every turn.';

commit;
