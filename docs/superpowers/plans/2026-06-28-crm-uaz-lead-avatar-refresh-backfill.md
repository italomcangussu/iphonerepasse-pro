# CRM UAZ Lead Avatar Refresh and Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh live UAZApi lead avatars through `/chat/details`, backfill historical conversations, and propagate avatar-only updates to CRM Plus in realtime.

**Architecture:** A shared Deno avatar service owns provider lookup, cooldown, retry, WebP storage, database state, and telemetry. The webhook and a service-role-only refresh function reuse it; a dry-run-first Node orchestrator invokes the refresh function for historical candidates. A pure frontend reducer patches matching conversation avatars from `crm_leads` realtime events.

**Tech Stack:** Deno 2 Edge Functions, UAZApi v2.1.1, Supabase Postgres/Storage/Realtime, React 19, Vitest 4, Node 22.

## Global Constraints

- Do not touch n8n.
- Preserve tenant scoping and never log phone numbers, talk IDs, tokens, or provider image URLs.
- Keep `crm-media` public URLs; never expose raw WhatsApp URLs to the browser.
- Normal webhook refresh cooldown is exactly 24 hours; forced backfill bypasses it.
- Migrations and Edge Functions deploy through the Supabase CLI using `.env.local` credentials.
- All production behavior is introduced through a failing test first.

---

### Task 1: UAZApi chat-details contract

**Files:**
- Modify: `supabase/functions/_shared/uazapi.test.ts`
- Modify: `supabase/functions/_shared/uazapi.ts`

**Interfaces:**
- Produces: `buildUazChatDetailsRequest({ talkId, preview }): { endpoint: "/chat/details"; body: { number: string; preview: boolean } }`
- Produces: `parseUazChatAvatarUrl(payload): string | null` supporting top-level `imagePreview` and `image`.

- [ ] **Step 1: Write failing contract tests**

```ts
assertEquals(buildUazChatDetailsRequest({ talkId: "5585999999999@s.whatsapp.net", preview: true }), {
  endpoint: "/chat/details",
  body: { number: "5585999999999", preview: true },
});
assertEquals(parseUazChatAvatarUrl({ image: "https://pps.whatsapp.net/full.jpg" }), "https://pps.whatsapp.net/full.jpg");
```

- [ ] **Step 2: Verify RED**

Run: `deno test --allow-env --allow-net --allow-read supabase/functions/_shared/uazapi.test.ts`
Expected: FAIL because `buildUazChatDetailsRequest` is not exported.

- [ ] **Step 3: Implement the request builder and keep the tolerant parser**

```ts
export const buildUazChatDetailsRequest = ({ talkId, preview }: { talkId: string | null; preview: boolean }) => ({
  endpoint: "/chat/details" as const,
  body: { number: requireDigits(talkId), preview },
});
```

- [ ] **Step 4: Verify GREEN**

Run the Task 1 Deno test command; expect all tests to pass.

### Task 2: Shared avatar synchronization service

**Files:**
- Create: `supabase/functions/_shared/uazLeadAvatar.test.ts`
- Create: `supabase/functions/_shared/uazLeadAvatar.ts`
- Modify: `supabase/functions/crm-uaz-webhook-receiver/index.ts`
- Modify: `supabase/functions/crm-uaz-webhook-receiver/crm-uaz-webhook-receiver.deno.ts`

**Interfaces:**
- Produces: `syncUazLeadAvatar(args): Promise<UazLeadAvatarSyncResult>`.
- Consumes: UAZ chat-details builder/parser from Task 1 and existing `logCRMEvent`.

- [ ] **Step 1: Write failing service tests**

Cover cooldown, force bypass, direct webhook URL bypass for an empty avatar, missing-image preservation, 403 preview retry through full details, cache-busted public URL, timestamp updates, and sanitized telemetry.

```ts
const result = await syncUazLeadAvatar({ ...fixture, now: new Date("2026-06-28T12:00:00Z"), force: true });
assertEquals(result.status, "synced");
assertMatch(update.avatar_url, /\.webp\?v=1782648000000$/);
assertEquals(update.avatar_refreshed_at, "2026-06-28T12:00:00.000Z");
```

- [ ] **Step 2: Verify RED**

Run: `deno test --allow-env --allow-net --allow-read supabase/functions/_shared/uazLeadAvatar.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the shared service minimally**

Implement a 24-hour `avatar_last_checked_at` gate, `/chat/details` preview/full resolution, one retry for 401/403/404, existing validation limits, ImageMagick WebP conversion, deterministic Storage upload, `?v=` cache busting, timestamp updates, and safe telemetry.

- [ ] **Step 4: Replace receiver-local avatar code**

Select `api_endpoint` and avatar timestamp columns, then call:

```ts
await syncUazLeadAvatar({
  supabase, channel, storeId, leadId: resolvedLeadId, conversationId: null,
  talkId, payloadAvatarUrl: groupInfo.isGroup ? null : extractUazLeadAvatarUrl(body),
  trigger: "inbound_webhook",
});
```

- [ ] **Step 5: Verify GREEN**

Run both shared and receiver Deno tests; expect zero failures.

### Task 3: Avatar refresh state migration

**Files:**
- Create via CLI: output of `supabase migration new crm_uaz_avatar_refresh_state`

**Interfaces:**
- Produces: `crm_leads.avatar_last_checked_at timestamptz` and `crm_leads.avatar_refreshed_at timestamptz`.

- [ ] **Step 1: Create the migration with the CLI**

Run: `supabase migration new crm_uaz_avatar_refresh_state`

- [ ] **Step 2: Add additive SQL**

```sql
alter table public.crm_leads
  add column if not exists avatar_last_checked_at timestamptz,
  add column if not exists avatar_refreshed_at timestamptz;

