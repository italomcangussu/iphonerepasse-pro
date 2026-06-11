# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

iPhoneRepasse Pro is a React 19 + Vite SPA for managing a used-iPhone resale business (inventory, point-of-sale, finance, warranties) plus an embedded WhatsApp/Instagram **CRM Plus** with an AI agent. The backend is Supabase (Postgres + Auth + Edge Functions written in Deno). The app ships as an installable PWA. UI text and domain language are Brazilian Portuguese.

## Commands

```bash
npm run dev          # Vite dev server on :3000
npm run build        # Production build to dist/
npm run preview      # Preview the built bundle
npm start            # Serve dist/ statically on :3000 (production-like, via `serve`)
npm run lint         # ESLint (flat config)
npm run typecheck    # tsc --noEmit

npm test             # Vitest (watch) — frontend jsdom tests
npm run test:run     # Vitest single run (CI)
npm run test:deno    # Deno tests for supabase/functions/** (.test.ts / .deno.ts)
```

Run a single frontend test file or filter:
```bash
npx vitest run pages/Inventory.test.tsx
npx vitest run -t "reserves stock"      # by test name
```
Edge-function (Deno) tests are excluded from Vitest. There is also a Node-environment Vitest config for a subset: `npx vitest --config vitest.supabase.config.ts`.

Smoke tests (Playwright + migration/severity checks): `npm run smoke:run` (or `smoke:test`, `smoke:migrations`, `smoke:severity` individually).

## Environment

`.env.local` must define `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see [services/supabase.ts](services/supabase.ts)). `GEMINI_API_KEY` is wired into `process.env.API_KEY` by Vite. Push/PWA and CRM origin vars are in [.env.example](.env.example). Edge functions read their own secrets from `supabase/functions/.env`.

## Architecture

### Two apps, one bundle
The same SPA serves two products, selected at runtime in [App.tsx](App.tsx) by hostname/hash:
- **Main ERP app** — full router under `<DataProvider>` with all the business pages.
- **CRM Plus standalone** — when the host is the CRM hostname (`crm.iphonerepasse.com.br`) or the hash starts with `#/crmplus`, it renders [CRMStandaloneApp](components/crm/CRMStandaloneApp.tsx) instead, *without* `DataProvider`. Host/path/branding logic lives in [lib/crmRouting.ts](lib/crmRouting.ts) and [lib/runtimeBranding.ts](lib/runtimeBranding.ts) (swaps favicons, manifest, theme color, title per product).

Routing uses `HashRouter`. CRM pages are also mounted inside the main app under `/crm/*`.

### State & data layer
- [services/dataContext.tsx](services/dataContext.tsx) is the heart of the ERP: a single large `DataProvider` that loads stock, customers, sellers, sales, debts, finance, parts, reservations, etc. from Supabase and exposes every mutation as an async action. Most ERP pages consume this one context. When adding a business entity, you extend this context, its `DataContextType` interface, and [types.ts](types.ts).
- [contexts/AuthContext.tsx](contexts/AuthContext.tsx) — Supabase Auth session + `user_profiles` row. Distinguishes the DB base role (`admin`/`seller`) from an operational `AppRole` (`admin`/`manager`/`seller`) read from user metadata.
- CRM data is separate: [components/crm/useCRMStore.ts](components/crm/useCRMStore.ts) (`CRMStoreProvider`).

### Permissions
Two layers gate the UI:
- **Route roles** — `<ProtectedRoute allowedRoles={['admin']}>` (most `/crm/*` admin pages).
- **Permission matrix** — `<ProtectedRoute requiredPermission="inventory">`. Keys, labels, route prefixes and per-role defaults (`visible`/`editable`/`deletable`) are defined in [lib/permissions.ts](lib/permissions.ts) and surfaced through [contexts/PermissionsContext.tsx](contexts/PermissionsContext.tsx). Adding a gated page means adding a `PermissionKey` here.

### Supabase Edge Functions (`supabase/functions/`)
Deno functions, one folder per function with `index.ts`. Shared code lives in [supabase/functions/_shared/](supabase/functions/_shared/) (`crm.ts` helpers, `uazapi.ts` WhatsApp adapter, the AI routing/entry/payload engines). These are **excluded from tsconfig, ESLint, and Vitest** — they are typechecked/tested via Deno.

The CRM AI pipeline is the most intricate part:
- Inbound WhatsApp/Instagram webhooks → `crm-uaz-webhook-receiver` / `crm-instagram-webhook-receiver` → `crm-ai-inbound`.
- Routing decision (AI vs human) is computed in [_shared/crm_ai_routing.ts](supabase/functions/_shared/crm_ai_routing.ts) from channel `ai_entry_mode` + store `fallback_mode` + webhook config.
- **AI→human handoff has two distinct states** (see the header comment in [crm-ai-inbound/index.ts](supabase/functions/crm-ai-inbound/index.ts)): `transferencia_pendente` (AI stopped, lead blinks/locks at top of list, no human yet) vs `em_atendimento_humano` (a human clicked "Assumir"). Keep these in sync with `ConversationsPage`. Never route a handoff back through `applyAiRoutingDecision`.

