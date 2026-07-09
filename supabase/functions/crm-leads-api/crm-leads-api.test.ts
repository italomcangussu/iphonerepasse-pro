import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('supabase/functions/crm-leads-api/index.ts', 'utf8');
const stripWebhookMigrationSource = readFileSync('supabase/migrations/20260529171500_strip_webhook_payload_from_lead_api.sql', 'utf8');
const latestChangeMigrationSource = readFileSync('supabase/migrations/20260529173000_get_lead_full_data_latest_change.sql', 'utf8');
const latestConversationMigrationSource = readFileSync('supabase/migrations/20260529174000_get_lead_full_data_latest_conversation.sql', 'utf8');
const latestMessageMigrationSource = readFileSync('supabase/migrations/20260529174500_get_lead_full_data_latest_message.sql', 'utf8');
const searchLeadsAgentContextSource = readFileSync('supabase/migrations/20260612144500_search_leads_stage_history.sql', 'utf8');
const crmAdsSaleTraceabilitySource = readFileSync('supabase/migrations/20260709150921_crm_ads_sale_traceability.sql', 'utf8');
const crmAdsSaleTraceabilityGrantsSource = readFileSync('supabase/migrations/20260709151958_harden_crm_sale_traceability_function_grants.sql', 'utf8');
const crmAdsRealConversionDetailsSource = readFileSync('supabase/migrations/20260709153400_crm_ads_real_conversion_details.sql', 'utf8');
const crmAdsDashboardCteScopeFixSource = readFileSync('supabase/migrations/20260709153855_fix_crm_ads_dashboard_cte_scope.sql', 'utf8');
const crmAdsCrossStoreCustomerConversionSource = readFileSync('supabase/migrations/20260709154413_fix_crm_ads_cross_store_customer_conversion.sql', 'utf8');

