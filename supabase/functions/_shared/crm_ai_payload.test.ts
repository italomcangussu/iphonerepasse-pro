import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildCompactAiInboundPayload,
  buildCompactManualHandoffPayload,
  buildTranscript,
  generateSummaryShort,
  resolveLatestCustomerMessageForAi,
  sanitizeShortMemory,
  selectLatestCustomerMessage,
  transcribeAudioForAi,
} from "./crm_ai_payload.ts";

Deno.test("buildTranscript keeps customer and human messages compact", () => {
  const transcript = buildTranscript([
    {
      direction: "inbound",
      sender_type: "customer",
      content: "Quero vender um iPhone 13",
      created_at: "2026-06-05T10:00:00Z",
    },
    {
      direction: "outbound",
      sender_type: "human",
      content: "Pode enviar fotos?",
      created_at: "2026-06-05T10:01:00Z",
    },
    {
      direction: "outbound",
      sender_type: "ai_inbound",
      content: "Ignore",
      created_at: "2026-06-05T10:02:00Z",
    },
  ]);

  assertEquals(transcript, "CLIENTE: Quero vender um iPhone 13\nATENDENTE: Pode enviar fotos?");
});

Deno.test("selectLatestCustomerMessage chooses newest inbound customer message", () => {
  const latest = selectLatestCustomerMessage([
    {
      id: "old",
      direction: "inbound",
      sender_type: "customer",
      content: "Antiga",
      created_at: "2026-06-05T10:00:00Z",
    },
    {
      id: "human",
      direction: "outbound",
      sender_type: "human",
      content: "Resposta",
      created_at: "2026-06-05T10:02:00Z",
    },
    {
      id: "new",
      direction: "inbound",
      sender_type: "customer",
      content: "Nova",
      created_at: "2026-06-05T10:03:00Z",
    },
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
    lastMessageId: "provider-before-transfer",
    lastMessageIdAt: "2026-06-05T10:03:00.000Z",
    summaryShort: "Cliente quer vender iPhone e enviou foto para avaliação.",
    timestamp: 1780000000000,
  }) as Record<string, unknown>;

  assertEquals(payload.event, "manual_handoff_to_ai");
  assertEquals(
    (payload.lead as Record<string, unknown>).summary_short,
    "Cliente quer vender iPhone e enviou foto para avaliação.",
  );
  assertEquals("conversation_context" in payload, false);
  assertEquals(((payload.body as Record<string, any>).message).content, "Cliente enviou foto do aparelho.");
  assertEquals(((payload.body as Record<string, any>).message).last_messageid, "provider-before-transfer");
  assertEquals(((payload.body as Record<string, any>).message).last_messageid_at, "2026-06-05T10:03:00.000Z");
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
    lastMessageId: "provider-0",
    lastMessageIdAt: "2026-06-05T10:02:00.000Z",
    messageText: "Qual o próximo passo?",
    mediaUrl: null,
    mediaType: null,
    timestamp: 1780000000000,
  });

  assertEquals(payload.event, "inbound_message");
  assertEquals(payload.type, "text");
  assertEquals(payload.lead.summary_short, "Cliente está negociando iPhone 13.");
  assertEquals(payload.body.message.last_messageid, "provider-0");
  assertEquals(payload.body.message.last_messageid_at, "2026-06-05T10:02:00.000Z");
});

Deno.test("compact payloads use null last_messageid when current message is first", () => {
  const handoffPayload = buildCompactManualHandoffPayload({
    event: "manual_handoff_to_ai",
    instanceName: "crm",
    storeId: "store-1",
    leadId: "lead-1",
    leadPhone: "",
    chatid: "chat-1",
    senderName: "Cliente",
    conversationId: "conv-1",
    channelId: "channel-1",
    reason: "manual_handoff_to_ai",
    messageText: "Primeira mensagem",
    summaryShort: "",
    timestamp: 1780000000000,
  });

  const inboundPayload = buildCompactAiInboundPayload({
    instanceName: "crm",
    storeId: "store-1",
    leadId: "lead-1",
    leadSummaryShort: "",
    senderName: "Cliente",
    chatid: "chat-1",
    conversationId: "conv-1",
    channelId: "channel-1",
    messageId: "msg-1",
    providerMessageId: "provider-1",
    messageText: "Primeira mensagem",
    mediaUrl: null,
    mediaType: null,
    timestamp: 1780000000000,
  });

  assertEquals(handoffPayload.body.message.last_messageid, null);
  assertEquals(handoffPayload.body.message.last_messageid_at, null);
  assertEquals(inboundPayload.body.message.last_messageid, null);
  assertEquals(inboundPayload.body.message.last_messageid_at, null);
});

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
    message: {
      id: "img",
      direction: "inbound",
      sender_type: "customer",
      content: "",
      media_url: "https://cdn.test/foto.jpg",
      media_type: "image/jpeg",
    },
    env: { OPEN_ROUTER_API_KEY: "" },
    fetchImpl: (() => Promise.reject(new Error("no network"))) as typeof fetch,
  });

  assertEquals(result.text, "Cliente enviou imagem e aguarda continuidade do atendimento.");
  assertEquals(result.mediaKind, "image");
  assertEquals(result.usedFallback, true);
});

Deno.test("generateSummaryShort calls OpenRouter when key exists", async () => {
  let capturedBody = "";
  const result = await generateSummaryShort({
    transcript: "CLIENTE: Quero vender iPhone 13 com tela trincada.",
    latestCustomerText: "Quero vender iPhone 13 com tela trincada.",
    env: { OPEN_ROUTER_API_KEY: "test-key", OPEN_ROUTER_SUMMARY_MODEL: "model-test" },
    fetchImpl: ((url: string | URL | Request, init?: RequestInit) => {
      assertEquals(String(url), "https://openrouter.ai/api/v1/chat/completions");
      capturedBody = String(init?.body || "");
      return Promise.resolve(new Response(JSON.stringify({
        choices: [{ message: { content: "Cliente quer vender iPhone 13 com tela trincada." } }],
      }), { status: 200 }));
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
