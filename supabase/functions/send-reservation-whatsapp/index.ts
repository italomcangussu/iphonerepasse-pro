/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  parseJsonBody,
  requireAuthenticatedRole,
  sanitizeText,
} from "../_shared/crm.ts";

/**
 * Mensagem automática de confirmação de reserva (ERP → WhatsApp do cliente).
 *
 * Mesmo caminho do comprovante do PDV (`send-receipt-whatsapp`): resolve um canal
 * WhatsApp ativo, garante o lead no CRM e delega o envio ao `crm-send-message`.
 * O texto já chega pronto — quem resolve as variáveis da reserva é o app.
 */

type RequestBody = {
  phone?: string;
  storeId?: string;
  content?: string;
  customerName?: string;
  reservationId?: string;
  stockItemId?: string;
};

const MAX_CONTENT_LENGTH = 4000;

const invokeCrmSendMessage = async (req: Request, body: Record<string, unknown>) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL.");

  const authHeader = req.headers.get("Authorization") || "";
  const apiKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const response = await fetch(`${supabaseUrl}/functions/v1/crm-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(apiKey ? { apikey: apiKey } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text };
  }

  if (!response.ok || payload.error) {
    throw new Error(String(payload.error || `crm-send-message falhou: ${response.status}`));
  }

  return payload;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createServiceClient();
  try {
    await requireAuthenticatedRole(req, supabase);
  } catch {
    return jsonResponse({ error: "Não autorizado." }, 401);
  }

  try {
    const body = await parseJsonBody<RequestBody>(req);
    const phone = sanitizeText(body?.phone);
    const storeId = sanitizeText(body?.storeId);
    const content = String(body?.content ?? "").trim();

    if (!phone || !storeId || !content) {
      return jsonResponse({ error: "phone, storeId e content são obrigatórios." }, 400);
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return jsonResponse({ error: "Mensagem da reserva excede o limite de caracteres." }, 400);
    }

    const { data: defaultCrmStoreId } = await supabase.rpc("resolve_crm_default_store_id");

    // Prefere um canal da loja da reserva, depois o CRM centralizado.
    const { data: channels, error: channelErr } = await supabase
      .from("crm_channels")
      .select("*")
      .eq("provider", "uazapi")
      .eq("is_active", true)
      .or(`store_id.eq.${storeId},store_id.eq.${defaultCrmStoreId}`)
      .order("created_at", { ascending: true })
      .limit(1);

    let resolvedChannels = channels;
    let resolvedChannelErr = channelErr;

    if (!resolvedChannelErr && (!resolvedChannels || resolvedChannels.length === 0)) {
      const fallback = await supabase
        .from("crm_channels")
        .select("*")
        .eq("provider", "uazapi")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1);

      resolvedChannels = fallback.data;
      resolvedChannelErr = fallback.error;
    }

    if (resolvedChannelErr || !resolvedChannels || resolvedChannels.length === 0) {
      return jsonResponse({ error: "Nenhum canal WhatsApp ativo configurado para esta loja." }, 422);
    }

    const channel = resolvedChannels[0];
    const crmStoreId = String(channel.store_id || storeId);

    const { data: leadId, error: leadError } = await supabase.rpc("upsert_crm_lead", {
      p_store_id: crmStoreId,
      p_phone: phone,
      p_name: sanitizeText(body?.customerName),
      p_channel_id: channel.id,
      p_first_message: "Reserva de aparelho confirmada pelo estoque.",
      p_intent: "reservation",
    });

    if (leadError || !leadId) {
      return jsonResponse({ error: leadError?.message || "Erro ao preparar lead no CRM." }, 500);
    }

    try {
      const crmResult = await invokeCrmSendMessage(req, {
        leadId,
        channelId: channel.id,
        content,
        reservation_store_id: storeId,
      });

      // Confirmar reserva é ato HUMANO da loja: o `crm-send-message` cria a conversa
      // com ai_enabled=true (a UI trata como "IA em atendimento" e tranca o campo
      // de digitação atrás do "Assumir"). Mantém o atendimento humano.
      const now = new Date().toISOString();
      const conversationId = typeof crmResult.conversationId === "string"
        ? crmResult.conversationId
        : "";
      if (conversationId) {
        await supabase
          .from("crm_conversations")
          .update({ status: "human_handling", ai_enabled: false, updated_at: now })
          .eq("id", conversationId);
      }
      await supabase
        .from("crm_leads")
        .update({
          conversation_status: "em_atendimento_humano",
          attendance_owner: "humano_loja",
          human_started_at: now,
          last_agent_type: "humano",
          updated_at: now,
        })
        .eq("id", leadId);

      return jsonResponse({ ok: true, crm: crmResult });
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : "Erro ao enviar pelo CRM." }, 502);
    }
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
