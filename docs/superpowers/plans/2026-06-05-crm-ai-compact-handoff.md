# CRM AI Compact Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CRM AI handoff/continuation payloads with compact payloads that use `crm_leads.summary_short` as short memory and enrich the manual handoff context with audio/image processing when possible.

**Architecture:** Add `supabase/functions/_shared/crm_ai_payload.ts` as the shared payload/context/media helper. Refactor `crm-conversation-handoff` to generate and persist `summary_short` before dispatching a compact manual payload, and refactor `crm_ai_inbound_dispatch` to use the same compact payload shape for future AI-owned inbound messages.

**Tech Stack:** Supabase Edge Functions on Deno, Deno tests, existing Supabase client mocks, Groq audio transcription API, OpenRouter chat completions API.

---

## File Structure

- Create `supabase/functions/_shared/crm_ai_payload.ts`: compact payload builders, transcript helpers, media detection, OpenRouter/Groq API wrappers, fallback summary logic.
- Create `supabase/functions/_shared/crm_ai_payload.test.ts`: unit tests for helper behavior without network calls unless `fetch` is mocked.
- Modify `supabase/functions/crm-conversation-handoff/index.ts`: fetch conversation `created_at`, fetch 500 messages from context window, call helper, update `summary_short`, send compact payload, log compact diagnostics.
- Modify `supabase/functions/_shared/crm_ai_inbound_dispatch.ts`: call compact inbound payload builder and include `summary_short`.
- Modify `supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts`: assert sent webhook body includes compact `lead.summary_short`.
- Modify `supabase/functions/crm-send-message/index.contract.test.ts`: replace old assertions for `conversation_context`/placeholder strings with compact handoff expectations.

## Task 1: Shared Payload Helper Contract

**Files:**
- Create: `supabase/functions/_shared/crm_ai_payload.ts`
- Create: `supabase/functions/_shared/crm_ai_payload.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `supabase/functions/_shared/crm_ai_payload.test.ts`:

```ts
import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildCompactAiInboundPayload,
  buildCompactManualHandoffPayload,
  buildTranscript,
  sanitizeShortMemory,
  selectLatestCustomerMessage,
} from "./crm_ai_payload.ts";

Deno.test("buildTranscript keeps customer and human messages compact", () => {
  const transcript = buildTranscript([
    { direction: "inbound", sender_type: "customer", content: "Quero vender um iPhone 13", created_at: "2026-06-05T10:00:00Z" },
    { direction: "outbound", sender_type: "human", content: "Pode enviar fotos?", created_at: "2026-06-05T10:01:00Z" },
    { direction: "outbound", sender_type: "ai_inbound", content: "Ignore", created_at: "2026-06-05T10:02:00Z" },
  ]);

  assertEquals(transcript, "CLIENTE: Quero vender um iPhone 13\nATENDENTE: Pode enviar fotos?");
});

Deno.test("selectLatestCustomerMessage chooses newest inbound customer message", () => {
  const latest = selectLatestCustomerMessage([
    { id: "old", direction: "inbound", sender_type: "customer", content: "Antiga", created_at: "2026-06-05T10:00:00Z" },
    { id: "human", direction: "outbound", sender_type: "human", content: "Resposta", created_at: "2026-06-05T10:02:00Z" },
    { id: "new", direction: "inbound", sender_type: "customer", content: "Nova", created_at: "2026-06-05T10:03:00Z" },
  ]);

  assertEquals(latest?.id, "new");
});

Deno.test("sanitizeShortMemory normalizes whitespace and limits length", () => {
  const raw = " Cliente  enviou   fotos e pediu avaliação. ".repeat(20);
  const result = sanitizeShortMemory(raw);

  assert(result.length <= 280);
  assertEquals(result.includes("  "), false);
});

