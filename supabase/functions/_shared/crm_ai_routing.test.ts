import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { applyAiRoutingDecision, resolveAiRoutingDecision } from "./crm_ai_routing.ts";

type FakeConfig = {
  channelMode: string | null;
  fallbackMode: string | null;
  webhook: string | null;
};

function fakeSupabase(config: FakeConfig) {
  const updates: Array<{ table: string; payload: Record<string, unknown>; filters: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; payload: Record<string, unknown> }> = [];

  return {
    updates,
    inserts,
    from(table: string) {
      const state = {
        filters: {} as Record<string, unknown>,
        select() {
          return this;
        },
        update(payload: Record<string, unknown>) {
          updates.push({ table, payload, filters: this.filters });
          return this;
        },
        insert(payload: Record<string, unknown>) {
          inserts.push({ table, payload });
          return Promise.resolve({ data: null, error: null });
        },
        eq(column: string, value: unknown) {
          this.filters[column] = value;
          return this;
        },
        maybeSingle() {
          if (table === "crm_channels") {
            return Promise.resolve({
              data: {
                ai_entry_mode: config.channelMode,
                ai_resume_webhook_url: config.webhook,
              },
              error: null,
            });
          }
          if (table === "crm_ai_entry_settings") {
            return Promise.resolve({
              data: {
                fallback_mode: config.fallbackMode,
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return state;
    },
  };
}

Deno.test("channel force_human overrides store force_ai", async () => {
  const supabase = fakeSupabase({
    channelMode: "force_human",
    fallbackMode: "force_ai",
    webhook: "https://ai.example/hook",
  });
  const decision = await resolveAiRoutingDecision({
    supabase,
    storeId: "store-1",
    channelId: "channel-1",
    conversationId: "conv-1",
    leadId: "lead-1",
  });
  assertEquals(decision.target, "human");
  assertEquals(decision.reason, "channel_force_human");
});

Deno.test("channel inherit uses store force_ai with valid webhook", async () => {
  const supabase = fakeSupabase({
    channelMode: "inherit",
    fallbackMode: "force_ai",
    webhook: "https://ai.example/hook",
  });
  const decision = await resolveAiRoutingDecision({
    supabase,
    storeId: "store-1",
    channelId: "channel-1",
    conversationId: "conv-1",
    leadId: "lead-1",
  });
  assertEquals(decision.target, "ai");
  assertEquals(decision.reason, "store_force_ai");
  assertEquals(decision.webhookUrl, "https://ai.example/hook");
});

Deno.test("AI without HTTPS webhook falls back to human", async () => {
  const supabase = fakeSupabase({
    channelMode: "force_ai",
    fallbackMode: "force_human",
    webhook: "http://bad.example/hook",
  });
  const decision = await resolveAiRoutingDecision({
    supabase,
    storeId: "store-1",
    channelId: "channel-1",
    conversationId: "conv-1",
    leadId: "lead-1",
  });
  assertEquals(decision.target, "human");
  assertEquals(decision.reason, "ai_unavailable_invalid_webhook");
});

Deno.test("apply routing decision updates conversation, lead, and logs fallback", async () => {
  const supabase = fakeSupabase({
    channelMode: "force_ai",
    fallbackMode: "force_human",
    webhook: "",
  });
  const decision = await resolveAiRoutingDecision({
    supabase,
    storeId: "store-1",
    channelId: "channel-1",
  });

  await applyAiRoutingDecision({
    supabase,
    decision,
    conversationId: "conv-1",
    leadId: "lead-1",
    storeId: "store-1",
    channelId: "channel-1",
  });

  assertEquals(supabase.updates[0].table, "crm_conversations");
  assertEquals(supabase.updates[0].payload.status, "human_handling");
  assertEquals(supabase.updates[0].payload.ai_enabled, false);
  assertEquals(supabase.updates[1].table, "crm_leads");
  assertEquals(supabase.updates[1].payload.conversation_status, "em_atendimento_humano");
  assertEquals(supabase.inserts[0].payload.event_type, "crm_ai_routing_decision");
  assertEquals(supabase.inserts[1].payload.event_type, "crm_ai_unavailable_fallback");
});
