# Repasse AI Deterministic Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a versioned deterministic commerce core for the Repasse WhatsApp workflow, enforce the complete trade-in gate, support comparisons and payment revisions with up to two cards, isolate scenario audits, and expose operational state in the CRM.

**Architecture:** Pure TypeScript/JavaScript modules define trade-in, quote and payment rules and are covered by unit tests. Supabase persists versioned JSON contracts and telemetry while keeping legacy `lead_state` fields compatible. The n8n generator injects deterministic Code-node logic and atomic delivery metadata into the inactive v2 workflow; the app reads the same canonical state without duplicating business rules.

**Tech Stack:** TypeScript, JavaScript ES modules, Vitest, Deno Edge Functions, PostgreSQL/Supabase migrations, n8n workflow JSON and Code nodes, React.

---

### Task 1: Canonical Commerce Rules

**Files:**
- Create: `lib/crm/commerceState.ts`
- Create: `lib/crm/commerceState.test.ts`

- [ ] **Step 1: Write failing tests for trade-in pending fields**

Test that `getMissingTradeInFields()` excludes fields already supplied, requires `warranty_until` only when Apple warranty is true, and preserves the canonical question order.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run lib/crm/commerceState.test.ts`

Expected: FAIL because `commerceState.ts` does not exist.

- [ ] **Step 3: Implement canonical trade-in fields and gate**

Export:

```ts
export const TRADE_IN_QUESTION_FIELDS = [...]
export function getMissingTradeInFields(assessment): TradeInField[]
export function canSimulateTradeIn(assessment): boolean
export function buildTradeInQuestionnaire(missing): string
```

The questionnaire must place `R:` after every question.

- [ ] **Step 4: Add failing tests for comparison and action selection**

Cover:

- two devices default to `comparison`;
- explicit purchase of both becomes `bundle`;
- `awaiting_consent` returns `ask_tradein_consent`;
- consent plus pending fields returns `send_tradein_questionnaire`;
- complete assessment permits `simulate_quote`.

- [ ] **Step 5: Implement `resolveSimulationMode()` and `decideCommerceAction()`**

Return one action only and keep trade-in collection ahead of inventory or simulation.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npx vitest run lib/crm/commerceState.test.ts`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/crm/commerceState.ts lib/crm/commerceState.test.ts
git commit -m "feat: add deterministic commerce state rules"
```

### Task 2: Versioned Supabase State Contract

**Files:**
- Create: `supabase/migrations/20260610150000_repasse_commerce_state.sql`
- Create: `supabase/functions/crm-leads-api/commerce-state-contract.test.ts`
- Modify: `supabase/functions/crm-leads-api/index.ts`

- [ ] **Step 1: Write failing source-contract tests**

Require the migration to add:

```sql
commerce_state jsonb not null default '{}'::jsonb
tradein_assessment jsonb not null default '{}'::jsonb
quote_versions jsonb not null default '[]'::jsonb
state_version bigint not null default 0
```

Require `ai_turn_events` with `turn_id`, `conversation_id`, `lead_id`, `action`, timing, outcome and metadata.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run supabase/functions/crm-leads-api/commerce-state-contract.test.ts`

Expected: FAIL because migration and API fields are absent.

- [ ] **Step 3: Add repeatable migration and optimistic RPC**

Create `upsert_repasse_commerce_state(p_lead_id, p_expected_version, p_state, p_tradein, p_quotes)` that:

- locks the row;
- rejects stale versions;
- increments `state_version`;
- preserves store-scoped access;
- returns the updated row as JSON.

Create `record_ai_turn_event(...)` with service-role or store access checks.

- [ ] **Step 4: Expose canonical fields through `crm-leads-api`**

Add allowed fields and actions:

- `upsert_commerce_state`;
- `record_ai_turn_event`.

Keep `upsert_lead_state` unchanged for legacy callers.

- [ ] **Step 5: Run contract and existing API tests**

Run:

```bash
npx vitest run \
  supabase/functions/crm-leads-api/commerce-state-contract.test.ts \
  supabase/functions/crm-leads-api/lead-state-contract.test.ts \
  supabase/functions/crm-leads-api/crm-leads-api.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Validate migration locally**

Run: `npm run smoke:migrations`

Expected: migration health exits 0.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260610150000_repasse_commerce_state.sql supabase/functions/crm-leads-api
git commit -m "feat: persist versioned repasse commerce state"
```

### Task 3: Payment Revision And Two-Card Simulator

**Files:**
- Create: `lib/crm/paymentRevision.ts`
- Create: `lib/crm/paymentRevision.test.ts`
- Modify: `supabase/functions/crm-simulator-quote/index.ts`
- Modify: `supabase/functions/crm-simulator-quote/crm-simulator-quote.test.ts`
- Modify: `pages/crm/SimulatorPage.tsx`
- Modify: `pages/crm/SimulatorPage.test.tsx`

