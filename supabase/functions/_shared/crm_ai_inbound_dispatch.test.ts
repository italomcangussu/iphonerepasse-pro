import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  __private__,
  dispatchAiInboundIfEligible,
  resolveLastMessageIdForAi,
  resolveReplyContextForAi,
} from "./crm_ai_inbound_dispatch.ts";

Deno.test("AI dispatch helper treats text-like media as non-media", () => {
  assertEquals(__private__.isAiDispatchMediaType("text"), false);
  assertEquals(__private__.isAiDispatchMediaType("conversation"), false);
  assertEquals(__private__.isAiDispatchMediaType("image/jpeg"), true);
});

Deno.test("AI dispatch skips missing or non-HTTPS webhook and logs reason", async () => {
  const inserted: Array<Record<string, unknown>> = [];
  const supabase = {
    from(table: string) {
      if (table === "crm_event_log") {
        return {
          insert(payload: Record<string, unknown>) {
            inserted.push(payload);
            return Promise.resolve({ data: null, error: null });
          },
          select() {
            return this;
          },
          eq() {
            return this;
          },
          filter() {
            return this;
          },
          gte() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle() {
            return Promise.resolve({ data: null, error: null });
          },
        };
      }

      return {
        select() {
          return this;
        },
        eq(column: string, value: string) {
          Object.assign(this, { column, value });
          return this;
        },
        maybeSingle() {
          if (table === "crm_conversations") {
            return Promise.resolve({ data: { status: "ai_handling", ai_enabled: true }, error: null });
          }
          if (table === "crm_channels") {
            return Promise.resolve({ data: { ai_resume_webhook_url: "http://invalid.test/hook" }, error: null });
          }
          if (table === "crm_ai_entry_settings") {
            return Promise.resolve({ data: { is_enabled: true }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };

  await dispatchAiInboundIfEligible({
    supabase,
    conversationId: "conv-1",
    storeId: "store-1",
    channelId: "channel-1",
    leadId: "lead-1",
    messageId: "message-1",
    content: "Oi",
    mediaUrl: null,
    mediaType: null,
    rawInbound: {},
    chatid: "559999999999@s.whatsapp.net",
    phone: "+559999999999",
    providerMessageId: "provider-1",
    messageAt: new Date().toISOString(),
    isFromMe: false,
    senderType: "customer",
    eventOrigin: null,
  });

  assertEquals(inserted.length, 1);
  assertEquals(inserted[0].event_type, "crm_ai_inbound_dispatch_skipped");
  assertEquals((inserted[0].payload as Record<string, unknown>).reason, "invalid_webhook_url");
});

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
    provider_message_id: "provider-target",
    channel_id: "channel-1",
  });
});

Deno.test("resolveLastMessageIdForAi returns previous provider message id for same lead", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const supabase = {
    from(table: string) {
      return {
        filters: {} as Record<string, unknown>,
        table,
        select(value: string) {
          this.filters.select = value;
          return this;
        },
        eq(column: string, value: string) {
          this.filters[column] = value;
          return this;
        },
        not(column: string, operator: string, value: unknown) {
          this.filters.not = { column, operator, value };
          return this;
        },
        neq(column: string, value: string) {
          this.filters[`neq:${column}`] = value;
          return this;
        },
        order(column: string, options: Record<string, unknown>) {
          this.filters.order = { column, options };
          return this;
        },
        limit(value: number) {
          this.filters.limit = value;
          calls.push({ ...this.filters });
          return Promise.resolve({
            data: [
              { id: "previous-crm-message", provider_message_id: "provider-previous" },
              { id: "older-crm-message", provider_message_id: "provider-older" },
            ],
            error: null,
          });
        },
      };
    },
  };

  const result = await resolveLastMessageIdForAi({
    supabase,
    leadId: "lead-1",
    currentMessageId: "current-crm-message",
    currentProviderMessageId: "provider-current",
  });

  assertEquals(result, "provider-previous");
  assertEquals(calls[0]["lead_id"], "lead-1");
  assertEquals(calls[0]["neq:id"], "current-crm-message");
  assertEquals(calls[0]["neq:provider_message_id"], "provider-current");
});

Deno.test("resolveLastMessageIdForAi returns null for first lead message", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        not() {
          return this;
        },
        neq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return Promise.resolve({ data: [], error: null });
        },
      };
    },
  };

  const result = await resolveLastMessageIdForAi({
    supabase,
    leadId: "lead-1",
    currentMessageId: "current-crm-message",
    currentProviderMessageId: "provider-current",
  });

  assertEquals(result, null);
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
        not() {
          return this;
        },
        neq() {
          return this;
        },
        order() {
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
        not() {
          return this;
        },
        neq() {
          return this;
        },
        order() {
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

Deno.test("AI dispatch continues an existing AI-handled conversation without entry settings", async () => {
  const inserted: Array<Record<string, unknown>> = [];
  const originalFetch = globalThis.fetch;
  let webhookCalls = 0;
  let webhookBody: any = null;
  globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => {
    webhookCalls += 1;
    webhookBody = JSON.parse(String(init?.body || "{}"));
    return Promise.resolve(new Response("ok", { status: 200 }));
  }) as typeof fetch;

  const supabase = {
    from(table: string) {
      if (table === "crm_event_log") {
        return {
          insert(payload: Record<string, unknown>) {
            inserted.push(payload);
            return Promise.resolve({ data: null, error: null });
          },
          select() {
            return this;
          },
          eq() {
            return this;
          },
          filter() {
            return this;
          },
          gte() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle() {
            return Promise.resolve({ data: null, error: null });
          },
        };
      }

      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        not() {
          return this;
        },
        neq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle() {
          if (table === "crm_conversations") {
            return Promise.resolve({ data: { status: "ai_handling", ai_enabled: true }, error: null });
          }
          if (table === "crm_channels") {
            return Promise.resolve({ data: { ai_resume_webhook_url: "https://ia.example.test/hook" }, error: null });
          }
          if (table === "crm_ai_entry_settings") {
            return Promise.resolve({ data: null, error: null });
          }
          if (table === "crm_leads") {
            return Promise.resolve({
              data: { id: "lead-1", name: "Cliente Teste", summary_short: "Cliente negocia iPhone 13." },
              error: null,
            });
          }
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
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };

  try {
    await dispatchAiInboundIfEligible({
      supabase,
      conversationId: "conv-1",
      storeId: "store-1",
      channelId: "channel-1",
      leadId: "lead-1",
      messageId: "message-1",
      content: "Continuar com IA",
      mediaUrl: null,
      mediaType: null,
      rawInbound: {},
      chatid: "558899999999@s.whatsapp.net",
      phone: "+558899999999",
      providerMessageId: "provider-1",
      messageAt: new Date().toISOString(),
      isFromMe: false,
      senderType: "customer",
      eventOrigin: "direct",
      replyToProviderMessageId: "provider-target",
      replyPreviewText: "Tem cor de preferência? 😊",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assertEquals(webhookCalls, 1);
  assertEquals(webhookBody?.event, "inbound_message");
  assertEquals(webhookBody?.reply_context, {
    target_provider_message_id: "provider-target",
    target_message_id: "target-1",
    target_text: "Tem cor de preferência? 😊",
    target_direction: "outbound",
    target_sender_type: "ai_inbound",
    target_created_at: "2026-06-06T12:39:00.000Z",
    preview_source: "db_lookup",
  });
  assertEquals((webhookBody?.lead as Record<string, unknown>).summary_short, "Cliente negocia iPhone 13.");
  assertEquals("lead_detail" in (webhookBody || {}), false);
  assertEquals(inserted.at(-1)?.event_type, "crm_ai_inbound_dispatched");
  assertEquals((inserted.at(-1)?.payload as Record<string, unknown>).dispatched, true);
  assertEquals((inserted.at(-1)?.payload as Record<string, unknown>).reply_context_source, "db_lookup");
});
