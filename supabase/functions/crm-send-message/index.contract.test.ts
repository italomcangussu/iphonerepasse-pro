import { assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const handoffSource = await Deno.readTextFile(new URL("../crm-conversation-handoff/index.ts", import.meta.url));

Deno.test("crm-send-message supports guarded AI inbound sender", () => {
  assertStringIncludes(source, "senderType");
  assertStringIncludes(source, "ai_inbound");
  assertStringIncludes(source, "service_role");
  assertStringIncludes(source, "human_assumed_during_ai_response");
  assertStringIncludes(source, "status\", \"ai_handling\"");
});

Deno.test("crm-conversation-handoff supports compact target ai payload and summary_short", () => {
  assertStringIncludes(handoffSource, "target");
  assertStringIncludes(handoffSource, "ai_resume_webhook_url");
  assertStringIncludes(handoffSource, "crm_manual_handoff_to_ai");
  assertStringIncludes(handoffSource, "summary_short");
  assertStringIncludes(handoffSource, "buildCompactManualHandoffPayload");
  assertStringIncludes(handoffSource, "pendingCustomerTextForAiHandoffEnriched");
  assertStringIncludes(handoffSource, "buildEnrichedTranscript");
  if (handoffSource.includes("conversation_context: conversationContext")) {
    throw new Error("manual handoff must not send the old large conversation_context payload");
  }
  if (handoffSource.includes("pendingCustomerTextForAiHandoff((rawMessages")) {
    throw new Error("manual handoff must enrich all pending customer messages before dispatch");
  }
});
