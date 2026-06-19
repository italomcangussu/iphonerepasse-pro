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
});