- [ ] **Step 1: Write failing tests for card grouping and split**

Cover:

- Visa and Master map to `visa_master`;
- Elo, Hipercard and Amex map to `outras`;
- same-group cards split an already taxed total without recalculating;
- different groups split the net amount and calculate each taxed total independently;
- allocations must sum to the financed amount or taxed total according to mode.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run lib/crm/paymentRevision.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pure payment revision helpers**

Export:

```ts
normalizeCardGroup()
splitSameGroupTaxedTotal()
calculateMixedGroupCards()
validateCardAllocations()
```

Use cent-based rounding to keep the two card totals exact.

- [ ] **Step 4: Extend Edge Function contract tests**

Require optional:

```json
{
  "paymentRevision": {
    "installments": 10,
    "cards": [
      { "brand": "visa", "amount": 3000 },
      { "brand": "master", "amount": 2850 }
    ],
    "amountMode": "taxed_total"
  }
}
```

The response must retain the original full installment table and add `paymentRevision`.

- [ ] **Step 5: Implement backward-compatible Edge Function support**

Single-card callers retain the current response. Two cards:

- same group + `taxed_total`: split the selected installment total;
- different groups + `net`: calculate each card independently;
- reject more than two cards, invalid totals and mixed amount modes.

- [ ] **Step 6: Add CRM simulator UI tests**

Test adding a second card, selecting brands and installments, and displaying net amount, fee, taxed total and installment amount.

- [ ] **Step 7: Implement focused simulator controls**

Reuse existing CRM form styles. Add no new business calculation in the component; call the pure helper.

- [ ] **Step 8: Run focused test suite**

Run:

```bash
npx vitest run \
  lib/crm/paymentRevision.test.ts \
  supabase/functions/crm-simulator-quote/crm-simulator-quote.test.ts \
  pages/crm/SimulatorPage.test.tsx
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add lib/crm/paymentRevision.ts lib/crm/paymentRevision.test.ts \
  supabase/functions/crm-simulator-quote pages/crm/SimulatorPage.tsx pages/crm/SimulatorPage.test.tsx
git commit -m "feat: support two-card payment revisions"
```

### Task 4: Deterministic n8n Core And Atomic Trade-In Delivery

**Files:**
- Create: `scripts/n8n/repasse-deterministic-core.mjs`
- Create: `scripts/n8n/test-repasse-deterministic-core.mjs`
- Modify: `scripts/n8n/build-repasse-next-workflow.mjs`
- Modify: `scripts/n8n/validate-repasse-next-workflow.mjs`
- Regenerate: `output/n8n/ia-repasse-pro-next.generated.json`

- [ ] **Step 1: Write failing executable tests**

Test pure functions for:

- missing trade-in fields;
- consent gate;
- questionnaire with `R:`;
- `delivery_mode: atomic`;
- comparison default;
- simulation blocked while any essential field is absent;
- payment revision extraction.

- [ ] **Step 2: Run script and verify RED**

Run: `node scripts/n8n/test-repasse-deterministic-core.mjs`

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement deterministic helper module**

Use JavaScript compatible with n8n Code nodes. Export testable functions plus code-string builders for insertion into workflow nodes.

- [ ] **Step 4: Patch the generated v2 workflow**

Add or repurpose Code nodes so the critical path:

- derives canonical commerce state;
- determines one action;
- sets `tradein_questionnaire_status`;
- emits atomic questionnaire metadata;
- prevents `shouldSimulateNow` while trade-in is incomplete;
- sends comparison/payment revision payloads to the simulator.

Keep legacy agents in shadow or fallback paths and keep the workflow inactive.

- [ ] **Step 5: Make splitter honor explicit delivery mode**

All relevant split Code nodes must return one item when:

```js
input.delivery_mode === "atomic"
|| input.alana?.delivery_mode === "atomic"
```

Keep the current `R:` heuristic only as fallback.

- [ ] **Step 6: Extend static workflow validation**

Require markers for:

- deterministic core;
- consent gate;
- atomic delivery;
- incomplete trade-in simulation block;
- two-card payment revision;
- comparison default.

- [ ] **Step 7: Build and validate locally**

Run:

```bash
node scripts/n8n/test-repasse-deterministic-core.mjs
node scripts/n8n/build-repasse-next-workflow.mjs
node scripts/n8n/validate-repasse-next-workflow.mjs
```

Expected: all commands exit 0 and workflow remains inactive.

- [ ] **Step 8: Validate complete workflow with n8n validator**

Run the MCP workflow validator against the generated JSON using runtime profile. Resolve errors before continuing; document known false-positive warnings.

- [ ] **Step 9: Commit**

```bash
git add scripts/n8n output/n8n/ia-repasse-pro-next.generated.json
git commit -m "feat: add deterministic trade-in core to repasse workflow"
```

### Task 5: Isolated Multi-Turn Scenario Harness

