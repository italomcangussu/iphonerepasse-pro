import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("send-receipt-whatsapp function configuration", () => {
  it("disables gateway JWT verification so browser CORS preflight reaches the function", () => {
    const config = readFileSync("supabase/config.toml", "utf8");

    expect(config).toContain("[functions.send-receipt-whatsapp]");
    expect(config).toMatch(/\[functions\.send-receipt-whatsapp\]\s+verify_jwt\s*=\s*false/);
  });

  it("keeps custom Supabase auth inside the function", () => {
    const source = readFileSync("supabase/functions/send-receipt-whatsapp/index.ts", "utf8");

    expect(source).toContain('if (req.method === "OPTIONS") return new Response("ok"');
    expect(source).toContain("const supabase = createServiceClient();");
    expect(source).toContain("await requireAuthenticatedRole(req, supabase);");
    expect(source).toContain('/functions/v1/crm-send-message');
    expect(source).toContain('supabase.rpc("upsert_crm_lead"');
    expect(source).not.toContain("buildUazSendMessageRequest");
  });

  it("uses the resolved CRM channel store for CRM lead and message routing", () => {
    const source = readFileSync("supabase/functions/send-receipt-whatsapp/index.ts", "utf8");

    expect(source).toContain("const crmStoreId = String(channel.store_id || body.storeId);");
    expect(source).toContain("p_store_id: crmStoreId");
    expect(source).toContain("receipt_store_id: body.storeId");
    expect(source).toContain(".or(`store_id.eq.${body.storeId},store_id.eq.${defaultCrmStoreId}`)");
  });

  it("keeps the attendance human after sending the receipt", () => {
    const source = readFileSync("supabase/functions/send-receipt-whatsapp/index.ts", "utf8");

    expect(source).toContain('.update({ status: "human_handling", ai_enabled: false, updated_at: now })');
    expect(source).toContain('conversation_status: "em_atendimento_humano"');
    expect(source).toContain('attendance_owner: "humano_loja"');
  });

  it("accepts jsPDF data URIs that include filename metadata before base64", () => {
    const source = readFileSync("supabase/functions/send-receipt-whatsapp/index.ts", "utf8");

    expect(source).toContain("replace(/^data:.*?;base64,/i");
    expect(source).toContain("PDF inválido: payload base64 ausente.");
  });
});