### n8n integration
The AI agent's conversational logic runs in an external n8n workflow. [scripts/n8n/](scripts/n8n/) holds the deterministic core, memory guardrails, reply-context builders, and a scenario harness/quality-gate test suite (run the `test-repasse-*.mjs` scripts with `node`). The deployed workflow is fragile: prefer surgical patches over the build script (which clobbers and leaves the workflow OFF), and always reactivate after deploy. The test harness debounces by WhatsApp JID, so sandbox scenarios must use unique JIDs or they collide.

**Connection (two HTTP directions, no shared DB):**

- **App → n8n (inbound trigger):** when AI should answer, [_shared/crm_ai_inbound_dispatch.ts](supabase/functions/_shared/crm_ai_inbound_dispatch.ts) builds a compact payload via `buildCompactAiInboundPayload` ([_shared/crm_ai_payload.ts](supabase/functions/_shared/crm_ai_payload.ts)) and `POST`s it to the **per-channel** `ai_resume_webhook_url` (the n8n Webhook trigger node URL, stored on the channel row — there is no global webhook env var). The call has a 15s timeout (`DISPATCH_FETCH_TIMEOUT_MS`); raw inbound is truncated to 64 KB; every attempt is logged to `crm_event_log` as `crm_ai_inbound_dispatched` (with `webhook_url_host`, status, error).
- **n8n → app (callbacks):** n8n calls the [crm-n8n-api](supabase/functions/crm-n8n-api/index.ts) edge function, authenticated by the `x-api-key` header matching the `CRM_N8N_API_KEY` secret (falls back to a Supabase Bearer token). It dispatches on a `{ action, storeId, payload }` body; supported actions: `publish_event`, `upsert_lead`, `schedule_message`, `get_statistics`, `prepare_broadcast`, `broadcast_stats`, `cancel_broadcast`, `sync_campaign_tags`, `test_webhook`. Outbound replies themselves go through the WhatsApp/Instagram send path (`crm-send-message` / `uazapi.ts`), not this API.
- **Workflows:** the live workflow is `Cr4fPWe0prwS6XjI` ("ia repasse-pro v2 avancada"); [scripts/n8n/export-repasse-workflow.mjs](scripts/n8n/export-repasse-workflow.mjs) exports from source `oWNdWPUq6kEFitsnl8OpH`. n8n API base/key come from env (`N8N_*`) read by the scripts — never edit the deployed workflow blindly; export, patch, validate ([validate-repasse-next-workflow.mjs](scripts/n8n/validate-repasse-next-workflow.mjs)), then reactivate.

### Database
88+ ordered SQL files in [supabase/migrations/](supabase/migrations/) (timestamped `YYYYMMDDHHMMSS_*.sql`). This is the source of truth for the schema; add a new migration rather than editing existing ones.

## Conventions

- Path alias `@/` → repo root (configured in `tsconfig.json`, `vite.config.ts`, and both Vitest configs).
- Tests are colocated (`Foo.test.tsx` next to `Foo.tsx`), Testing Library + jsdom; global setup in [tests/setup.ts](tests/setup.ts). Some tests use a `.red.test.tsx` suffix for TDD red-phase specs.
- `noUnusedLocals`/`noUnusedParameters` are on — remove dead bindings. ESLint additionally enforces dead/unreachable-code guards (`no-unreachable`, `no-fallthrough`, etc.); see [eslint.config.js](eslint.config.js) for why.
- Build is manually chunked (`vendor-*` groups) with a 500 kB chunk warning limit — keep an eye on bundle size when adding heavy deps.
- PWA service worker is `public/sw.js` via `vite-plugin-pwa` `injectManifest`; the CRM and main app have separate web manifests.
- Mobile UI follows Apple HIG conventions documented in [AgenteHIG.md](AgenteHIG.md). The shared visual layer (design tokens, motion, theming) lives in [design-system/seroclub-iphonerepasse/](design-system/seroclub-iphonerepasse/).
- Implementation plans/specs live in three places: hand-written PRDs in [tasks/](tasks/) (`prd-*.md`, Portuguese), skill-generated plans/specs in [docs/superpowers/plans/](docs/superpowers/plans/) and `docs/superpowers/specs/`, and `prd.json` task lists in [ralph/](ralph/) for the Ralph autonomous-agent loop.