**Files:**
- Create: `scripts/n8n/repasse-scenario-harness.mjs`
- Create: `scripts/n8n/test-repasse-scenario-harness.mjs`
- Modify: `scripts/n8n/run-repasse-scenario-audit.mjs`

- [ ] **Step 1: Write failing tests for scenario expansion**

Cover:

- pronoun-only scenarios require prior turns;
- payment revision scenarios preserve previous quote context;
- each scenario receives unique lead and conversation identifiers;
- cleanup markers are present.

- [ ] **Step 2: Run and verify RED**

Run: `node scripts/n8n/test-repasse-scenario-harness.mjs`

Expected: FAIL because helper module is absent.

- [ ] **Step 3: Implement pure harness helpers**

Add multi-turn definitions, unique sandbox identity generation, validation and report metadata.

- [ ] **Step 4: Update live harness lifecycle**

For each scenario:

- create a sandbox lead and conversation;
- dispatch all turns in sequence;
- collect all AI responses;
- record per-turn timing;
- delete or mark sandbox rows for cleanup;
- restore workflow inactive in `finally`.

- [ ] **Step 5: Add critical scenarios**

Include:

- consent then atomic questionnaire;
- partial trade-in answer;
- blocked early simulation;
- two-model comparison;
- remove Pix entry;
- change installment count;
- Visa + Master same-group split;
- Visa + Elo mixed-group revision;
- pronoun-dependent installment follow-up.

- [ ] **Step 6: Run harness tests and list mode**

Run:

```bash
node scripts/n8n/test-repasse-scenario-harness.mjs
node scripts/n8n/run-repasse-scenario-audit.mjs --list-scenarios
```

Expected: all scenarios validate without remote writes.

- [ ] **Step 7: Commit**

```bash
git add scripts/n8n/run-repasse-scenario-audit.mjs scripts/n8n/repasse-scenario-harness.mjs scripts/n8n/test-repasse-scenario-harness.mjs
git commit -m "test: isolate repasse multi-turn scenario audits"
```

### Task 6: CRM Operational State

**Files:**
- Create: `components/crm/AICommerceStatePanel.tsx`
- Create: `components/crm/AICommerceStatePanel.test.tsx`
- Modify: `pages/crm/ConversationsPage.tsx`
- Modify: `types.ts`

- [ ] **Step 1: Write failing component tests**

Verify the panel shows:

- current AI action;
- trade-in status and missing fields;
- simulation mode and active quote version;
- block/handoff reason;
- no raw secret or internal prompt data.

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run components/crm/AICommerceStatePanel.test.tsx`

Expected: FAIL because component does not exist.

- [ ] **Step 3: Add canonical TypeScript types**

Define the read-only CRM view of commerce state and quote versions.

- [ ] **Step 4: Implement and integrate panel**

Use existing conversation layout and disclosure patterns. Keep the panel compact and hidden when no canonical state exists.

- [ ] **Step 5: Run focused UI tests**

Run:

```bash
npx vitest run \
  components/crm/AICommerceStatePanel.test.tsx \
  pages/crm/ConversationsPage.ai-handoff.test.tsx
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/crm/AICommerceStatePanel.tsx components/crm/AICommerceStatePanel.test.tsx pages/crm/ConversationsPage.tsx types.ts
git commit -m "feat: show canonical ai commerce state in crm"
```

### Task 7: Local Verification And Remote Deployment

**Files:**
- Modify only files needed to fix verification findings.

- [ ] **Step 1: Run full local verification**

Run:

```bash
npm run test:run
npm run typecheck
npm run build
npm run test:deno
node scripts/n8n/build-repasse-next-workflow.mjs
node scripts/n8n/validate-repasse-next-workflow.mjs
npm run smoke:migrations
```

Expected: all commands exit 0.

- [ ] **Step 2: Re-run Supabase identity preflight**

Run the guardrail summary and require project ref `ubuusaiezpyayqgfujbe`.

- [ ] **Step 3: Push migration through guarded CLI**

Run:

```bash
/Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/with_local_supabase_env.sh \
  --project-root "$(git rev-parse --show-toplevel)" -- supabase db push
```

Expected: the new migration applies only to `ubuusaiezpyayqgfujbe`.

- [ ] **Step 4: Deploy changed Edge Functions**

Deploy `crm-leads-api` and `crm-simulator-quote` with the guarded wrapper and explicit project ref.

- [ ] **Step 5: Deploy inactive n8n v2 workflow**

Use the repository build script with `--deploy`, verify ID `Cr4fPWe0prwS6XjI`, name, node count, webhook `repasse-next`, and `active=false`.

- [ ] **Step 6: Run remote contract smoke checks**

Read function logs, fetch workflow state, and run non-destructive API checks. Do not activate production or switch the production webhook.

- [ ] **Step 7: Commit any final verified fixes**

```bash
git add -A
git commit -m "chore: finalize deterministic repasse ai rollout"
```

