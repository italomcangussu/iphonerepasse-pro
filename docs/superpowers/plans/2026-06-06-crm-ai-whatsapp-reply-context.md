# CRM AI WhatsApp Reply Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured WhatsApp reply context to the continuous CRM AI flow so n8n agents understand which previous message the customer is referencing.

**Architecture:** Keep the compact AI inbound payload and add a small `reply_context` object beside the current message text. Supabase resolves the replied-to message best-effort from existing `crm_messages` columns, while n8n preserves the object through Redis buffering and renders a deterministic context line before Router, Memory, and Bia agents run.

**Tech Stack:** Supabase Edge Functions on Deno/TypeScript, existing CRM `crm_messages` schema, n8n Public API, Node.js 22 ESM fixture scripts, `.env.local` `N8N_PUBLIC_API`.

---

## File Structure

- Modify `supabase/functions/_shared/crm_ai_payload.ts`
  - Owns `CrmAiReplyContext`, sanitization, and compact payload shaping.
- Modify `supabase/functions/_shared/crm_ai_payload.test.ts`
  - Covers payload contract for resolved, preview-only, missing, and absent reply context.
- Modify `supabase/functions/_shared/crm_ai_inbound_dispatch.ts`
  - Resolves reply target from `crm_messages` and passes `reply_context` into the compact payload.
- Modify `supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts`
  - Covers lookup order, fallback behavior, dispatch continuity, and compact logging.
- Create `scripts/n8n/repasse-reply-context.mjs`
  - Pure formatter and n8n injection block for reply-aware buffer normalization/rendering.
- Create `scripts/n8n/test-repasse-reply-context.mjs`
  - Fixture tests matching the WhatsApp reply examples.
- Modify `scripts/n8n/apply-repasse-memory-guardrails.mjs`
  - Reuse the current n8n Public API patcher to also inject reply-context changes.

---

### Task 1: Add Compact Reply Context Payload Contract

**Files:**
- Modify: `supabase/functions/_shared/crm_ai_payload.ts`
- Modify: `supabase/functions/_shared/crm_ai_payload.test.ts`

- [ ] **Step 1: Write failing payload tests**

Append these tests to `supabase/functions/_shared/crm_ai_payload.test.ts`:

```ts
Deno.test("buildCompactAiInboundPayload includes resolved reply_context", () => {
  const payload = buildCompactAiInboundPayload({
    instanceName: "crm",
    storeId: "store-1",
    leadId: "558899999999",
    leadSummaryShort: "Cliente negocia iPhone 17 Pro.",
    senderName: "Cliente",
    chatid: "558899999999@s.whatsapp.net",
    conversationId: "conv-1",
    channelId: "channel-1",
    messageId: "msg-1",
    providerMessageId: "provider-current",
    messageText: "tem diferenca de preco?",
    mediaUrl: null,
    mediaType: null,
    timestamp: 1780000000000,
    replyContext: {
      target_provider_message_id: "provider-target",
      target_message_id: "crm-target",
      target_text: "Tem cor de preferência? 😊",
      target_direction: "outbound",
      target_sender_type: "ai_inbound",
      target_created_at: "2026-06-06T12:39:00.000Z",
      preview_source: "db_lookup",
    },
  });

  assertEquals(payload.reply_context, {
    target_provider_message_id: "provider-target",
    target_message_id: "crm-target",
    target_text: "Tem cor de preferência? 😊",
    target_direction: "outbound",
    target_sender_type: "ai_inbound",
    target_created_at: "2026-06-06T12:39:00.000Z",
    preview_source: "db_lookup",
  });
  assertEquals(((payload.body as Record<string, any>).message).text, "tem diferenca de preco?");
});

Deno.test("buildCompactAiInboundPayload sanitizes preview-only reply_context", () => {
  const payload = buildCompactAiInboundPayload({
    instanceName: "crm",
    storeId: "store-1",
    leadId: "558899999999",
    leadSummaryShort: "",
    senderName: "Cliente",
    chatid: "558899999999@s.whatsapp.net",
    conversationId: "conv-1",
    channelId: "channel-1",
    messageId: "msg-1",
    providerMessageId: "provider-current",
    messageText: "queria ver o preco dos dois",
    mediaUrl: null,
    mediaType: null,
    timestamp: 1780000000000,
    replyContext: {
      target_provider_message_id: "provider-target",
      target_message_id: "",
      target_text: "  O 17 Pro tem 512GB e 1TB também.  ",
      target_direction: "",
      target_sender_type: "",
      target_created_at: "",
      preview_source: "reply_preview_text",
    },
  });

  assertEquals(payload.reply_context, {
    target_provider_message_id: "provider-target",
    target_message_id: null,
    target_text: "O 17 Pro tem 512GB e 1TB também.",
    target_direction: null,
    target_sender_type: null,
    target_created_at: null,
    preview_source: "reply_preview_text",
  });
});

Deno.test("buildCompactAiInboundPayload caps reply target_text at 300 characters", () => {
  const payload = buildCompactAiInboundPayload({
    instanceName: "crm",
    storeId: "store-1",
    leadId: "558899999999",
    leadSummaryShort: "",
    senderName: "Cliente",
    chatid: "558899999999@s.whatsapp.net",
    conversationId: "conv-1",
    channelId: "channel-1",
    messageId: "msg-1",
    providerMessageId: "provider-current",
    messageText: "sim",
    mediaUrl: null,
    mediaType: null,
    timestamp: 1780000000000,
    replyContext: {
      target_provider_message_id: "provider-target",
      target_message_id: null,
      target_text: "x".repeat(400),
      target_direction: null,
      target_sender_type: null,
      target_created_at: null,
      preview_source: "reply_preview_text",
    },
  });

  assertEquals((payload.reply_context as Record<string, string>).target_text.length, 300);
});

Deno.test("buildCompactAiInboundPayload omits reply_context when no target provider id exists", () => {
  const payload = buildCompactAiInboundPayload({
    instanceName: "crm",
    storeId: "store-1",
    leadId: "558899999999",
    leadSummaryShort: "",
    senderName: "Cliente",
    chatid: "558899999999@s.whatsapp.net",
    conversationId: "conv-1",
    channelId: "channel-1",
    messageId: "msg-1",
    providerMessageId: "provider-current",
    messageText: "sim",
    mediaUrl: null,
    mediaType: null,
    timestamp: 1780000000000,
    replyContext: null,
  }) as Record<string, unknown>;

  assertEquals("reply_context" in payload, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
deno test --allow-env --allow-net supabase/functions/_shared/crm_ai_payload.test.ts
```

