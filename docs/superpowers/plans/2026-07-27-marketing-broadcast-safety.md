# Marketing Broadcast Safety Implementation Plan

> **For agentic workers:** Execute inline in this session. Each task uses test-first verification and does not create a commit automatically.

**Goal:** Persist valid, safely scoped marketing broadcast drafts and correct audience calculations without claiming unsupported CRM behavior.

**Architecture:** Small pure helpers isolate the database payload and audience math from React. `CampaignsTab` consumes the payload helper and the existing accessible `Modal`; `AudienceTab` consumes the audience helper. No migration or worker change is needed because the UI exposes only the filters already enforced by the worker.

**Tech Stack:** React 19, TypeScript, Vitest, Supabase JS, Tailwind project primitives.

## Global Constraints

- No broadcast draft may use `message_text`; use `message_template`.
- `recipient_filters` may only contain `{}` or `{ is_customer: true }` in this UI.
- Do not introduce RFM recipient targeting without a server-side customer-to-lead contract.
- Reuse `components/ui/Modal` for dialog behavior.

---

### Task 1: Broadcast draft contract

**Files:**
- Create: `lib/marketing/broadcastDraft.test.ts`
- Create: `lib/marketing/broadcastDraft.ts`

- [x] Write failing tests asserting `message_template`, `status: 'draft'`, and `{ is_customer: true }` for the CRM-customer audience.
- [x] Run `npx vitest run lib/marketing/broadcastDraft.test.ts` and confirm the missing-module failure.
- [x] Implement `buildBroadcastDraft` with a narrow `BroadcastAudience` union.
- [x] Re-run the focused test and confirm it passes.

### Task 2: Audience business rules

**Files:**
- Create: `lib/marketing/audience.test.ts`
- Create: `lib/marketing/audience.ts`

- [x] Write failing tests that reject a missing RFM entry for a recency filter and divide audience revenue by purchases, not people.
- [x] Run `npx vitest run lib/marketing/audience.test.ts` and confirm the missing-module failure.
- [x] Implement `matchesMinimumRecency` and `computeAudienceStats`.
- [x] Re-run the focused test and confirm it passes.

### Task 3: Wire safe UI behavior

**Files:**
- Modify: `components/marketing/CampaignsTab.tsx`
- Modify: `components/marketing/AudienceTab.tsx`

- [x] Replace the manual overlay with `Modal`, use explicit labels, and reset the draft state when opening.
- [x] Persist the payload from `buildBroadcastDraft`; show success only after the insert succeeds and an inline actionable error otherwise.
- [x] Replace RFM audience choices with the worker-supported CRM choices and a clear RFM limitation notice.
- [x] Consume the audience helpers for recency and ticket metrics.
- [x] Run both focused helper tests after each integration change.

### Task 4: Verification

**Files:**
- Verify only.

- [x] Run `npx eslint` for the changed Marketing and helper files.
- [x] Run `npm run typecheck`, `npm run build`, and `npm run test:run`.
- [x] Run `git diff --check` and review the final diff for schema, filter, and accessibility contracts.