update public.crm_leads
set avatar_last_checked_at = coalesce(avatar_last_checked_at, updated_at),
    avatar_refreshed_at = coalesce(avatar_refreshed_at, updated_at)
where avatar_lead_updated is true and nullif(btrim(avatar_url), '') is not null;
```

- [ ] **Step 3: Verify migration health**

Run: `npm run smoke:migrations`
Expected: exit 0 and no new migration ordering error.

### Task 4: Service-role refresh Edge Function

**Files:**
- Create: `supabase/functions/crm-uaz-avatar-refresh/index.ts`
- Create: `supabase/functions/crm-uaz-avatar-refresh/crm-uaz-avatar-refresh.test.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `{ leadId: string, force?: boolean }`.
- Produces: `{ success: boolean, status: UazLeadAvatarSyncStatus, retriedAfterExpiry: boolean }` without identifiers.

- [ ] **Step 1: Write failing handler tests**

Test rejection of a gateway-verified JWT without this project's `service_role`
claims and tenant-safe resolution of the latest non-group UAZ conversation.

- [ ] **Step 2: Verify RED**

Run the new Deno test; expect module-not-found or missing handler failure.

- [ ] **Step 3: Implement the handler**

Keep `verify_jwt = true`, require the validated bearer JWT to contain
`role=service_role` and the current project `ref`, query lead/conversation/channel
by the requested lead ID, call `syncUazLeadAvatar` with trigger `backfill`, and
return sanitized fields only.

- [ ] **Step 4: Verify GREEN**

Run the function test and shared avatar tests; expect zero failures.

### Task 5: Dry-run-first backfill orchestrator

**Files:**
- Create: `scripts/crm/backfill-uaz-lead-avatars.mjs`
- Create: `scripts/crm/backfill-uaz-lead-avatars.test.mjs`

**Interfaces:**
- Produces: `discoverAvatarBackfillCandidates(deps)` and `runAvatarBackfill({ apply, concurrency: 3 }, deps)`.

- [ ] **Step 1: Write failing Node tests**

```js
await runAvatarBackfill({ apply: false, concurrency: 3 }, deps);
assert.equal(deps.refreshCalls.length, 0);
await runAvatarBackfill({ apply: true, concurrency: 3 }, deps);
assert.equal(deps.refreshCalls.length, 2);
```

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/crm/backfill-uaz-lead-avatars.test.mjs`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement discovery, bounded apply, and sanitized report**

Read `.env.local` through the existing repository pattern, page PostgREST and UAZ `/chat/find`, correlate `talk_id`, omit leads with local avatars, invoke the refresh function only under `--apply`, and write aggregate reports to `output/crm/avatar-backfill/`.

- [ ] **Step 4: Verify GREEN**

Run the Node test; expect all tests to pass.

### Task 6: CRM Plus avatar realtime patch

**Files:**
- Modify: `components/crm/conversationUi.ts`
- Create: `components/crm/conversationUi.test.ts`
- Modify: `pages/crm/ConversationsPage.tsx`

**Interfaces:**
- Produces: `applyLeadAvatarUpdate(conversations, { id, avatar_url }): ConversationRow[]`.

- [ ] **Step 1: Write a failing pure reducer test**

```ts
expect(applyLeadAvatarUpdate(rows, { id: "lead-1", avatar_url: "https://cdn/avatar.webp?v=2" })[0].crm_leads?.avatar_url)
  .toBe("https://cdn/avatar.webp?v=2");
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run components/crm/conversationUi.test.ts`
Expected: FAIL because `applyLeadAvatarUpdate` is missing.

- [ ] **Step 3: Implement reducer and listener**

Add an `UPDATE` listener for `public.crm_leads` to the existing conversation-list realtime channel and patch only matching local rows.

- [ ] **Step 4: Verify GREEN**

Run the focused Vitest file and existing ConversationsPage tests; expect zero failures.

### Task 7: Full verification and production rollout

**Files:**
- Modify only if verification exposes a regression.

**Interfaces:**
- Produces: deployed migration/functions and a sanitized production backfill report.

- [ ] **Step 1: Run local verification**

```bash
npm run typecheck
npm run lint
npm run build
npm run test:run
npm run test:deno
npm run smoke:migrations
npm run smoke:severity
```

The repository has no `guard:rls` script; `smoke:severity` is its available
migration/RLS severity gate for this additive-column change.

- [ ] **Step 2: Verify target and migration state using CLI help-discovered commands**

Run `supabase db --help`, `supabase migration --help`, `supabase functions --help`, then verify linked project and remote migration list.

- [ ] **Step 3: Apply migration and deploy functions**

Use `supabase db push` for the linked project, then deploy `crm-uaz-webhook-receiver` and `crm-uaz-avatar-refresh` with `supabase functions deploy`.

- [ ] **Step 4: Verify deployment**

List function versions/statuses and query the two new columns through PostgREST with the service role.

- [ ] **Step 5: Run dry-run and apply backfill**

```bash
node scripts/crm/backfill-uaz-lead-avatars.mjs
node scripts/crm/backfill-uaz-lead-avatars.mjs --apply
```

- [ ] **Step 6: Verify production outcome**

Recompute UAZ-visible/local-null mismatches, aggregate `crm_uaz_avatar_sync` statuses, sample public Storage responses, and confirm no secret or PII appears in the report.
