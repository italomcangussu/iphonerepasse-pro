# CRM Plus UAZ Avatar Pipeline Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the three approved phases: immediate Realtime/security/UI fixes, durable background avatar jobs, and avatar lifecycle cleanup.

**Architecture:** The webhook durably coalesces one job per lead and persists the message without waiting for provider/image work. A shared worker claims due jobs atomically, uses UAZAPI `/chat/details`, and records retry or completion; Realtime and a resilient avatar component publish the result to the tenant-scoped UI.

**Tech Stack:** PostgreSQL/Supabase migrations and RLS, Supabase Edge Functions on Deno 2, TypeScript, React 19, Vitest, Deno test, Node test.

## Global Constraints

- UAZAPI avatar lookup is `POST /chat/details` with `{ number, preview }` and instance `token` header.
- All lead/job reads and writes include `store_id`; groups are excluded.
- The webhook must not await provider lookup, download, conversion, or upload.
- No arbitrary webhook-provided avatar URL is downloaded.
- Public object delivery remains compatible, but public Storage metadata listing is removed.
- `crm_leads` avatar updates must arrive through tenant-filtered Realtime.
- Schema changes are created with `supabase migration new` and every exposed table has RLS.

---

### Task 1: Realtime, Storage, and queue schema

**Files:**
- Create: `supabase/migrations/20260707143741_crm_uaz_avatar_pipeline_hardening.sql`
- Create: `tests/crm-avatar-migration-contract.test.ts`

**Interfaces:**
- Produces: `crm_uaz_avatar_jobs`, `enqueue_crm_uaz_avatar_job`, `claim_crm_uaz_avatar_jobs`, `complete_crm_uaz_avatar_job`, and the four new lead columns.

- [ ] Write a contract test that reads the generated migration and asserts Realtime publication, removal of `Public Read CRM Media`, RLS/revokes, unique `lead_id`, `FOR UPDATE SKIP LOCKED`, and store-scoped RPC arguments.
- [ ] Run `npx vitest run tests/crm-avatar-migration-contract.test.ts`; expect failure because the generated migration is empty.
- [ ] Implement the generated migration schema/RPCs with explicit grants and indexes.
- [ ] Re-run the contract test; expect pass.
- [ ] Commit migration and test as `feat(crm): add durable avatar job schema`.

### Task 2: Safe, idempotent avatar synchronization

**Files:**
- Modify: `supabase/functions/_shared/uazLeadAvatar.ts`
- Modify: `supabase/functions/_shared/uazLeadAvatar.test.ts`

**Interfaces:**
- Produces: `syncUazLeadAvatar(args)` statuses `synced|unchanged|missing|removed|failed|skipped_cooldown`; `removeStoredLeadAvatar`; HTTPS allowlist and redirect validation internal to the module.

- [ ] Add failing Deno tests for store-scoped updates, UAZ-only source lookup, timeout, rejected unsafe host/redirect, unchanged SHA-256, first missing preservation, second missing removal, and best-effort Storage cleanup.
- [ ] Run the focused Deno test and confirm each new behavior fails for the intended reason.
- [ ] Implement timeouts, safe redirect download, hashing, missing streak, storage path persistence, and removal without changing the WebP dimensions/quality.
- [ ] Re-run the focused Deno tests; expect pass.
- [ ] Commit as `fix(crm): harden UAZ avatar synchronization`.

### Task 3: Durable enqueue and background drain

**Files:**
- Create: `supabase/functions/_shared/uazAvatarJobs.ts`
- Create: `supabase/functions/_shared/uazAvatarJobs.test.ts`
- Modify: `supabase/functions/crm-uaz-webhook-receiver/index.ts`
- Modify: `supabase/functions/crm-uaz-webhook-receiver/crm-uaz-webhook-receiver.deno.ts`
- Modify: `supabase/functions/crm-uaz-avatar-refresh/index.ts`