describe('crm-leads-api edge function contract', () => {
  it('accepts the internal n8n API key as an alternative to user bearer auth', () => {
    expect(source).toContain('CRM_N8N_API_KEY');
    expect(source).toContain('x-api-key');
    expect(source).toContain('requireAuthenticatedRole(req, supabase)');
    expect(source).toContain('Unauthorized. Use x-api-key ou Bearer válido.');
  });

  it('forwards sales_stage filters to the lead search RPC', () => {
    expect(source).toContain('url.searchParams.get("sales_stage")');
    expect(source).toContain('filters.sales_stage = salesStage');
  });

  it('keeps only the latest lead search item for n8n list requests', () => {
    expect(source).toContain('const keepOnlyLatestSearchLeadItem');
    expect(source).toContain('record.items[0]');
    expect(source).toContain('data: isN8NRequest ? keepOnlyLatestSearchLeadItem(data) : data');
  });

  it('exposes agent context in lead search results', () => {
    expect(searchLeadsAgentContextSource).toContain('create or replace function public.search_leads');
    expect(searchLeadsAgentContextSource).toContain('l.attendance_owner');
    expect(searchLeadsAgentContextSource).toContain('stage_history');
    expect(searchLeadsAgentContextSource).toContain('from public.crm_lead_stage_history h');
    expect(searchLeadsAgentContextSource).toContain('limit 1');
  });

  it('strips webhook_payload from get lead message payloads', () => {
    expect(stripWebhookMigrationSource).toContain('create or replace function public.get_lead_full_data');
    expect(stripWebhookMigrationSource).toContain("to_jsonb(m) - 'webhook_payload'");
    expect(stripWebhookMigrationSource).toContain("'source_channel', case");
    expect(stripWebhookMigrationSource).not.toContain("'api_key', ch.api_key");
    expect(stripWebhookMigrationSource).not.toContain("'uaz_admin_token', ch.uaz_admin_token");
    expect(stripWebhookMigrationSource).not.toContain("'webhook_secret', ch.webhook_secret");
  });

  it('returns all crm_leads columns and only the latest stage change', () => {
    expect(latestChangeMigrationSource).toContain('select to_jsonb(l)');
    expect(latestChangeMigrationSource).toContain('from public.crm_leads l');
    expect(latestChangeMigrationSource).toContain('from public.crm_lead_stage_history h');
    expect(latestChangeMigrationSource).toContain('limit 1');
    expect(latestChangeMigrationSource).toContain("to_jsonb(m) - 'webhook_payload'");
  });

  it('returns only the latest conversation in get lead', () => {
    expect(latestConversationMigrationSource).toContain('from public.crm_conversations c');
    expect(latestConversationMigrationSource).toContain('order by c.last_message_at desc nulls last, c.created_at desc, c.id desc');
    expect(latestConversationMigrationSource).toContain('limit 1');
  });

  it('returns only the latest message in the latest conversation', () => {
    expect(latestMessageMigrationSource).toContain('from public.crm_messages m');
    expect(latestMessageMigrationSource).toContain('order by m.created_at desc, m.id desc');
    expect(latestMessageMigrationSource).toContain('limit 1');
    expect(latestMessageMigrationSource).toContain("to_jsonb(m) - 'webhook_payload'");
  });

  it('adds direct sale-to-lead traceability for Ads attribution', () => {
    expect(crmAdsSaleTraceabilitySource).toContain('add column if not exists crm_lead_id text');
    expect(crmAdsSaleTraceabilitySource).toContain('references public.crm_leads(id) on delete set null');
    expect(crmAdsSaleTraceabilitySource).toContain('create index if not exists idx_sales_crm_lead_id');
    expect(crmAdsSaleTraceabilitySource).toContain('create or replace function public.resolve_crm_lead_for_sale');
    expect(crmAdsSaleTraceabilitySource).toContain('customers.alternative_phone');
    expect(crmAdsSaleTraceabilitySource).toContain("p_payload->>'crmLeadId'");
  });

  it('exposes lead traceability with direct and inferred sale buckets', () => {
    expect(crmAdsSaleTraceabilitySource).toContain('create or replace function public.get_lead_full_data');
    expect(crmAdsSaleTraceabilitySource).toContain("'traceability'");
    expect(crmAdsSaleTraceabilitySource).toContain("'customer_link'");
    expect(crmAdsSaleTraceabilitySource).toContain("'ads'");
    expect(crmAdsSaleTraceabilitySource).toContain("'direct'");
    expect(crmAdsSaleTraceabilitySource).toContain("'inferred_by_customer'");
    expect(crmAdsSaleTraceabilitySource).toContain('s.crm_lead_id = p_lead_id');
  });

  it('makes the Ads dashboard prefer direct CRM lead sales before lifetime fallback', () => {
    expect(crmAdsSaleTraceabilitySource).toContain('create or replace function public.get_crm_ads_dashboard');
    expect(crmAdsSaleTraceabilitySource).toContain('direct_revenue');
    expect(crmAdsSaleTraceabilitySource).toContain('fallback_revenue');
    expect(crmAdsSaleTraceabilitySource).toContain('from public.sales s');
    expect(crmAdsSaleTraceabilitySource).toContain('s.crm_lead_id = a.lead_id');
    expect(crmAdsSaleTraceabilitySource).toContain('coalesce(sum(ds.direct_revenue), 0)');
  });

  it('exposes real Ads conversion evidence with lead, customer and sale details', () => {
    expect(crmAdsRealConversionDetailsSource).toContain("'real_customers'");
    expect(crmAdsRealConversionDetailsSource).toContain("'real_conversion_rate'");
    expect(crmAdsRealConversionDetailsSource).toContain('as conversions');
    expect(crmAdsRealConversionDetailsSource).toContain('as conversion_source');
    expect(crmAdsRealConversionDetailsSource).toContain("'direct_sale'");
    expect(crmAdsRealConversionDetailsSource).toContain('jsonb_agg(row_to_json(c) order by c.sale_date desc nulls last, c.sale_number desc nulls last)');
    expect(crmAdsRealConversionDetailsSource).toContain('left join public.customers c on c.id = s.customer_id');
    expect(crmAdsRealConversionDetailsSource).toContain('from public.sale_items si');
    expect(crmAdsRealConversionDetailsSource).toContain('left join public.stock_items sti on sti.id = si.stock_item_id');
  });

  it('keeps Ads dashboard groups and summary in the same CTE scope', () => {
    expect(crmAdsDashboardCteScopeFixSource).toContain('groups_payload as');
    expect(crmAdsDashboardCteScopeFixSource).toContain('summary_payload as');
    expect(crmAdsDashboardCteScopeFixSource).toContain('select gp.groups, sp.summary');
    expect(crmAdsDashboardCteScopeFixSource).not.toContain('from lead_stats t;\n\n  return jsonb_build_object');
  });

  it('counts real Ads conversions when the ERP sale is in another store for the same customer', () => {
    expect(crmAdsCrossStoreCustomerConversionSource).toContain('candidate_sales as');
    expect(crmAdsCrossStoreCustomerConversionSource).toContain('s.store_id as sale_store_id');
    expect(crmAdsCrossStoreCustomerConversionSource).toContain("'customer_id_sale'");
    expect(crmAdsCrossStoreCustomerConversionSource).toContain("'phone_customer_sale'");
    expect(crmAdsCrossStoreCustomerConversionSource).toContain('join public.sales s on s.customer_id = c.id');
    expect(crmAdsCrossStoreCustomerConversionSource).not.toContain('and (s.store_id = p_store_id or s.store_id is null)');
  });

  it('keeps sale traceability helper functions off browser-executable roles', () => {
    expect(crmAdsSaleTraceabilityGrantsSource).toContain('revoke all on function public.resolve_crm_lead_for_sale(text, text, text, boolean) from public, anon, authenticated');
    expect(crmAdsSaleTraceabilityGrantsSource).toContain('revoke all on function public.sales_set_crm_lead_id() from public, anon, authenticated');
    expect(crmAdsSaleTraceabilityGrantsSource).toContain('revoke all on function public.crm_sales_purchase_sync_trigger() from public, anon, authenticated');
    expect(crmAdsSaleTraceabilityGrantsSource).toContain('grant execute on function public.crm_refresh_lead_purchase_metrics(text) to service_role');
  });
});