Expected: FAIL with TypeScript errors that `replyContext` is not in the `buildCompactAiInboundPayload` argument type and/or `reply_context` is not on the return type.

- [ ] **Step 3: Add reply context types and sanitizer**

In `supabase/functions/_shared/crm_ai_payload.ts`, add these exports after `CrmAiMessageRow`:

```ts
export type CrmAiReplyContextPreviewSource = "db_lookup" | "reply_preview_text" | "missing";

export type CrmAiReplyContext = {
  target_provider_message_id: string;
  target_message_id: string | null;
  target_text: string | null;
  target_direction: string | null;
  target_sender_type: string | null;
  target_created_at: string | null;
  preview_source: CrmAiReplyContextPreviewSource;
};
```

Add this constant near the other payload limits:

```ts
const MAX_REPLY_TARGET_TEXT_CHARS = 300;
```

Add this function after `sanitizeShortMemory`:

```ts
export function sanitizeReplyContext(value: CrmAiReplyContext | null | undefined): CrmAiReplyContext | null {
  const targetProviderMessageId = clean(value?.target_provider_message_id);
  if (!targetProviderMessageId) return null;

  const source = value?.preview_source === "db_lookup" || value?.preview_source === "reply_preview_text"
    ? value.preview_source
    : "missing";

  return {
    target_provider_message_id: targetProviderMessageId,
    target_message_id: clean(value?.target_message_id) || null,
    target_text: clean(value?.target_text).slice(0, MAX_REPLY_TARGET_TEXT_CHARS).trim() || null,
    target_direction: clean(value?.target_direction) || null,
    target_sender_type: clean(value?.target_sender_type) || null,
    target_created_at: clean(value?.target_created_at) || null,
    preview_source: source,
  };
}
```

- [ ] **Step 4: Wire reply context into compact inbound payload**

In the `buildCompactAiInboundPayload` argument type in `supabase/functions/_shared/crm_ai_payload.ts`, add:

```ts
  replyContext?: CrmAiReplyContext | null;
```

Inside `buildCompactAiInboundPayload`, before `return {`, add:

```ts
  const replyContext = sanitizeReplyContext(args.replyContext);
```

Add `reply_context` to the returned object only when present. Replace the current object literal start with this shape:

```ts
  return {
    event: "inbound_message",
    instanceName: clean(args.instanceName) || "crm",
    type: hasMedia ? "media" : "text",
    lead_id: args.leadId,
    store_id: args.storeId,
    ...(replyContext ? { reply_context: replyContext } : {}),
    body: {
```

- [ ] **Step 5: Run payload tests to verify they pass**

Run:

```bash
deno test --allow-env --allow-net supabase/functions/_shared/crm_ai_payload.test.ts
```

Expected: PASS, including existing media/summary tests.

- [ ] **Step 6: Commit payload contract**

Run:

```bash
git add supabase/functions/_shared/crm_ai_payload.ts supabase/functions/_shared/crm_ai_payload.test.ts
git commit -m "feat: add compact ai reply context payload"
```

Expected: commit succeeds with only these two files.

---

### Task 2: Resolve Reply Targets During Continuous AI Dispatch

