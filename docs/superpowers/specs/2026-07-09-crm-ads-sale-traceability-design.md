# CRM Ads Sale Traceability Design

## Context

CRM Plus already records paid-ad origin on `crm_leads` through fields such as
`source`, `source_campaign_id`, `source_campaign_title`, and
`source_ad_context`. The Ads dashboard groups those leads through
`crm_meta_ads_groups` and `crm_meta_ads_attributions`, then calculates customers
and revenue from lead purchase metrics.

That is useful, but it is still indirect. A real sale in the ERP currently points
to `customers.id`, while the lead points to `customers.id` through
`crm_leads.customer_id`. The system can infer that an ad lead became a buyer, but
it cannot prove that a specific ERP sale came from a specific CRM lead.

This phase makes the CRM Plus lead detail page show a clear audit trail from ad
origin to real ERP sale, and adds a direct sale-to-lead link so attribution is no
longer only inferred through the customer.

## Goals

- In CRM Plus, opening a lead shows whether it came from Ads and whether it
  converted into real ERP sales.
- Store direct attribution on each sale through `sales.crm_lead_id`.
- Keep the existing `crm_leads.customer_id` relationship as the customer-level
  bridge.
- Backfill old sales conservatively, avoiding wrong ad attribution when multiple
  lead candidates are ambiguous.
- Keep the first delivery focused on CRM Plus lead auditability, not broad ERP UI
  changes.

## Non-Goals

- Do not redesign the PDV flow in this phase.
- Do not add a full trace-event ledger table yet.
- Do not require a user to manually select a CRM lead during every sale.
- Do not rename existing CRM, n8n, or lead-state entities.

## Data Model

Add a nullable direct attribution column:

```sql
alter table public.sales
  add column if not exists crm_lead_id text references public.crm_leads(id) on delete set null;
```

Add an index for lead detail and Ads attribution queries:

```sql
create index if not exists idx_sales_crm_lead_id
  on public.sales (crm_lead_id)
  where crm_lead_id is not null;
```

Because this is an existing exposed table, no new public table or RLS policy is
needed. If a future phase creates trace-event tables, that phase must include
explicit grants and RLS policies.

## Lead Resolution

Create or update database logic to resolve one CRM lead for a sale.

Inputs:

- `customerId`
- optional `storeId`
- optional explicit `crmLeadId` from the sale payload, for future UI support

Resolution priority:

1. Use explicit `crmLeadId` when it exists, belongs to the same store when a store
   is known, and points to the sale customer or has a compatible customer/phone.
2. Match a lead with `crm_leads.customer_id = customerId`.
3. Match by `customers.phone`.
4. Match by `customers.alternative_phone`.

When several candidates exist, choose:

1. a lead with Ads origin first (`source in ('meta_ads', 'instagram_ads',
   'click_to_whatsapp')` or non-null ad context);
2. then the most recent `last_interaction_at`;
3. then newest `created_at`;
4. then deterministic `id` order.

Backfill must be more conservative than live sale creation:

- auto-fill only when the resolver finds one clear best candidate;
- leave `sales.crm_lead_id` null when multiple candidates have equal rank;
- never overwrite a non-null `sales.crm_lead_id`.

## Sale Creation And Update

Update `create_sale_full` so inserts and updates persist `crm_lead_id`.

Behavior:

- Accept optional `crmLeadId` in the JSON payload.
- If absent, resolve the lead from the sale customer.
- Persist the resolved value on `sales.crm_lead_id`.
- After sale insert/update/delete, refresh CRM purchase metrics for affected
  customers and leads.

The frontend `buildSaleFullPayload` may include `crmLeadId` as `null` for now.
No PDV selection UI is required in this phase.

## CRM Lead Full Data

Extend `get_lead_full_data(p_lead_id)` with a `traceability` object.

Shape:

```json
{
  "traceability": {
    "customer_link": {
      "customer_id": "cust_...",
      "source": "explicit_customer_id | phone_match | alternative_phone_match | unmatched",
      "confidence": "direct | high | medium | none"
    },
    "ads": {
      "is_ad_lead": true,
      "source": "meta_ads",
      "campaign_id": "...",
      "campaign_title": "...",
      "group_key": "...",
      "source_app": "facebook",
      "sample_source_url": "..."
    },
    "sales": {
      "direct": [],
      "inferred_by_customer": [],
      "direct_revenue": 0,
      "inferred_revenue": 0,
      "purchase_count": 0,
      "last_sale": null
    }
  }
}
```

Direct sales come from `sales.crm_lead_id = p_lead_id`.
Inferred sales come from `sales.customer_id = crm_leads.customer_id` only when
they are not already directly attributed. The UI must label the difference.

## Ads Dashboard Attribution

Update `get_crm_ads_dashboard` to prefer direct sale attribution.

Per ad group:

- leads still come from `crm_meta_ads_attributions`;
- customers count leads with direct sales first;
- revenue sums `sales.total` through `sales.crm_lead_id`;
- fallback to `crm_leads.lifetime_value` only for leads with no direct attributed
  sale, preserving historical behavior while the backfill matures.

This makes campaign revenue auditable from:

`crm_meta_ads_groups -> crm_meta_ads_attributions.lead_id -> sales.crm_lead_id`.

## CRM Plus UI

In `pages/CRMLeads.tsx`, add a "Rastreabilidade" section to the selected lead
detail panel.

The section shows:

- Ads origin and campaign/ad label when present.
- Customer ERP link status.
- Conversion status:
  - "Venda atribuida diretamente" when direct sales exist.
  - "Compra inferida pelo cliente" when only customer-level fallback exists.
  - "Sem venda encontrada" when neither exists.
- KPIs: direct revenue, inferred revenue, purchase count, last sale date/value.
- A compact list of recent attributed sales.
- Existing conversation entry point when a conversation id is available.

The UI must not imply certainty when the sale is inferred. Direct and inferred
labels are part of the product behavior, not decorative copy.

## Tests

Database and contract tests:

- `sales.crm_lead_id` column, FK, and index exist in the migration.
- sale creation RPC persists a resolved `crm_lead_id`.
- resolver matches by `customer_id`, phone, and `alternative_phone`.
- backfill leaves ambiguous candidates null.
- `get_lead_full_data` returns the `traceability` object with direct and inferred
  sale buckets.
- `get_crm_ads_dashboard` calculates revenue from `sales.crm_lead_id` before the
  legacy `lifetime_value` fallback.

Frontend tests:

- CRM lead detail renders Ads origin.
- CRM lead detail renders a direct sale attribution label and values.
- CRM lead detail renders an inferred purchase label when no direct sale exists.
- Empty state is explicit when there is no ERP customer or sale.

## Rollout

1. Add migration for `sales.crm_lead_id`, resolver, RPC updates, backfill, and
   read-model updates.
2. Add focused contract tests for migration/RPC behavior.
3. Update `CRMLeads` data mapping and traceability UI.
4. Run targeted Vitest tests and Deno/Supabase tests where available.
5. Run full typecheck and relevant smoke checks if the touched surface expands.

## Future Phase

Add explicit lead selection in PDV and ERP customer/sale detail backlinks.
If attribution disputes become common, add a trace-event ledger table recording
who or what linked each lead, customer, and sale.
