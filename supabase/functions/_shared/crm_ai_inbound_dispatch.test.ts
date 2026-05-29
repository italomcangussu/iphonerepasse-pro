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