**Files:**
- Modify: `supabase/functions/_shared/crm_ai_inbound_dispatch.ts`
- Modify: `supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts`

- [ ] **Step 1: Write failing dispatch tests**

In `supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts`, update the import to include `resolveReplyContextForAi`:

```ts
import { __private__, dispatchAiInboundIfEligible, resolveReplyContextForAi } from "./crm_ai_inbound_dispatch.ts";
```

Append these tests:

```ts
Deno.test("resolveReplyContextForAi prefers channel provider lookup", async () => {
  const calls: Array<{ table: string; filters: Record<string, string> }> = [];
  const query = (table: string) => ({
    filters: {} as Record<string, string>,
    select() {
      return this;
    },
    eq(column: string, value: string) {
      this.filters[column] = value;
      return this;
    },
    limit() {
      return this;
    },
    maybeSingle() {
      calls.push({ table, filters: { ...this.filters } });
      return Promise.resolve({
        data: {
          id: "target-1",
          content: "Tem cor de preferência? 😊",
          direction: "outbound",
          sender_type: "ai_inbound",
          created_at: "2026-06-06T12:39:00.000Z",
        },
        error: null,
      });
    },
  });
  const supabase = { from: (table: string) => query(table) };

  const result = await resolveReplyContextForAi({
    supabase,
    channelId: "channel-1",
    conversationId: "conv-1",
    replyToProviderMessageId: "provider-target",
    replyPreviewText: "preview",
  });

  assertEquals(result, {
    target_provider_message_id: "provider-target",
    target_message_id: "target-1",
    target_text: "Tem cor de preferência? 😊",
    target_direction: "outbound",
    target_sender_type: "ai_inbound",
    target_created_at: "2026-06-06T12:39:00.000Z",
    preview_source: "db_lookup",
  });
  assertEquals(calls[0].filters, {
    channel_id: "channel-1",
    provider_message_id: "provider-target",
  });
});

Deno.test("resolveReplyContextForAi falls back to conversation provider lookup", async () => {
  let lookupCount = 0;
  const supabase = {
    from() {
      return {
        filters: {} as Record<string, string>,
        select() {
          return this;
        },
        eq(column: string, value: string) {
          this.filters[column] = value;
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle() {
          lookupCount += 1;
          if (lookupCount === 1) return Promise.resolve({ data: null, error: null });
          return Promise.resolve({
            data: {
              id: "target-2",
              content: "O 17 Pro tem 512GB e 1TB também.",
              direction: "outbound",
              sender_type: "ai_inbound",
              created_at: "2026-06-06T12:39:00.000Z",
            },
            error: null,
          });
        },
      };
    },
  };

  const result = await resolveReplyContextForAi({
    supabase,
    channelId: "channel-1",
    conversationId: "conv-1",
    replyToProviderMessageId: "provider-target",
    replyPreviewText: "preview",
  });

  assertEquals(result?.target_message_id, "target-2");
  assertEquals(result?.preview_source, "db_lookup");
});

Deno.test("resolveReplyContextForAi uses reply preview when target is missing", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };

  const result = await resolveReplyContextForAi({
    supabase,
    channelId: "channel-1",
    conversationId: "conv-1",
    replyToProviderMessageId: "provider-target",
    replyPreviewText: "  vcs pega o meu celular de entrada né?  ",
  });

  assertEquals(result, {
    target_provider_message_id: "provider-target",
    target_message_id: null,
    target_text: "vcs pega o meu celular de entrada né?",
    target_direction: null,
    target_sender_type: null,
    target_created_at: null,
    preview_source: "reply_preview_text",
  });
});

Deno.test("resolveReplyContextForAi returns missing context without blocking lookup errors", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle() {
          return Promise.reject(new Error("database unavailable"));
        },
      };
    },
  };

  const result = await resolveReplyContextForAi({
    supabase,
    channelId: "channel-1",
    conversationId: "conv-1",
    replyToProviderMessageId: "provider-target",
    replyPreviewText: "",
  });

  assertEquals(result, {
    target_provider_message_id: "provider-target",
    target_message_id: null,
    target_text: null,
    target_direction: null,
    target_sender_type: null,
    target_created_at: null,
    preview_source: "missing",
  });
});
```

- [ ] **Step 2: Run dispatch tests to verify they fail**

Run:

```bash
deno test --allow-env --allow-net supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts
```

Expected: FAIL because `resolveReplyContextForAi` does not exist.

- [ ] **Step 3: Add reply metadata to dispatch args**

In `supabase/functions/_shared/crm_ai_inbound_dispatch.ts`, update the import:

```ts
import { buildCompactAiInboundPayload, type CrmAiReplyContext } from "./crm_ai_payload.ts";
```

Add these optional fields to `AiInboundDispatchArgs`:

```ts
  replyToProviderMessageId?: string | null;
  replyPreviewText?: string | null;
```

- [ ] **Step 4: Add the resolver**

