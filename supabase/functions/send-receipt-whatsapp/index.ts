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

type RequestBody = {
  phone: string;
  pdfBase64: string;
  storeId: string;
  saleId?: string;
  customerName?: string;
};

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

    if (!body?.phone || !body?.pdfBase64 || !body?.storeId) {
      return jsonResponse({ error: "phone, pdfBase64 e storeId são obrigatórios." }, 400);
    }

    const { data: defaultCrmStoreId } = await supabase.rpc("resolve_crm_default_store_id");

    // Prefer a channel for the receipt store, then the centralized CRM store.
    const { data: channels, error: channelErr } = await supabase
      .from("crm_channels")
      .select("*")
      .eq("provider", "uazapi")
      .eq("is_active", true)
      .or(`store_id.eq.${body.storeId},store_id.eq.${defaultCrmStoreId}`)
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
    const crmStoreId = String(channel.store_id || body.storeId);

    // Decode base64 (strip data URI prefix if present)
    const base64Data = body.pdfBase64.replace(/^data:[^;]+;base64,/, "");
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Upload PDF to storage
    const filename = `${body.storeId}/${body.saleId ?? Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("receipts")
      .upload(filename, bytes, { contentType: "application/pdf", upsert: true });

    if (uploadErr) {
      return jsonResponse({ error: `Erro ao armazenar comprovante: ${uploadErr.message}` }, 500);
    }

    // Get a signed URL valid for 1 hour
    const { data: signedData, error: signedErr } = await supabase.storage
      .from("receipts")
      .createSignedUrl(filename, 3600);

    if (signedErr || !signedData?.signedUrl) {
      return jsonResponse({ error: "Erro ao gerar URL do comprovante." }, 500);
    }

    const { data: leadId, error: leadError } = await supabase.rpc("upsert_crm_lead", {
      p_store_id: crmStoreId,
      p_phone: body.phone,
      p_name: sanitizeText(body.customerName),
      p_channel_id: channel.id,
      p_first_message: "Comprovante de venda enviado pelo PDV.",
      p_intent: "receipt",
    });

    if (leadError || !leadId) {
      return jsonResponse({ error: leadError?.message || "Erro ao preparar lead no CRM." }, 500);
    }

    try {
      const crmResult = await invokeCrmSendMessage(req, {
        leadId,
        channelId: channel.id,
        content: `Comprovante da venda #${(body.saleId || "").slice(-6).toUpperCase() || "PDV"}`,
        mediaUrl: signedData.signedUrl,
        mediaType: "application/pdf",
        mediaFilename: "comprovante.pdf",
        receipt_store_id: body.storeId,
      });

      return jsonResponse({ ok: true, crm: crmResult });
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : "Erro ao enviar pelo CRM." }, 502);
    }
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
