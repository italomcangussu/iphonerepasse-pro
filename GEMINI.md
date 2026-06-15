# Project Overview

iPhoneRepasse Pro is a React 19 + Vite SPA for managing a used-iPhone resale business (inventory, point-of-sale, finance, warranties) plus an embedded WhatsApp/Instagram **CRM Plus** with an AI agent. 
The backend is Supabase (Postgres + Auth + Edge Functions written in Deno). The app ships as an installable PWA. UI text and domain language are Brazilian Portuguese.

## Architecture

### Two Apps, One Bundle
The same SPA serves two products, selected at runtime in `App.tsx` by hostname/hash:
- **Main ERP app** — full router under `<DataProvider>` with all the business pages.
- **CRM Plus standalone** — when the host is the CRM hostname (`crm.iphonerepasse.com.br`) or the hash starts with `#/crmplus`, it renders `CRMStandaloneApp` instead.

### State & Data Layer
- `services/dataContext.tsx` is the heart of the ERP: a single large `DataProvider` that loads everything from Supabase and exposes mutations.
- `contexts/AuthContext.tsx` manages Supabase Auth session + `user_profiles` row.
- CRM Plus reads from the same `DataProvider` but has its own routing and specific pages.

### Supabase Edge Functions (`supabase/functions/`)
Deno functions. Shared code in `_shared/`. Tested via Deno (`npm run test:deno`), excluded from Vitest.
The CRM AI pipeline routes inbound WhatsApp/Instagram webhooks and decides between AI or human routing.

### n8n Integration
The AI agent's conversational logic runs in an external n8n workflow. Scripts are in `scripts/n8n/`.
- App -> n8n: Webhooks triggered to per-channel URLs.
- n8n -> App: Callback via `crm-n8n-api` authenticated by `x-api-key`.

## Commands

- `npm run dev`: Vite dev server on :3000
- `npm run build`: Production build to dist/
- `npm run preview`: Preview the built bundle
- `npm start`: Serve dist/ statically on :3000
- `npm run lint`: ESLint (flat config)
- `npm run typecheck`: tsc --noEmit
- `npm test`: Vitest (watch) — frontend jsdom tests
- `npm run test:run`: Vitest single run
- `npm run test:deno`: Deno tests for supabase/functions
- `npm run smoke:run`: Playwright smoke tests

## Environment
- `.env.local` must define `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `GEMINI_API_KEY` is wired into `process.env.API_KEY` by Vite.

## Conventions

- Path alias `@/` points to repo root.
- Tests are colocated (e.g., `Foo.test.tsx` next to `Foo.tsx`), using Testing Library + jsdom.
- `noUnusedLocals`/`noUnusedParameters` are enabled.
- PWA service worker is `public/sw.js`.
- Mobile UI follows Apple HIG conventions (`AgenteHIG.md`). Shared design tokens are in `design-system/seroclub-iphonerepasse/`.
- Implementation plans live in `tasks/`, `docs/superpowers/plans/`, and `ralph/`.