Add this exported function before `dispatchAiInboundIfEligible`:

```ts
const compactText = (value: unknown, max = 300): string | null => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max).trim() : null;
};

type ReplyLookupArgs = {
  supabase: any;
  channelId: string;
  conversationId: string;
  replyToProviderMessageId: string | null | undefined;
  replyPreviewText: string | null | undefined;
};

async function lookupReplyTarget(args: ReplyLookupArgs, scope: "channel" | "conversation") {
  const query = args.supabase
    .from("crm_messages")
    .select("id,content,direction,sender_type,created_at")
    .eq("provider_message_id", String(args.replyToProviderMessageId || "").trim())
    .limit(1);

  if (scope === "channel") {
    return await query.eq("channel_id", args.channelId).maybeSingle();
  }

  return await query.eq("conversation_id", args.conversationId).maybeSingle();
}

export async function resolveReplyContextForAi(args: ReplyLookupArgs): Promise<CrmAiReplyContext | null> {
  const targetProviderMessageId = compactText(args.replyToProviderMessageId);
  if (!targetProviderMessageId) return null;

  try {
    const channelResult = await lookupReplyTarget(args, "channel");
    const channelRow = asRecord(channelResult?.data);
    if (channelRow.id) {
      return {
        target_provider_message_id: targetProviderMessageId,
        target_message_id: compactText(channelRow.id),
        target_text: compactText(channelRow.content),
        target_direction: compactText(channelRow.direction),
        target_sender_type: compactText(channelRow.sender_type),
        target_created_at: compactText(channelRow.created_at),
        preview_source: "db_lookup",
      };
    }

    const conversationResult = await lookupReplyTarget(args, "conversation");
    const conversationRow = asRecord(conversationResult?.data);
    if (conversationRow.id) {
      return {
        target_provider_message_id: targetProviderMessageId,
        target_message_id: compactText(conversationRow.id),
        target_text: compactText(conversationRow.content),
        target_direction: compactText(conversationRow.direction),
        target_sender_type: compactText(conversationRow.sender_type),
        target_created_at: compactText(conversationRow.created_at),
        preview_source: "db_lookup",
      };
    }
  } catch (err) {
    console.warn("[crm_ai_inbound_dispatch] reply context lookup failed:", err);
  }

  const previewText = compactText(args.replyPreviewText);
  return {
    target_provider_message_id: targetProviderMessageId,
    target_message_id: null,
    target_text: previewText,
    target_direction: null,
    target_sender_type: null,
    target_created_at: null,
    preview_source: previewText ? "reply_preview_text" : "missing",
  };
}
```

- [ ] **Step 5: Pass reply context into the payload**

In `dispatchAiInboundIfEligible`, after `const messageTimestamp = Date.parse(args.messageAt) || Date.now();`, add:

```ts
  const replyContext = await resolveReplyContextForAi({
    supabase,
    channelId,
    conversationId,
    replyToProviderMessageId: args.replyToProviderMessageId,
    replyPreviewText: args.replyPreviewText,
  });
```

In the `buildCompactAiInboundPayload` call, add:

```ts
      replyContext,
```

In the `crm_ai_inbound_dispatched` event payload, add compact metadata:

```ts
      reply_context_source: replyContext?.preview_source ?? null,
      reply_target_provider_message_id: replyContext?.target_provider_message_id ?? null,
```

- [ ] **Step 6: Update UAZ receiver dispatch call**

In `supabase/functions/crm-uaz-webhook-receiver/index.ts`, find the `dispatchAiInboundIfEligible({ ... })` call after message insert. Add:

```ts
      replyToProviderMessageId: reply.targetMessageId,
      replyPreviewText: reply.previewText,
```

- [ ] **Step 7: Add integration assertion to existing dispatch success test**

In `supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts`, in the existing `AI dispatch continues an existing AI-handled conversation without entry settings` test:

1. In the fake `supabase.from(table)` implementation, add a `crm_messages` branch that returns a resolved target:

```ts
          if (table === "crm_messages") {
            return Promise.resolve({
              data: {
                id: "target-1",
                content: "Tem cor de preferência? 😊",
                direction: "outbound",
                sender_type: "ai_inbound",
                created_at: "2026-06-06T12:39:00.000Z",
              },
              error: null,
            });
          }
```

2. In the `dispatchAiInboundIfEligible` call for that test, add:

```ts
      replyToProviderMessageId: "provider-target",
      replyPreviewText: "Tem cor de preferência? 😊",
```

3. After `assertEquals(webhookBody?.event, "inbound_message");`, add:

```ts
  assertEquals(webhookBody?.reply_context, {
    target_provider_message_id: "provider-target",
    target_message_id: "target-1",
    target_text: "Tem cor de preferência? 😊",
    target_direction: "outbound",
    target_sender_type: "ai_inbound",
    target_created_at: "2026-06-06T12:39:00.000Z",
    preview_source: "db_lookup",
  });
  assertEquals((inserted.at(-1)?.payload as Record<string, unknown>).reply_context_source, "db_lookup");
```

