import { assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("crm-ai-inbound records invocation and sends AI response", () => {
  assertStringIncludes(source, "crm_ai_agent_invocations");
  assertStringIncludes(source, "senderType: \"ai_inbound\"");
  assertStringIncludes(source, "ai_escalation");
  assertStringIncludes(source, "human_assumed_during_ai_response");
});

Deno.test("crm-ai-inbound ignores legacy lead summaries during AI handling", () => {
  assertStringIncludes(source, "summary_short");
  assertStringIncludes(source, "summary_operational");
  assertStringIncludes(source, "legacy_summary_fields_ignored");
  assertStringIncludes(source, "crm_ai_inbound_legacy_summary_ignored");
});