Deno.test("buildCompactManualHandoffPayload sends summary_short and no conversation_context", () => {
  const payload = buildCompactManualHandoffPayload({
    event: "manual_handoff_to_ai",
    instanceName: "Canal Principal",
    storeId: "store-1",
    leadId: "lead-1",
    leadPhone: "+55 88 99999-9999",
    chatid: "558899999999@s.whatsapp.net",
    senderName: "Maria",
    conversationId: "conv-1",
    channelId: "channel-1",
    reason: "manual_handoff_to_ai",
    messageText: "Cliente enviou foto do aparelho.",
    summaryShort: "Cliente quer vender iPhone e enviou foto para avaliação.",
    timestamp: 1780000000000,
  }) as Record<string, unknown>;

  assertEquals(payload.event, "manual_handoff_to_ai");
  assertEquals((payload.lead as Record<string, unknown>).summary_short, "Cliente quer vender iPhone e enviou foto para avaliação.");
  assertEquals("conversation_context" in payload, false);
  assertEquals(((payload.body as Record<string, any>).message).content, "Cliente enviou foto do aparelho.");
});

Deno.test("buildCompactAiInboundPayload carries existing summary_short", () => {
  const payload = buildCompactAiInboundPayload({
    instanceName: "crm",
    storeId: "store-1",
    leadId: "558899999999",
    leadSummaryShort: "Cliente está negociando iPhone 13.",
    senderName: "Cliente",
    chatid: "558899999999@s.whatsapp.net",
    conversationId: "conv-1",
    channelId: "channel-1",
    messageId: "msg-1",
    providerMessageId: "provider-1",
    messageText: "Qual o próximo passo?",
    mediaUrl: null,
    mediaType: null,
    timestamp: 1780000000000,
  });

  assertEquals(payload.event, "inbound_message");
  assertEquals(payload.type, "text");
  assertEquals(payload.lead.summary_short, "Cliente está negociando iPhone 13.");
});
```

- [ ] **Step 2: Run helper test to verify it fails**

Run:

```bash
deno test --allow-env --allow-net=deno.land supabase/functions/_shared/crm_ai_payload.test.ts
```

Expected: fail with module not found or missing exported functions from `crm_ai_payload.ts`.

- [ ] **Step 3: Implement minimal helper**

Create `supabase/functions/_shared/crm_ai_payload.ts` with exports used by the test:

```ts
export type CrmAiMessageRow = {
  id?: string;
  direction?: string | null;
  sender_type?: string | null;
  content?: string | null;
  created_at?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  webhook_payload?: unknown;
  provider_message_id?: string | null;
  event_origin?: string | null;
};

const clean = (value: unknown): string => String(value ?? "").replace(/\s+/g, " ").trim();
const digits = (value: unknown): string => String(value ?? "").replace(/\D/g, "");

export function sanitizeShortMemory(value: unknown): string {
  return clean(value).slice(0, 280).trim();
}

export function isCustomerMessage(message: CrmAiMessageRow): boolean {
  return message.direction === "inbound" && message.sender_type === "customer";
}

export function isHumanMessage(message: CrmAiMessageRow): boolean {
  return message.direction === "outbound" && message.sender_type === "human";
}

export function messageTextForAi(message: CrmAiMessageRow): string {
  const content = clean(message.content);
  if (content) return content;
  const mediaType = clean(message.media_type).toLowerCase();
  if (mediaType.includes("audio")) return "Cliente enviou áudio e aguarda continuidade do atendimento.";
  if (mediaType.includes("image") || mediaType.includes("imagem")) return "Cliente enviou imagem e aguarda continuidade do atendimento.";
  if (clean(message.media_url)) return "Cliente enviou mídia e aguarda continuidade do atendimento.";
  return "";
}

