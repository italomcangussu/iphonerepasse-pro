# CRM Plus Simulador Trade-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CRM Plus Simulador page, Supabase configuration tables, and authenticated quote API for trade-in + entries + card installment simulations.

**Architecture:** Add a pure TypeScript simulation engine that formats the frontend result and API response from normalized inputs. Persist trade-in base values and adjustments in Supabase with RLS, load them through `DataProvider`, and expose the same calculation via a JWT-protected Edge Function. Wire a new CRM Plus route/menu item for sellers and admins.

**Tech Stack:** React 19, Vite, Vitest, Supabase Postgres/RLS, Supabase Edge Functions, TypeScript, Tailwind/local iOS CSS utilities.

---

### Task 1: Simulation Engine

**Files:**
- Create: `utils/simulator.ts`
- Test: `utils/simulator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `utils/simulator.test.ts` with tests for base trade-in lookup, adjustments, manual received value, entries, installment generation, validation errors, and WhatsApp/CRM message content.

Run: `npm test -- utils/simulator.test.ts`
Expected: FAIL because `utils/simulator.ts` does not exist.

- [ ] **Step 2: Implement the engine**

Create `utils/simulator.ts` exporting:
- `TradeInValueRule`
- `TradeInAdjustmentRule`
- `SimulatorEntry`
- `SimulatorCardBrand`
- `SimulatorQuoteInput`
- `SimulatorQuoteResult`
- `SIMULATOR_RESERVATION_HINT_AMOUNT`
- `DEFAULT_SIMULATOR_TRADE_IN_VALUES`
- `findTradeInValueRule`
- `getApplicableTradeInAdjustments`
- `calculateSimulatorQuote`
- `formatSimulatorMessage`

Use `calculateCardCharge`, `getCardRate`, `CARD_INSTALLMENTS_MAX`, and `DEFAULT_CARD_FEE_SETTINGS` from `utils/cardFees.ts`.

- [ ] **Step 3: Verify engine tests**

Run: `npm test -- utils/simulator.test.ts`
Expected: PASS.

### Task 2: Supabase Schema and Seeds

**Files:**
- Create: `supabase/migrations/20260528130000_crm_simulator_trade_in_settings.sql`

- [ ] **Step 1: Create migration**

Add tables:
- `public.simulator_trade_in_values`
- `public.simulator_trade_in_adjustments`

Add `updated_at` trigger, indexes, RLS, read policies for authenticated sellers/admins, write policies for admins, grants for authenticated users, and seed rows matching the approved spec.

- [ ] **Step 2: Validate project identity before remote writes**

Run:
`python3 /Users/italomendescangussu/.codex/skills/supabase-cli-mcp-guardrails/scripts/local_supabase_env.py --project-root "$(git rev-parse --show-toplevel)" --format summary`

Expected: local project ref resolves from `.env.local` or `.env`.

- [ ] **Step 3: Apply migration**

After identity validation, apply through Supabase MCP or CLI.

Expected: migration succeeds and tables exist.

### Task 3: DataProvider Simulator Config

**Files:**
- Modify: `types.ts`
- Modify: `services/dataContext.tsx`
- Test: `services/dataContext.test.tsx`

- [ ] **Step 1: Write failing DataProvider test**

Add test coverage that loaded simulator trade-in values/adjustments are exposed by `useData`, and admin update helpers upsert rows.

Run: `npm test -- services/dataContext.test.tsx`
Expected: FAIL because the new context fields do not exist.

- [ ] **Step 2: Implement DataProvider fields**

Add types:
- `SimulatorTradeInValue`
- `SimulatorTradeInAdjustment`

Expose:
- `simulatorTradeInValues`
- `simulatorTradeInAdjustments`
- `upsertSimulatorTradeInValue`
- `updateSimulatorTradeInValue`
- `removeSimulatorTradeInValue`
- `upsertSimulatorTradeInAdjustment`
- `updateSimulatorTradeInAdjustment`
- `removeSimulatorTradeInAdjustment`

Fetch both tables for authenticated users, map snake_case/camelCase, and subscribe to realtime changes.

- [ ] **Step 3: Verify DataProvider tests**

Run: `npm test -- services/dataContext.test.tsx`
Expected: PASS.

### Task 4: CRM Route and Page

**Files:**
- Modify: `components/crm/pageAccess.ts`
- Modify: `components/crm/crmPageMeta.ts`
- Modify: `components/crm/CRMStandaloneApp.tsx`
- Create: `pages/crm/SimulatorPage.tsx`
- Test: `components/crm/CRMStandaloneLayout.test.tsx`
- Test: `pages/crm/SimulatorPage.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Add tests proving sellers/admins see "Simulador", managers do not if existing CRM access conventions require it, stock/manual flows calculate a quote, and admins see the configuration tab.

Run: `npm test -- pages/crm/SimulatorPage.test.tsx components/crm/CRMStandaloneLayout.test.tsx`
Expected: FAIL because the page/route do not exist.

- [ ] **Step 2: Implement route/menu**

Add CRM page id `simulator`, title `Simulador`, icon `Calculator`, access for `admin` and `seller`, and route `/simulator`.

- [ ] **Step 3: Implement `SimulatorPage`**

Build the approved two-column desk layout:
- desired device: stock search/select or manual fields;
- trade-in model/capacity/color with suggested and editable value;
- selectable adjustments;
- entries list;
- card brand;
- live summary/installments/message;
- copy button;
- admin-only config tab for base values and adjustments.

- [ ] **Step 4: Verify UI tests**

Run: `npm test -- pages/crm/SimulatorPage.test.tsx components/crm/CRMStandaloneLayout.test.tsx`
Expected: PASS.

### Task 5: Edge Function API

**Files:**
- Create: `supabase/functions/crm-simulator-quote/index.ts`
- Test: `supabase/functions/crm-simulator-quote/crm-simulator-quote.test.ts`

- [ ] **Step 1: Write static/function contract test**

Add a test that checks the function requires `requireAuthenticatedRole`, queries simulator config/card fees/stock, validates unavailable stock, and returns `messageText`.

Run: `npm test -- supabase/functions/crm-simulator-quote/crm-simulator-quote.test.ts`
Expected: FAIL because function file does not exist.

- [ ] **Step 2: Implement function**

Create JWT-protected `POST` function. It should:
- handle `OPTIONS`;
- require authenticated role;
- parse JSON body;
- load `card_fee_settings`, simulator values and adjustments;
- resolve `stockItemId` or manual desired device;
- run equivalent simulator logic;
- return `{ success: true, ...quote }` or structured errors.

- [ ] **Step 3: Deploy function**

After identity validation, deploy `crm-simulator-quote` with JWT verification enabled.

Expected: deploy succeeds.

### Task 6: Final Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run targeted tests**

Run:
- `npm test -- utils/simulator.test.ts`
- `npm test -- pages/crm/SimulatorPage.test.tsx`
- `npm test -- components/crm/CRMStandaloneLayout.test.tsx`
- `npm test -- services/dataContext.test.tsx`
- `npm test -- supabase/functions/crm-simulator-quote/crm-simulator-quote.test.ts`

Expected: PASS.

- [ ] **Step 2: Run typecheck/build**

Run:
- `npm run typecheck`
- `npm run build`

Expected: PASS.

- [ ] **Step 3: Supabase advisor check**

Run Supabase security/performance advisors after migration.

Expected: no new critical blockers for the simulator tables/function.