- [ ] **Step 8: Run dispatch tests**

Run:

```bash
deno test --allow-env --allow-net supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run UAZ adapter tests**

Run:

```bash
npm run test:run -- tests/uazapiAdapter.test.ts
```

Expected: PASS, confirming existing reply extraction behavior still works.

- [ ] **Step 10: Commit dispatch resolver**

Run:

```bash
git add supabase/functions/_shared/crm_ai_inbound_dispatch.ts supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts supabase/functions/crm-uaz-webhook-receiver/index.ts
git commit -m "feat: resolve ai inbound whatsapp reply context"
```

Expected: commit succeeds with the three dispatch-related files.

---

### Task 3: Add n8n Reply Context Formatter and Fixtures

**Files:**
- Create: `scripts/n8n/repasse-reply-context.mjs`
- Create: `scripts/n8n/test-repasse-reply-context.mjs`

- [ ] **Step 1: Create failing fixture test**

Create `scripts/n8n/test-repasse-reply-context.mjs` with:

```js
import assert from "node:assert/strict";
import {
  normalizeBufferedReplyContext,
  renderBufferedMessagesForAgents,
  renderReplyHint,
} from "./repasse-reply-context.mjs";

const normalized = normalizeBufferedReplyContext({
  target_provider_message_id: "provider-target",
  target_message_id: "target-1",
  target_text: "  Tem cor de preferência? 😊  ",
  target_direction: "outbound",
  target_sender_type: "ai_inbound",
  target_created_at: "2026-06-06T12:39:00.000Z",
  preview_source: "db_lookup",
});

assert.deepEqual(normalized, {
  target_provider_message_id: "provider-target",
  target_message_id: "target-1",
  target_text: "Tem cor de preferência? 😊",
  target_direction: "outbound",
  target_sender_type: "ai_inbound",
  target_created_at: "2026-06-06T12:39:00.000Z",
  preview_source: "db_lookup",
});

assert.equal(
  renderReplyHint(normalized),
  '[Reply: cliente respondeu a mensagem da IA "Tem cor de preferência? 😊"]',
);

const rendered = renderBufferedMessagesForAgents([
  {
    event_id: "m1",
    text: "tem diferença de preço?",
    created_at: "2026-06-06T12:40:00.000Z",
    type: "text",
    sender_name: "Thay",
    reply_context: normalized,
  },
]);

assert.equal(
  rendered,
  '[Reply: cliente respondeu a mensagem da IA "Tem cor de preferência? 😊"]\ntem diferença de preço?',
);

assert.equal(
  renderBufferedMessagesForAgents([
    {
      event_id: "m2",
      text: "Oi",
      created_at: "2026-06-06T12:40:00.000Z",
      type: "text",
      sender_name: "Thay",
    },
  ]),
  "Oi",
);

assert.equal(
  renderBufferedMessagesForAgents([
    {
      event_id: "m3",
      text: "Sim",
      created_at: "2026-06-06T12:40:00.000Z",
      type: "text",
      sender_name: "Thay",
      reply_context: {
        target_provider_message_id: "provider-target",
        target_text: "vcs pega o meu celular de entrada né?",
        target_sender_type: "human",
        preview_source: "reply_preview_text",
      },
    },
  ]),
  '[Reply: cliente respondeu a mensagem do atendente "vcs pega o meu celular de entrada né?"]\nSim',
);

assert.equal(
  renderBufferedMessagesForAgents([
    {
      event_id: "m4",
      text: "queria ver o preço dos dois",
      created_at: "2026-06-06T12:40:00.000Z",
      type: "text",
      sender_name: "Thay",
      reply_context: {
        target_provider_message_id: "provider-target",
        target_text: "O 17 Pro tem 512GB e 1TB também.",
        target_sender_type: "ai_inbound",
        preview_source: "db_lookup",
      },
    },
  ]),
  '[Reply: cliente respondeu a mensagem da IA "O 17 Pro tem 512GB e 1TB também."]\nqueria ver o preço dos dois',
);

assert.equal(
  renderBufferedMessagesForAgents([
    {
      event_id: "m5",
      text: "sim",
      created_at: "2026-06-06T12:40:00.000Z",
      type: "text",
      sender_name: "Thay",
      reply_context: {
        target_provider_message_id: "provider-target",
        target_text: null,
        target_sender_type: null,
        preview_source: "missing",
      },
    },
  ]),
  "[Reply: cliente respondeu a uma mensagem anterior]\nsim",
);

