import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("supabase/functions/crm-delete-conversation/index.ts", "utf8");

describe("crm-delete-conversation edge function contract", () => {
  it("deletes the full conversation lead state while preserving linked customer data", () => {
    expect(source).toContain('.from("crm_messages")');
    expect(source).toContain('.from("lead_state")');
    expect(source).toContain('.from("crm_leads")');
    expect(source).toContain("deleted_lead_state");
    expect(source).toContain("deleted_lead");

    expect(source).not.toContain('.from("customers").delete()');
    expect(source).not.toContain('.from("sales").delete()');
  });

  it("triggers the n8n agent-memory purge with the lead_id, best-effort", () => {
    // n8n_chat_histories lives on a separate DB; the purge goes through the
    // "apagar memoria" webhook, sending lead_id, and must not block deletion.
    expect(source).toContain("CRM_MEMORY_PURGE_WEBHOOK_URL");
    expect(source).toContain("purgeAgentChatMemory");
    expect(source).toContain("JSON.stringify({ lead_id: leadId })");
    expect(source).toContain("agent_memory_purge");
    // Best-effort: the purge is awaited but its failure is caught, not thrown.
    expect(source).toContain("return { attempted: true, ok: false, error:");
  });
});
