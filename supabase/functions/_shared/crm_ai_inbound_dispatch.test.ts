import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { __private__, dispatchAiInboundIfEligible } from "./crm_ai_inbound_dispatch.ts";

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
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assertEquals(webhookCalls, 1);
  assertEquals(webhookBody?.event, "inbound_message");
  assertEquals((webhookBody?.lead as Record<string, unknown>).summary_short, "Cliente negocia iPhone 13.");
  assertEquals("lead_detail" in (webhookBody || {}), false);
  assertEquals(inserted.at(-1)?.event_type, "crm_ai_inbound_dispatched");
  assertEquals((inserted.at(-1)?.payload as Record<string, unknown>).dispatched, true);
});