console.log("repasse-reply-context: fixtures passed");
```

- [ ] **Step 2: Run fixture test to verify it fails**

Run:

```bash
node scripts/n8n/test-repasse-reply-context.mjs
```

Expected: FAIL with module not found for `scripts/n8n/repasse-reply-context.mjs`.

- [ ] **Step 3: Add pure formatter module**

Create `scripts/n8n/repasse-reply-context.mjs` with:

```js
export const REPLY_CONTEXT_MARKER_START = "// === REPASSE REPLY CONTEXT START ===";
export const REPLY_CONTEXT_MARKER_END = "// === REPASSE REPLY CONTEXT END ===";

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function nullableText(value, max = 300) {
  const text = clean(value);
  return text ? text.slice(0, max).trim() : null;
}

export function normalizeBufferedReplyContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const targetProviderMessageId = nullableText(value.target_provider_message_id);
  if (!targetProviderMessageId) return null;
  const previewSource = ["db_lookup", "reply_preview_text", "missing"].includes(clean(value.preview_source))
    ? clean(value.preview_source)
    : "missing";

  return {
    target_provider_message_id: targetProviderMessageId,
    target_message_id: nullableText(value.target_message_id),
    target_text: nullableText(value.target_text),
    target_direction: nullableText(value.target_direction),
    target_sender_type: nullableText(value.target_sender_type),
    target_created_at: nullableText(value.target_created_at),
    preview_source: previewSource,
  };
}

function senderLabel(senderType) {
  const normalized = clean(senderType);
  if (normalized === "ai_inbound") return "mensagem da IA";
  if (normalized === "human") return "mensagem do atendente";
  if (normalized === "customer") return "mensagem anterior do cliente";
  return "mensagem anterior";
}

