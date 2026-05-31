import { assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("crm-ai-inbound records invocation and sends AI response", () => {
  assertStringIncludes(source, "crm_ai_agent_invocations");
  assertStringIncludes(source, "senderType: \"ai_inbound\"");
  assertStringIncludes(source, "ai_escalation");
  assertStringIncludes(source, "human_assumed_during_ai_response");
});

Deno.test("crm-ai-inbound transfers to a pending human handoff (not directly assumed)", () => {
  assertStringIncludes(source, "agent_requested_human_handoff");
  assertStringIncludes(source, "transferRequested");
  assertStringIncludes(source, "markHandoffPending");
  // Lands in the pending state the CRM list blinks red, NOT the assumed state.
  assertStringIncludes(source, "conversation_status: \"transferencia_pendente\"");
  // Must not skip straight to the assumed state (that is what "Assumir" does in the UI).
  if (source.includes("conversation_status: \"em_atendimento_humano\"")) {
    throw new Error("handoff must set transferencia_pendente, not em_atendimento_humano");
  }
  // Both the agent-requested transfer and the sentiment escalation reuse the same helper.
  assertStringIncludes(source, "ai_agent_transfer");
});

Deno.test("crm-ai-inbound ignores legacy lead summaries during AI handling", () => {
  assertStringIncludes(source, "summary_short");
  assertStringIncludes(source, "summary_operational");
  assertStringIncludes(source, "legacy_summary_fields_ignored");
  assertStringIncludes(source, "crm_ai_inbound_legacy_summary_ignored");
});