export function buildTranscript(messages: CrmAiMessageRow[], maxChars = 12_000): string {
  return messages
    .filter((message) => isCustomerMessage(message) || isHumanMessage(message))
    .map((message) => {
      const text = messageTextForAi(message);
      if (!text) return "";
      return `${isCustomerMessage(message) ? "CLIENTE" : "ATENDENTE"}: ${text}`;
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, maxChars);
}

export function selectLatestCustomerMessage(messages: CrmAiMessageRow[]): CrmAiMessageRow | null {
  return [...messages]
    .filter(isCustomerMessage)
    .sort((a, b) => Date.parse(clean(b.created_at)) - Date.parse(clean(a.created_at)))
    [0] ?? null;
}

export function normalizeAiLeadId(leadPhone: unknown, fallbackLeadId: unknown): string {
  return digits(leadPhone) || clean(fallbackLeadId);
}

export function buildCompactManualHandoffPayload(args: {
  event: "manual_handoff_to_ai";
  instanceName: string;
  storeId: string;
  leadId: string;
  leadPhone: string;
  chatid: string;
  senderName: string;
  conversationId: string;
  channelId: string;
  reason: string;
  messageText: string;
  summaryShort: string;
  timestamp: number;
  instagramUserId?: string | null;
  instagramUsername?: string | null;
}) {
  const messageText = clean(args.messageText) || "Cliente aguarda continuidade do atendimento.";
  const chatid = clean(args.chatid) || clean(args.leadPhone);
  return {
    event: args.event,
    instanceName: clean(args.instanceName) || "crm",
    type: "text",
    lead_id: normalizeAiLeadId(args.leadPhone, args.leadId),
    store_id: args.storeId,
    body: {
      sender: chatid,
      message: {
        messageTimestamp: args.timestamp,
        text: messageText,
        senderName: clean(args.senderName) || "Cliente",
        messageid: `manual-ai-${args.conversationId}-${args.timestamp}`,
        fromMe: false,
        edited: "",
        owner: "",
        chatid,
        content: messageText,
      },
      BaseUrl: "https://crm.internal/manual-handoff",
      EventType: "messages",
      chatid,
      mediaType: "",
    },
    lead: {
      summary_short: sanitizeShortMemory(args.summaryShort),
      instagram_user_id: args.instagramUserId ?? null,
      instagram_username: args.instagramUsername ?? null,
    },
    media: { URL: null, mimetype: null, mediaKey: null },
    meta: {
      source: "crm_manual_handoff",
      conversation_id: args.conversationId,
      channel_id: args.channelId,
      reason: args.reason,
      instagram_user_id: args.instagramUserId ?? null,
      instagram_username: args.instagramUsername ?? null,
    },
  };
}

export function buildCompactAiInboundPayload(args: {
  instanceName: string;
  storeId: string;
  leadId: string;
  leadSummaryShort: string;
  senderName: string;
  chatid: string;
  conversationId: string;
  channelId: string;
  messageId: string;
  providerMessageId: string | null;
  messageText: string;
  mediaUrl: string | null;
  mediaType: string | null;
  timestamp: number;
  instagramUserId?: string | null;
  instagramUsername?: string | null;
}) {
  const hasMedia = Boolean(args.mediaUrl || clean(args.mediaType));
  const text = clean(args.messageText);
  return {
    event: "inbound_message",
    instanceName: clean(args.instanceName) || "crm",
    type: hasMedia ? "media" : "text",
    lead_id: args.leadId,
    store_id: args.storeId,
    body: {
      sender: args.chatid,
      message: {
        messageTimestamp: args.timestamp,
        text,
        senderName: clean(args.senderName) || "Cliente",
        messageid: args.providerMessageId || args.messageId,
        fromMe: false,
        edited: "",
        owner: "",
        chatid: args.chatid,
        content: text,
      },
      BaseUrl: "https://crm.internal/inbound-dispatch",
      EventType: "messages",
      chatid: args.chatid,
      mediaType: args.mediaType || "",
    },
    lead: {
      summary_short: sanitizeShortMemory(args.leadSummaryShort),
      instagram_user_id: args.instagramUserId ?? null,
      instagram_username: args.instagramUsername ?? null,
    },
    media: { URL: args.mediaUrl ?? null, mimetype: null, mediaKey: null },
    meta: {
      source: "crm_inbound_message",
      conversation_id: args.conversationId,
      channel_id: args.channelId,
      message_id: args.messageId,
      instagram_user_id: args.instagramUserId ?? null,
      instagram_username: args.instagramUsername ?? null,
    },
  };
}
```

- [ ] **Step 4: Run helper test to verify it passes**

Run:

```bash
deno test --allow-env --allow-net=deno.land supabase/functions/_shared/crm_ai_payload.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/crm_ai_payload.ts supabase/functions/_shared/crm_ai_payload.test.ts
git commit -m "feat: add compact CRM AI payload helper"
```

## Task 2: Media and Summary Generation Helpers

**Files:**
- Modify: `supabase/functions/_shared/crm_ai_payload.ts`
- Modify: `supabase/functions/_shared/crm_ai_payload.test.ts`

- [ ] **Step 1: Write failing tests for fallbacks and mocked LLM calls**

Append to `crm_ai_payload.test.ts`:

```ts
import {
  describeImageForAi,
  generateSummaryShort,
  resolveLatestCustomerMessageForAi,
  transcribeAudioForAi,
} from "./crm_ai_payload.ts";

Deno.test("generateSummaryShort falls back when OPEN_ROUTER_API_KEY is missing", async () => {
  const result = await generateSummaryShort({
    transcript: "CLIENTE: Quero vender meu iPhone 13.",
    latestCustomerText: "Quero vender meu iPhone 13.",
    env: { OPEN_ROUTER_API_KEY: "" },
    fetchImpl: (() => Promise.reject(new Error("should not call"))) as typeof fetch,
  });

  assertEquals(result.summaryShort, "Quero vender meu iPhone 13.");
  assertEquals(result.usedFallback, true);
});

Deno.test("resolveLatestCustomerMessageForAi returns image fallback when description cannot run", async () => {
  const result = await resolveLatestCustomerMessageForAi({
    message: { id: "img", direction: "inbound", sender_type: "customer", content: "", media_url: "https://cdn.test/foto.jpg", media_type: "image/jpeg" },
    env: { OPEN_ROUTER_API_KEY: "" },
    fetchImpl: (() => Promise.reject(new Error("no network"))) as typeof fetch,
  });

  assertEquals(result.text, "Cliente enviou imagem e aguarda continuidade do atendimento.");
  assertEquals(result.mediaKind, "image");
  assertEquals(result.usedFallback, true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
deno test --allow-env --allow-net=deno.land supabase/functions/_shared/crm_ai_payload.test.ts
```

Expected: fail because the new functions are not exported.

- [ ] **Step 3: Implement minimal media/summary helper behavior**

Add to `crm_ai_payload.ts`:

```ts
export type RuntimeEnv = Record<string, string | undefined>;

export const readEnv = (): RuntimeEnv => ({
  OPEN_ROUTER_API_KEY: Deno.env.get("OPEN_ROUTER_API_KEY"),
  OPEN_ROUTER_IMAGE_DESCRIPTION_MODEL: Deno.env.get("OPEN_ROUTER_IMAGE_DESCRIPTION_MODEL"),
  OPEN_ROUTER_SUMMARY_MODEL: Deno.env.get("OPEN_ROUTER_SUMMARY_MODEL"),
  GROQ_API_KEY: Deno.env.get("GROQ_API_KEY"),
});

export function inferMediaKind(message: CrmAiMessageRow): "audio" | "image" | "media" | null {
  const type = clean(message.media_type).toLowerCase();
  const url = clean(message.media_url).split("?")[0].toLowerCase();
  if (type.includes("audio") || /\.(mp3|m4a|ogg|opus|wav|webm)$/.test(url)) return "audio";
  if (type.includes("image") || /\.(jpg|jpeg|png|webp|gif)$/.test(url)) return "image";
  if (clean(message.media_url) || type) return "media";
  return null;
}

function fallbackForKind(kind: "audio" | "image" | "media" | null): string {
  if (kind === "audio") return "Cliente enviou áudio e aguarda continuidade do atendimento.";
  if (kind === "image") return "Cliente enviou imagem e aguarda continuidade do atendimento.";
  return "Cliente aguarda continuidade do atendimento.";
}

export async function transcribeAudioForAi(_: {
  mediaUrl: string;
  mediaType?: string | null;
  env?: RuntimeEnv;
  fetchImpl?: typeof fetch;
}): Promise<{ text: string; error: string | null }> {
  return { text: "", error: "audio_transcription_not_available" };
}

export async function describeImageForAi(_: {
  mediaUrl: string;
  mediaType?: string | null;
  env?: RuntimeEnv;
  fetchImpl?: typeof fetch;
}): Promise<{ text: string; error: string | null }> {
  return { text: "", error: "image_description_not_available" };
}

export async function resolveLatestCustomerMessageForAi(args: {
  message: CrmAiMessageRow | null;
  env?: RuntimeEnv;
  fetchImpl?: typeof fetch;
}): Promise<{ text: string; mediaKind: "audio" | "image" | "media" | null; usedFallback: boolean; error: string | null }> {
  if (!args.message) {
    return { text: fallbackForKind(null), mediaKind: null, usedFallback: true, error: "missing_latest_customer_message" };
  }
  const directText = clean(args.message.content);
  if (directText) return { text: directText, mediaKind: inferMediaKind(args.message), usedFallback: false, error: null };
  const mediaKind = inferMediaKind(args.message);
  return { text: fallbackForKind(mediaKind), mediaKind, usedFallback: true, error: `${mediaKind || "message"}_fallback` };
}

export async function generateSummaryShort(args: {
  transcript: string;
  latestCustomerText: string;
  env?: RuntimeEnv;
  fetchImpl?: typeof fetch;
}): Promise<{ summaryShort: string; usedFallback: boolean; error: string | null }> {
  const fallback = sanitizeShortMemory(args.latestCustomerText || args.transcript || fallbackForKind(null));
  if (!clean(args.env?.OPEN_ROUTER_API_KEY)) {
    return { summaryShort: fallback, usedFallback: true, error: "missing_open_router_api_key" };
  }
  return { summaryShort: fallback, usedFallback: true, error: "openrouter_not_implemented" };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
deno test --allow-env --allow-net=deno.land supabase/functions/_shared/crm_ai_payload.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/crm_ai_payload.ts supabase/functions/_shared/crm_ai_payload.test.ts
git commit -m "feat: add CRM AI media summary fallbacks"
```

## Task 3: Real OpenRouter and Groq Calls

**Files:**
- Modify: `supabase/functions/_shared/crm_ai_payload.ts`
- Modify: `supabase/functions/_shared/crm_ai_payload.test.ts`

- [ ] **Step 1: Write failing mocked network tests**

Append:

```ts
Deno.test("generateSummaryShort calls OpenRouter when key exists", async () => {
  let capturedBody = "";
  const result = await generateSummaryShort({
    transcript: "CLIENTE: Quero vender iPhone 13 com tela trincada.",
    latestCustomerText: "Quero vender iPhone 13 com tela trincada.",
    env: { OPEN_ROUTER_API_KEY: "test-key", OPEN_ROUTER_SUMMARY_MODEL: "model-test" },
    fetchImpl: ((url: string | URL | Request, init?: RequestInit) => {
      assertEquals(String(url), "https://openrouter.ai/api/v1/chat/completions");
      capturedBody = String(init?.body || "");
      return Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: "Cliente quer vender iPhone 13 com tela trincada." } }] }), { status: 200 }));
    }) as typeof fetch,
  });

  assert(capturedBody.includes("model-test"));
  assertEquals(result.summaryShort, "Cliente quer vender iPhone 13 com tela trincada.");
  assertEquals(result.usedFallback, false);
});

