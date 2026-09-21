import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("send-reservation-whatsapp function configuration", () => {
  it("disables gateway JWT verification so browser CORS preflight reaches the function", () => {
    const config = readFileSync("supabase/config.toml", "utf8");

    expect(config).toContain("[functions.send-reservation-whatsapp]");
    expect(config).toMatch(/\[functions\.send-reservation-whatsapp\]\s+verify_jwt\s*=\s*false/);
  });

  it("keeps custom Supabase auth inside the function", () => {
    const source = readFileSync("supabase/functions/send-reservation-whatsapp/index.ts", "utf8");

    expect(source).toContain('if (req.method === "OPTIONS") return new Response("ok"');
    expect(source).toContain("const supabase = createServiceClient();");
    expect(source).toContain("await requireAuthenticatedRole(req, supabase);");
    expect(source).toContain("/functions/v1/crm-send-message");
    expect(source).toContain('supabase.rpc("upsert_crm_lead"');
    expect(source).not.toContain("buildUazSendMessageRequest");
  });

  it("requires the reservation message payload before touching the CRM", () => {
    const source = readFileSync("supabase/functions/send-reservation-whatsapp/index.ts", "utf8");

    expect(source).toContain("phone, storeId e content são obrigatórios.");
    expect(source).toContain("Mensagem da reserva excede o limite de caracteres.");
  });

  it("uses the resolved CRM channel store for CRM lead and message routing", () => {
    const source = readFileSync("supabase/functions/send-reservation-whatsapp/index.ts", "utf8");

    expect(source).toContain("const crmStoreId = String(channel.store_id || storeId);");
    expect(source).toContain("p_store_id: crmStoreId");
    expect(source).toContain("reservation_store_id: storeId");
    expect(source).toContain(".or(`store_id.eq.${storeId},store_id.eq.${defaultCrmStoreId}`)");
  });

  it("keeps the attendance human after confirming the reservation", () => {
    const source = readFileSync("supabase/functions/send-reservation-whatsapp/index.ts", "utf8");

    expect(source).toContain('.update({ status: "human_handling", ai_enabled: false, updated_at: now })');
    expect(source).toContain('conversation_status: "em_atendimento_humano"');
    expect(source).toContain('attendance_owner: "humano_loja"');
  });
});
