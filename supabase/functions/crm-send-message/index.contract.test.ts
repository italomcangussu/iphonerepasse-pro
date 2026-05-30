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

Deno.test("crm-conversation-handoff supports target ai and webhook URL", () => {
  assertStringIncludes(handoffSource, "target");
  assertStringIncludes(handoffSource, "ai_resume_webhook_url");
  assertStringIncludes(handoffSource, "crm_manual_handoff_to_ai");
  assertStringIncludes(handoffSource, "summary_short");
  assertStringIncludes(handoffSource, "summary_operational");
});
