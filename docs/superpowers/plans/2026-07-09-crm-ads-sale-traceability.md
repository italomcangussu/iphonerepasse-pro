# CRM Ads Sale Traceability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct CRM lead attribution to ERP sales and expose Ads-to-sale traceability in CRM Plus lead detail.

**Architecture:** Add `sales.crm_lead_id` plus SQL helpers/read models in one migration, then thread the optional field through frontend sale mapping and the CRM Leads detail UI. Ads dashboard revenue will prefer direct sales while keeping the existing lifetime-value fallback for old rows.

**Tech Stack:** Supabase Postgres migrations and RPCs, React 19 + Vite, Vitest contract/UI tests.

## Global Constraints

- Implement inline on `main`; do not create a worktree.
- Do not touch the live n8n workflow.
- Do not create new public tables in this phase.
- Use TDD: write failing tests before production changes.
- Preserve unrelated local changes in `components/StockFormModal*` and `services/pwa*`.

---

### Task 1: Database Contract And Migration

**Files:**
- Modify: `supabase/functions/crm-leads-api/crm-leads-api.test.ts`
- Modify: `supabase/migrations/20260709150921_crm_ads_sale_traceability.sql`

**Interfaces:**
- Produces: `public.sales.crm_lead_id`
- Produces: `public.resolve_crm_lead_for_sale(p_customer_id text, p_store_id text default null, p_explicit_lead_id text default null, p_conservative boolean default false) returns text`
- Produces: updated `public.create_sale_full(p_payload jsonb)`
- Produces: updated `public.get_lead_full_data(p_lead_id text)` with `traceability`
- Produces: updated `public.get_crm_ads_dashboard(p_store_id text)`

- [ ] **Step 1: Write failing contract tests**
  Add assertions that the new migration defines `sales.crm_lead_id`, resolver, traceability payload, and Ads dashboard direct revenue.

- [ ] **Step 2: Run the contract test red**
  Run: `npx vitest run supabase/functions/crm-leads-api/crm-leads-api.test.ts`
  Expected: FAIL because the migration is empty.

- [ ] **Step 3: Implement the SQL migration**
  Add the column/FK/index, resolver, conservative backfill, updated purchase metrics, sale RPC, lead detail RPC, Ads dashboard RPC, and grants for callable helpers.

- [ ] **Step 4: Run contract test green**
  Run: `npx vitest run supabase/functions/crm-leads-api/crm-leads-api.test.ts`
  Expected: PASS.

### Task 2: Frontend Sale Payload And Types

**Files:**
- Modify: `types.ts`
- Modify: `services/dataContext.tsx`
- Modify: `services/dataContext.test.tsx`

**Interfaces:**
- Consumes: `Sale.crmLeadId?: string | null`
- Produces: sale payload field `crmLeadId`
- Produces: mapped sale field `crmLeadId`

- [ ] **Step 1: Write failing DataContext test**
  Add a focused expectation that mapped sales expose `crmLeadId` and `create_sale_full` payload includes `crmLeadId`.

- [ ] **Step 2: Run DataContext test red**
  Run: `npx vitest run services/dataContext.test.tsx -t "crmLeadId"`
  Expected: FAIL because the field is not mapped.

- [ ] **Step 3: Implement type and payload mapping**
  Add `crmLeadId` to `Sale`, `mapSale`, and `buildSaleFullPayload`.

- [ ] **Step 4: Run DataContext test green**
  Run: `npx vitest run services/dataContext.test.tsx -t "crmLeadId"`
  Expected: PASS.

### Task 3: CRM Lead Traceability UI

**Files:**
- Modify: `pages/CRMLeads.tsx`
- Modify: `pages/CRMLeads.deepLink.test.tsx`

**Interfaces:**
- Consumes: `detail.traceability.customer_link`
- Consumes: `detail.traceability.ads`
- Consumes: `detail.traceability.sales`

- [ ] **Step 1: Write failing UI test**
  Add a test fixture with `traceability` showing an Ads lead and a direct sale, then assert the section renders "Rastreabilidade", "Venda atribuida diretamente", campaign title, and sale value.

- [ ] **Step 2: Run UI test red**
  Run: `npx vitest run pages/CRMLeads.deepLink.test.tsx`
  Expected: FAIL because the UI lacks the section.

- [ ] **Step 3: Implement CRM Leads traceability section**
  Map `detail.traceability`, format direct/inferred sales separately, and render a compact section in the selected lead detail.

- [ ] **Step 4: Run UI test green**
  Run: `npx vitest run pages/CRMLeads.deepLink.test.tsx`
  Expected: PASS.

### Task 4: Verification

**Files:**
- No production file changes expected.

- [ ] **Step 1: Run focused tests**
  Run: `npx vitest run supabase/functions/crm-leads-api/crm-leads-api.test.ts services/dataContext.test.tsx pages/CRMLeads.deepLink.test.tsx`
  Expected: PASS.

- [ ] **Step 2: Run typecheck**
  Run: `npm run typecheck`
  Expected: PASS.

- [ ] **Step 3: Inspect git diff**
  Run: `git diff --stat && git status --short`
  Expected: only planned files plus pre-existing unrelated local changes.
