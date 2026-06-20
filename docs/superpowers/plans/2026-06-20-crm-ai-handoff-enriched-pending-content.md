# CRM AI Handoff Enriched Pending Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich manual "Transferir para IA" handoff payload text with all pending customer messages, including audio transcription and image description.

**Architecture:** Keep the webhook contract unchanged and improve the shared Edge Function helper that prepares AI payload text. `crm-conversation-handoff` will call async enrichment helpers before generating `summary_short` and dispatching the compact payload.

**Tech Stack:** Supabase Edge Functions on Deno, Deno tests, existing OpenRouter/Groq helper APIs, Supabase CLI `2.107.0` for deploy.

## Global Constraints

- Manual handoff remains `event: "manual_handoff_to_ai"` and `type: "text"`.
- `body.message.text` and `body.message.content` contain enriched pending customer text.
- `media.URL` remains `null` for manual handoff.
- Do not add `conversation_context`.
- Do not edit n8n workflow topology.
- Use TDD: write failing Deno tests before production code.
- Deploy only `crm-conversation-handoff`; shared `_shared` files are bundled with the function.

---

### Task 1: Add Enriched Pending Text Helpers

**Files:**
- Modify: `supabase/functions/_shared/crm_ai_payload.test.ts`
- Modify: `supabase/functions/_shared/crm_ai_payload.ts`

**Interfaces:**
- Produces: `resolveMessageTextForAi(args)` returning `{ text, mediaKind, usedFallback, error }`.
- Produces: `pendingCustomerTextForAiHandoffEnriched(messages, options)` returning `{ text, pendingMessageCount, enrichedMessageCount, mediaKinds, errors }`.
- Produces: `buildEnrichedTranscript(messages, options)` returning `{ transcript, enrichedMessageCount, mediaKinds, errors }`.

- [ ] **Step 1: Write failing tests**

Add tests proving text+audio pending messages are concatenated in order, human outbound resets the pending window, and audio failures degrade to fallback with diagnostics.

- [ ] **Step 2: Run RED**

Run:

```bash
deno test --sloppy-imports --node-modules-dir=auto --allow-read --allow-env --allow-net supabase/functions/_shared/crm_ai_payload.test.ts
```

Expected: FAIL because `pendingCustomerTextForAiHandoffEnriched` and `buildEnrichedTranscript` are not exported yet.

- [ ] **Step 3: Implement helper code**

Add async helper functions in `crm_ai_payload.ts`, reusing `transcribeAudioForAi`, `describeImageForAi`, `inferMediaKind`, and existing fallback behavior.

- [ ] **Step 4: Run GREEN**

Run the same Deno test command. Expected: PASS.

### Task 2: Wire Helpers Into Manual Handoff

**Files:**
- Modify: `supabase/functions/crm-conversation-handoff/index.ts`
- Modify: `supabase/functions/crm-send-message/index.contract.test.ts`

**Interfaces:**
- Consumes: helpers from Task 1.
- Produces: handoff payload `messageText = enrichedPendingText || enrichedLatestCustomerText`.

- [ ] **Step 1: Write failing contract test**

Update the handoff contract test to assert the source imports and uses `pendingCustomerTextForAiHandoffEnriched` and `buildEnrichedTranscript`.

- [ ] **Step 2: Run RED**

Run:

```bash
deno test --sloppy-imports --node-modules-dir=auto --allow-read --allow-env --allow-net supabase/functions/crm-send-message/index.contract.test.ts
```

Expected: FAIL because `crm-conversation-handoff` still uses synchronous `pendingCustomerTextForAiHandoff` and `buildTranscript`.

- [ ] **Step 3: Implement wiring**

Replace manual handoff text/summary preparation with enriched pending text and enriched transcript results. Extend the CRM event log payload with `pending_message_count`, `enriched_message_count`, `enrichment_media_kinds`, and `enrichment_errors`.

- [ ] **Step 4: Run GREEN**

Run the contract test and the shared helper test. Expected: PASS.

### Task 3: Verify And Deploy Supabase Function

**Files:**
- Deploy: `supabase/functions/crm-conversation-handoff`
- Verify: no schema changes.

**Interfaces:**
- Consumes: passing Deno tests from Tasks 1 and 2.
- Produces: deployed Edge Function with bundled shared helper changes.

- [ ] **Step 1: Run focused Edge Function tests**

```bash
deno test --sloppy-imports --node-modules-dir=auto --allow-read --allow-env --allow-net supabase/functions/_shared/crm_ai_payload.test.ts supabase/functions/crm-send-message/index.contract.test.ts
```

- [ ] **Step 2: Run full Deno Edge Function suite**

```bash
npm run test:deno
```

- [ ] **Step 3: Deploy**

```bash
supabase functions deploy crm-conversation-handoff --use-api
```

- [ ] **Step 4: Confirm git diff**

Review that only the plan, shared payload helper, handoff function, and tests changed, aside from pre-existing unrelated n8n worktree modifications.