export function renderReplyHint(replyContext) {
  const ctx = normalizeBufferedReplyContext(replyContext);
  if (!ctx) return "";
  if (!ctx.target_text) return "[Reply: cliente respondeu a uma mensagem anterior]";
  const quoted = ctx.target_text.replace(/"/g, "'");
  return `[Reply: cliente respondeu a ${senderLabel(ctx.target_sender_type)} "${quoted}"]`.slice(0, 360);
}

export function renderBufferedMessagesForAgents(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => {
      const text = clean(message?.text);
      const hint = renderReplyHint(message?.reply_context);
      return [hint, text].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export const N8N_REPLY_CONTEXT_BLOCK = `${REPLY_CONTEXT_MARKER_START}
function repasseClean(value) {
  return String(value ?? "").replace(/\\s+/g, " ").trim();
}

function repasseNullableText(value, max = 300) {
  const text = repasseClean(value);
  return text ? text.slice(0, max).trim() : null;
}

function repasseNormalizeReplyContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const targetProviderMessageId = repasseNullableText(value.target_provider_message_id);
  if (!targetProviderMessageId) return null;
  const rawSource = repasseClean(value.preview_source);
  const previewSource = ["db_lookup", "reply_preview_text", "missing"].includes(rawSource) ? rawSource : "missing";
  return {
    target_provider_message_id: targetProviderMessageId,
    target_message_id: repasseNullableText(value.target_message_id),
    target_text: repasseNullableText(value.target_text),
    target_direction: repasseNullableText(value.target_direction),
    target_sender_type: repasseNullableText(value.target_sender_type),
    target_created_at: repasseNullableText(value.target_created_at),
    preview_source: previewSource,
  };
}

function repasseReplySenderLabel(senderType) {
  const normalized = repasseClean(senderType);
  if (normalized === "ai_inbound") return "mensagem da IA";
  if (normalized === "human") return "mensagem do atendente";
  if (normalized === "customer") return "mensagem anterior do cliente";
  return "mensagem anterior";
}

function repasseRenderReplyHint(replyContext) {
  const ctx = repasseNormalizeReplyContext(replyContext);
  if (!ctx) return "";
  if (!ctx.target_text) return "[Reply: cliente respondeu a uma mensagem anterior]";
  const quoted = ctx.target_text.replace(/"/g, "'");
  return ("[Reply: cliente respondeu a " + repasseReplySenderLabel(ctx.target_sender_type) + " \\"" + quoted + "\\"]").slice(0, 360);
}

function repasseRenderMessageForAgents(message) {
  const text = repasseClean(message?.text);
  const hint = repasseRenderReplyHint(message?.reply_context);
  return [hint, text].filter(Boolean).join("\\n");
}
${REPLY_CONTEXT_MARKER_END}`;
```

- [ ] **Step 4: Run fixture test**

Run:

```bash
node scripts/n8n/test-repasse-reply-context.mjs
```

Expected: PASS with `repasse-reply-context: fixtures passed`.

- [ ] **Step 5: Commit formatter fixtures**

Run:

```bash
git add scripts/n8n/repasse-reply-context.mjs scripts/n8n/test-repasse-reply-context.mjs
git commit -m "test: cover n8n whatsapp reply context formatting"
```

Expected: commit succeeds with the two n8n fixture files.

---

### Task 4: Patch n8n Workflow Buffer and Renderer Reproducibly

**Files:**
- Modify: `scripts/n8n/apply-repasse-memory-guardrails.mjs`

- [ ] **Step 1: Add imports and marked-block helper support**

In `scripts/n8n/apply-repasse-memory-guardrails.mjs`, extend the imports:

```js
import {
  N8N_REPLY_CONTEXT_BLOCK,
  REPLY_CONTEXT_MARKER_END,
  REPLY_CONTEXT_MARKER_START,
} from "./repasse-reply-context.mjs";
```

Add this helper after `replaceMarkedBlock`:

```js
function replaceOrInsertBlock(source, markerStart, markerEnd, insertionNeedle, block, nodeName) {
  const start = source.indexOf(markerStart);
  const end = source.indexOf(markerEnd);
  if (start !== -1 && end !== -1 && end > start) {
    return source.slice(0, start).trimEnd() + "\n\n" + block + "\n\n" + source.slice(end + markerEnd.length).trimStart();
  }

  const insertionPoint = source.indexOf(insertionNeedle);
  if (insertionPoint === -1) {
    throw new Error(`Could not find ${nodeName} insertion point: ${insertionNeedle}`);
  }
  return source.slice(0, insertionPoint).trimEnd() + "\n\n" + block + "\n\n" + source.slice(insertionPoint);
}
```

- [ ] **Step 2: Patch `Atualizar Estado Buffer` normalize function**

Add this function to the patcher:

```js
function patchAtualizarEstadoBuffer(source) {
  let patched = replaceOrInsertBlock(
    source,
    REPLY_CONTEXT_MARKER_START,
    REPLY_CONTEXT_MARKER_END,
    "function normalizeMessage(msg) {",
    N8N_REPLY_CONTEXT_BLOCK,
    "Atualizar Estado Buffer",
  );

  patched = patched.replace(
    /sender_name:\s*String\(msg\?\.sender_name \?\? ''\),\n\s*};/,
    "sender_name: String(msg?.sender_name ?? ''),\n    reply_context: repasseNormalizeReplyContext(msg?.reply_context),\n  };",
  );

  return patched;
}
```

After patching `Bia 1`, add:

```js
const atualizarEstadoBuffer = workflow.nodes.find(node => node.name === "Atualizar Estado Buffer");
if (!atualizarEstadoBuffer) throw new Error("Atualizar Estado Buffer node not found");
atualizarEstadoBuffer.parameters.jsCode = patchAtualizarEstadoBuffer(atualizarEstadoBuffer.parameters.jsCode);
```

- [ ] **Step 3: Patch final buffer renderer**

Add this function to the patcher:

```js
function patchCodeConsolidadorPayloadFinal(source) {
  let patched = replaceOrInsertBlock(
    source,
    REPLY_CONTEXT_MARKER_START,
    REPLY_CONTEXT_MARKER_END,
    "const messageBuffered",
    N8N_REPLY_CONTEXT_BLOCK,
    "Code Consolidador Payload Final",
  );

  patched = patched.replace(
    /\/\/ Consolida a mensagem buffered: todas as mensagens concatenadas em ordem[\s\S]*?var messageBuffered = messageTexts\.join\("\\n"\);/,
    "// Consolida a mensagem buffered: todas as mensagens concatenadas em ordem, preservando contexto de reply\nvar messageTexts = [];\nfor (var j = 0; j < messages.length; j++) {\n  var rendered = repasseRenderMessageForAgents(messages[j]);\n  if (!isEmpty(rendered)) {\n    messageTexts.push(String(rendered).trim());\n  }\n}\nvar messageBuffered = messageTexts.join(\"\\n\");",
  );

  return patched;
}
```

After patching `Atualizar Estado Buffer`, add:

```js
const consolidador = workflow.nodes.find(node => node.name === "Code Consolidador Payload Final");
if (!consolidador) throw new Error("Code Consolidador Payload Final node not found");
consolidador.parameters.jsCode = patchCodeConsolidadorPayloadFinal(consolidador.parameters.jsCode);
```

- [ ] **Step 4: Patch early payload normalization**

Add this helper to `scripts/n8n/apply-repasse-memory-guardrails.mjs`:

```js
function ensureSetAssignment(node, assignment) {
  const assignments = node.parameters?.assignments?.assignments;
  if (!Array.isArray(assignments)) {
    throw new Error(`${node.name} assignments not found`);
  }

  const existing = assignments.find(item => item.name === assignment.name);
  if (existing) {
    existing.value = assignment.value;
    existing.type = assignment.type;
    return;
  }

  assignments.push(assignment);
}

function patchFormatarPayloadCrm2(node) {
  ensureSetAssignment(node, {
    id: "repasse-reply-context",
    name: "reply_context",
    value: "={{ $('Webhook').item.json.body.reply_context ?? null }}",
    type: "object",
  });
}

function patchBufferDataLead(node) {
  const assignments = node.parameters?.assignments?.assignments;
  if (!Array.isArray(assignments)) {
    throw new Error("Buffer + Data Lead assignments not found");
  }

  const bufferAssignment = assignments.find(item => item.name === "buffer");
  if (!bufferAssignment || typeof bufferAssignment.value !== "string") {
    throw new Error("Buffer + Data Lead buffer assignment not found");
  }

  const replyLine = '\n      "reply_context": $("Formatar Payload CRM2").item.json.reply_context';
  if (bufferAssignment.value.includes('"reply_context"')) return;

  bufferAssignment.value = bufferAssignment.value.replace(
    '"type": $("Formatar Payload CRM2").item.json.type',
    '"type": $("Formatar Payload CRM2").item.json.type,' + replyLine,
  );
}
```

After the `consolidador` patch, add:

```js
const formatarPayloadCrm2 = workflow.nodes.find(node => node.name === "Formatar Payload CRM2");
if (!formatarPayloadCrm2) throw new Error("Formatar Payload CRM2 node not found");
patchFormatarPayloadCrm2(formatarPayloadCrm2);

const bufferDataLead = workflow.nodes.find(node => node.name === "Buffer + Data Lead");
if (!bufferDataLead) throw new Error("Buffer + Data Lead node not found");
patchBufferDataLead(bufferDataLead);
```

The resulting buffered message object must contain `event_id`, `text`, `created_at`, `type`, and `reply_context`.

- [ ] **Step 5: Update patcher output assertions**

In the final `console.log(JSON.stringify({ ... }))` payload, add:

```js
  atualizarEstadoBufferReplyPatched: updated.nodes.some(node => node.name === "Atualizar Estado Buffer" && node.parameters.jsCode.includes(REPLY_CONTEXT_MARKER_START)),
  consolidadorReplyPatched: updated.nodes.some(node => node.name === "Code Consolidador Payload Final" && node.parameters.jsCode.includes(REPLY_CONTEXT_MARKER_START)),
```

- [ ] **Step 6: Run local n8n fixture tests**

Run:

```bash
node scripts/n8n/test-repasse-reply-context.mjs
node scripts/n8n/test-repasse-memory-guardrails.mjs
```

Expected: both scripts pass.

- [ ] **Step 7: Apply remote n8n patch**

Run:

```bash
node scripts/n8n/apply-repasse-memory-guardrails.mjs
```

Expected output includes:

```json
{
  "parseMemoryPatched": true,
  "bia1Patched": true,
  "atualizarEstadoBufferReplyPatched": true,
  "consolidadorReplyPatched": true
}
```

Save the printed `backupPath` in the implementation notes.

- [ ] **Step 8: Commit n8n patcher changes**

Run:

```bash
git add scripts/n8n/apply-repasse-memory-guardrails.mjs
git commit -m "chore: patch n8n reply context handling"
```

Expected: commit succeeds with the patcher update.

---

### Task 5: Final Verification and Regression Sweep

**Files:**
- No new files required.
- Verify changed files from Tasks 1-4.

- [ ] **Step 1: Run focused Supabase tests**

Run:

```bash
deno test --allow-env --allow-net supabase/functions/_shared/crm_ai_payload.test.ts supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run UAZ reply extraction regression**

Run:

```bash
npm run test:run -- tests/uazapiAdapter.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run n8n fixture regressions**

Run:

```bash
node scripts/n8n/test-repasse-reply-context.mjs
node scripts/n8n/test-repasse-memory-guardrails.mjs
```

Expected: both scripts pass.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS. If unrelated pre-existing type errors appear, capture the exact errors and do not mix unrelated fixes into this branch.

- [ ] **Step 5: Inspect final git state**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: working tree is clean except any intentional uncommitted implementation notes. Recent commits include:

```text
feat: add compact ai reply context payload
feat: resolve ai inbound whatsapp reply context
test: cover n8n whatsapp reply context formatting
chore: patch n8n reply context handling
```

- [ ] **Step 6: Record rollout notes**

Add a short final implementation note in the handoff response with:

```text
Supabase changed: compact AI payload now emits reply_context when reply metadata exists.
n8n changed: ia repasse-pro preserves reply_context through Redis and renders reply hints in message_buffered.
n8n backup: /tmp/repasse-workflow-oWNdWPUq6kEFitsnl8OpH-<timestamp>.json
Verified: deno payload/dispatch tests, uazapiAdapter, n8n fixture scripts, typecheck.
```

Do not create a separate docs file unless the user asks for one.

---

## Self-Review

- Spec coverage: payload contract, any reply target type, n8n buffer preservation, deterministic rendering, lookup fallback, data limits, and regression tests are covered by Tasks 1-5.
- Placeholder scan: this plan contains no `TBD`, `TODO`, or open-ended "handle later" steps.
- Type consistency: the plan uses `replyContext` inside TypeScript helpers and `reply_context` in JSON payloads, matching the approved spec.
