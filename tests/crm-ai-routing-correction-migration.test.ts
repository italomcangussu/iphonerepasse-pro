import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260530120000_crm_ai_routing_correction.sql");
const sql = fs.readFileSync(migrationPath, "utf8");

describe("CRM AI routing correction migration", () => {
  it("adds channel AI entry mode and constrains values", () => {
    expect(sql).toContain("add column if not exists ai_entry_mode text not null default 'inherit'");
    expect(sql).toContain("chk_crm_channels_ai_entry_mode");
    expect(sql).toContain("'inherit', 'force_ai', 'force_human'");
  });

  it("cleans AI ownership and generic summaries conservatively", () => {
    expect(sql).toContain("crm_ai_unavailable_fallback");
    expect(sql).toContain("summary_short = null");
    expect(sql).toContain("summary_operational = null");
    expect(sql).toContain("conversation_status = 'em_atendimento_humano'");
  });

  it("allows crm-leads-api to update official lead memory", () => {
    expect(sql).toContain("create or replace function public.update_lead_memory");
    expect(sql).toContain("p_summary_short");
    expect(sql).toContain("p_summary_operational");
  });
});