Deno.test("transcribeAudioForAi posts multipart to Groq", async () => {
  const result = await transcribeAudioForAi({
    mediaUrl: "https://cdn.test/audio.ogg",
    mediaType: "audio/ogg",
    env: { GROQ_API_KEY: "groq-key" },
    fetchImpl: ((url: string | URL | Request) => {
      if (String(url) === "https://cdn.test/audio.ogg") {
        return Promise.resolve(new Response(new Blob(["audio"], { type: "audio/ogg" }), { status: 200 }));
      }
      assertEquals(String(url), "https://api.groq.com/openai/v1/audio/transcriptions");
      return Promise.resolve(new Response(JSON.stringify({ text: "Áudio transcrito." }), { status: 200 }));
    }) as typeof fetch,
  });

  assertEquals(result.text, "Áudio transcrito.");
  assertEquals(result.error, null);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run the helper test. Expected: OpenRouter/Groq mocked tests fail because real calls are not implemented.

- [ ] **Step 3: Implement API wrappers**

Replace the fallback-only implementations of `transcribeAudioForAi`, `describeImageForAi`, and `generateSummaryShort` with real fetch calls:

- Download media first with `fetchImpl(mediaUrl)`.
- For audio, create a `File` from `await response.blob()`, send `FormData` to Groq with `model=whisper-large-v3-turbo`, `language=pt`, `response_format=verbose_json`.
- For image, base64 encode `await response.arrayBuffer()`, send OpenRouter chat payload using `mistralai/mistral-ocr-latest` unless env override exists.
- For summary, send transcript prompt to OpenRouter using `OPEN_ROUTER_SUMMARY_MODEL` or default `mistralai/mistral-ocr-latest`.
- Always return structured `{ text/error }` or `{ summaryShort/usedFallback/error }`; never throw for LLM/media failures.

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
deno test --allow-env --allow-net=deno.land supabase/functions/_shared/crm_ai_payload.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/crm_ai_payload.ts supabase/functions/_shared/crm_ai_payload.test.ts
git commit -m "feat: call CRM AI media and summary engines"
```

## Task 4: Manual Handoff Refactor

**Files:**
- Modify: `supabase/functions/crm-conversation-handoff/index.ts`
- Modify: `supabase/functions/crm-send-message/index.contract.test.ts`

- [ ] **Step 1: Update contract test first**

Change the `crm-conversation-handoff supports target ai and webhook URL` test to:

```ts
Deno.test("crm-conversation-handoff supports compact target ai payload and summary_short", () => {
  assertStringIncludes(handoffSource, "target");
  assertStringIncludes(handoffSource, "ai_resume_webhook_url");
  assertStringIncludes(handoffSource, "crm_manual_handoff_to_ai");
  assertStringIncludes(handoffSource, "summary_short");
  assertStringIncludes(handoffSource, "buildCompactManualHandoffPayload");
  if (handoffSource.includes("conversation_context: conversationContext")) {
    throw new Error("manual handoff must not send the old large conversation_context payload");
  }
});
```

- [ ] **Step 2: Run contract test to verify failure**

Run:

```bash
deno test --allow-read --allow-env --allow-net=deno.land supabase/functions/crm-send-message/index.contract.test.ts
```

Expected: fail because `buildCompactManualHandoffPayload` is not used yet or old `conversation_context` is still present.

- [ ] **Step 3: Refactor `crm-conversation-handoff`**

Modify imports:

```ts
import {
  buildCompactManualHandoffPayload,
  buildTranscript,
  generateSummaryShort,
  readEnv,
  resolveLatestCustomerMessageForAi,
  selectLatestCustomerMessage,
  type CrmAiMessageRow,
} from "../_shared/crm_ai_payload.ts";
```

Change conversation select to include `created_at`.

Replace the old 80-message context block with:

```ts
const sessionStart = String(leadRecord.handoff_at || leadRecord.human_started_at || conversation.created_at || new Date().toISOString());
const { data: rawMessages, error: messagesError } = await supabase
  .from("crm_messages")
  .select("id,direction,sender_type,content,created_at,media_url,media_type,webhook_payload,provider_message_id,event_origin")
  .eq("conversation_id", conversationId)
  .gte("created_at", sessionStart)
  .order("created_at", { ascending: true })
  .limit(500);

if (messagesError) return jsonResponse({ error: messagesError.message }, 500);

const contextMessages = ((rawMessages || []) as CrmAiMessageRow[]).filter((message) =>
  (message.direction === "inbound" && message.sender_type === "customer") ||
  (message.direction === "outbound" && message.sender_type === "human")
);
const latestCustomerMessage = selectLatestCustomerMessage(contextMessages);
const latestResolution = await resolveLatestCustomerMessageForAi({
  message: latestCustomerMessage,
  env: readEnv(),
});
const transcript = buildTranscript(contextMessages);
const summaryResult = await generateSummaryShort({
  transcript,
  latestCustomerText: latestResolution.text,
  env: readEnv(),
});
const summaryShort = summaryResult.summaryShort;
```

Update lead after conversation status update:

```ts
await supabase
  .from("crm_leads")
  .update({
    summary_short: summaryShort,
    conversation_status: "em_atendimento_ia",
    attendance_owner: "ia",
    handoff_at: now,
    last_agent_type: "alana",
    updated_at: now,
  })
  .eq("id", conversation.lead_id);
```

Replace old `triggerPayload` with `buildCompactManualHandoffPayload(...)`.

Log payload should include:

```ts
summary_short: summaryShort,
context_message_count: contextMessages.length,
latest_message_id: latestCustomerMessage?.id || null,
latest_media_kind: latestResolution.mediaKind,
latest_message_fallback: latestResolution.usedFallback,
latest_message_error: latestResolution.error,
summary_fallback: summaryResult.usedFallback,
summary_error: summaryResult.error,
trigger_payload: triggerPayload,
```

- [ ] **Step 4: Run contract test**

Run:

```bash
deno test --allow-read --allow-env --allow-net=deno.land supabase/functions/crm-send-message/index.contract.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/crm-conversation-handoff/index.ts supabase/functions/crm-send-message/index.contract.test.ts
git commit -m "feat: compact manual CRM AI handoff"
```

## Task 5: Future Inbound Dispatch Refactor

**Files:**
- Modify: `supabase/functions/_shared/crm_ai_inbound_dispatch.ts`
- Modify: `supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts`

- [ ] **Step 1: Add failing assertion for webhook body**

In `AI dispatch continues an existing AI-handled conversation without entry settings`, capture the body:

```ts
let webhookBody: Record<string, unknown> | null = null;
globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => {
  webhookCalls += 1;
  webhookBody = JSON.parse(String(init?.body || "{}"));
  return Promise.resolve(new Response("ok", { status: 200 }));
}) as typeof fetch;
```

Update mocked `crm_leads` row:

```ts
return Promise.resolve({ data: { id: "lead-1", name: "Cliente Teste", summary_short: "Cliente negocia iPhone 13." }, error: null });
```

Add assertions:

```ts
assertEquals(webhookBody?.event, "inbound_message");
assertEquals((webhookBody?.lead as Record<string, unknown>).summary_short, "Cliente negocia iPhone 13.");
assertEquals("lead_detail" in (webhookBody || {}), false);
```

- [ ] **Step 2: Run dispatch test to verify failure**

Run:

```bash
deno test --allow-env --allow-net=deno.land supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts
```

Expected: fail because the current payload still includes `lead_detail` and is built inline.

- [ ] **Step 3: Refactor dispatch**

Import:

```ts
import { buildCompactAiInboundPayload } from "./crm_ai_payload.ts";
```

Replace inline `triggerPayload` with:

```ts
const triggerPayload = {
  ...buildCompactAiInboundPayload({
    instanceName: String(leadDetail?.entity_id || "").trim() || "crm",
    storeId,
    leadId: phoneDigits || leadId,
    leadSummaryShort: String(leadDetail?.summary_short || ""),
    senderName,
    chatid,
    conversationId,
    channelId,
    messageId,
    providerMessageId: args.providerMessageId,
    messageText: args.content,
    mediaUrl: args.mediaUrl,
    mediaType: args.mediaType,
    timestamp: messageTimestamp,
    instagramUserId: args.instagramUserId ?? null,
    instagramUsername: args.instagramUsername ?? null,
  }),
  raw_inbound: truncateRawInbound(args.rawInbound),
};
```

Do not include `lead_detail` in the webhook payload. Keep `lead_detail_error` only in internal logs if needed.

- [ ] **Step 4: Run dispatch test**

Run:

```bash
deno test --allow-env --allow-net=deno.land supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/crm_ai_inbound_dispatch.ts supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts
git commit -m "feat: compact CRM AI inbound dispatch"
```

## Task 6: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused Deno tests**

```bash
deno test --allow-read --allow-env --allow-net supabase/functions/_shared/crm_ai_payload.test.ts supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts supabase/functions/crm-send-message/index.contract.test.ts supabase/functions/crm-ai-inbound/index.contract.test.ts
```

Expected: all pass.

- [ ] **Step 2: Run relevant Vitest contracts**

```bash
npm run test:run -- tests/crm-ai-routing-correction-migration.test.ts tests/crm-ai-agent-parity-migration.test.ts
```

Expected: all pass.

- [ ] **Step 3: Check git status**

```bash
git status --short
```

Expected: no uncommitted files after the final commit.

- [ ] **Step 4: Final commit if verification required fixes**

If verification required follow-up edits:

```bash
git add supabase/functions/_shared/crm_ai_payload.ts supabase/functions/_shared/crm_ai_payload.test.ts supabase/functions/_shared/crm_ai_inbound_dispatch.ts supabase/functions/_shared/crm_ai_inbound_dispatch.test.ts supabase/functions/crm-conversation-handoff/index.ts supabase/functions/crm-send-message/index.contract.test.ts
git commit -m "test: verify compact CRM AI handoff"
```