**Interfaces:**
- Produces: `enqueueUazAvatarJob(context)` and `drainUazAvatarJobs({ supabase, limit })`; consumes the Task 1 RPCs and Task 2 sync statuses.

- [ ] Add failing tests that enqueue without provider work, coalesce by lead, claim bounded batches, complete success, and reschedule failures with delays `[300, 3600, 21600, 86400]` seconds.
- [ ] Add a receiver contract test asserting the synchronous `await syncUazLeadAvatar` call is absent and `EdgeRuntime.waitUntil` owns the drain.
- [ ] Run the focused Deno tests; expect failure because the job helper is absent and receiver still blocks.
- [ ] Implement the helper, replace synchronous sync with awaited enqueue plus background drain, and make the refresh endpoint enqueue/force/drain one job.
- [ ] Re-run focused Deno tests; expect pass.
- [ ] Commit as `feat(crm): process lead avatars through durable jobs`.

### Task 4: Realtime tenant filter and resilient avatar UI

**Files:**
- Create: `components/crm/CRMAvatarContent.tsx`
- Create: `components/crm/CRMAvatarContent.test.tsx`
- Modify: `components/crm/ConversationListItem.tsx`
- Modify: `components/crm/ConversationContextPanel.tsx`
- Modify: `pages/crm/ConversationsPage.tsx`
- Modify: `components/crm/conversationUi.ts`
- Modify: `components/crm/conversationUi.test.ts`

**Interfaces:**
- Produces: `<CRMAvatarContent avatarUrl name isGroup />` and `buildRealtimeStoreFilter(storeIds): string | null`.

- [ ] Add failing Vitest cases for broken-image fallback, reset on URL change, deduplicated store filters, and a `crm_leads` Realtime listener carrying the tenant filter.
- [ ] Run the focused Vitest files and confirm expected failures.
- [ ] Implement the component/helper and replace the three duplicated avatar render paths.
- [ ] Re-run focused Vitest files; expect pass.
- [ ] Commit as `fix(crm): make avatar updates realtime and resilient`.

### Task 5: Deletion and orphan lifecycle

**Files:**
- Modify: `supabase/functions/crm-delete-conversation/index.ts`
- Create: `supabase/functions/crm-delete-conversation/crm-delete-conversation.avatar.test.ts`
- Create: `scripts/crm/cleanup-orphan-uaz-lead-avatars.mjs`
- Create: `scripts/crm/cleanup-orphan-uaz-lead-avatars.test.mjs`

**Interfaces:**
- The delete function consumes `avatar_storage_path` and `removeStoredLeadAvatar`.
- The cleanup script exports `normalizeStoredAvatarPath`, `discoverOrphanLeadAvatars`, and `runOrphanLeadAvatarCleanup`.

- [ ] Add failing tests for best-effort deletion and exact orphan discovery limited to `avatars/**`.
- [ ] Run Deno and Node focused tests and confirm expected failures.
- [ ] Implement deletion cleanup and a dry-run default script requiring both `--apply` and `DRY != 1` for writes.
- [ ] Re-run focused tests; expect pass.
- [ ] Commit as `chore(crm): clean up lead avatar lifecycle`.

### Task 6: Final validation and deployment readiness

**Files:**
- Modify only files required by failures attributable to Tasks 1-5.

**Interfaces:**
- Produces: a deployable migration plus Edge/UI changes; no production deployment without a clean verification report.

- [ ] Run focused Vitest/Node tests, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [ ] Run `npm run test:deno` last; restore npm dependencies with `npm ci --include=dev --install-strategy=hoisted` before any later Vitest command.
- [ ] Run `npm run guard:rls` if present; otherwise run the repository's migration smoke command and remote Supabase security/performance advisors.
- [ ] Review the diff for secrets, unrelated changes, placeholder text, missing tenant filters, and destructive cleanup defaults.
- [ ] Commit final verification-only adjustments as `test(crm): verify avatar pipeline hardening`.
