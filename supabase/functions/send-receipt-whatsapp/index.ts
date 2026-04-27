/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  parseJsonBody,
  requireAuthenticatedRole,
} from "../_shared/crm.ts";
import {
  buildUazBaseUrl,
  buildUazSendMessageRequest,
  parseUazHttpError,
  resolveInstanceToken,
} from "../_shared/uazapi.ts";

type RequestBody = {
  phone: string;
  pdfBase64: string;
  storeId: string;
  saleId?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAuthenticatedRole(req);
  } catch {
    return jsonResponse({ error: "Não autorizado." }, 401);
  }

  try {
    const body = await parseJsonBody<RequestBody>(req);

    if (!body?.phone || !body?.pdfBase64 || !body?.storeId) {
      return jsonResponse({ error: "phone, pdfBase64 e storeId são obrigatórios." }, 400);
    }

    const supabase = createServiceClient();

    // Find the first active UazAPI channel for this store
    const { data: channels, error: channelErr } = await supabase
      .from("crm_channels")
      .select("*")
      .eq("store_id", body.storeId)
      .eq("provider", "uazapi")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1);

    if (channelErr || !channels || channels.length === 0) {
      return jsonResponse({ error: "Nenhum canal WhatsApp ativo configurado para esta loja." }, 422);
    }

    const channel = channels[0];
    const instanceToken = resolveInstanceToken(channel);
    if (!instanceToken) {
      return jsonResponse({ error: "Canal WhatsApp sem token configurado." }, 422);
    }

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

    // Send via UazAPI
    const baseUrl = buildUazBaseUrl(channel.uaz_subdomain);
    const request = buildUazSendMessageRequest({
      number: body.phone,
      mediaUrl: signedData.signedUrl,
      mediaType: "application/pdf",
      mediaFilename: "comprovante.pdf",
    });

    const uazRes = await fetch(`${baseUrl}${request.endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: instanceToken,
      },
      body: JSON.stringify(request.body),
    });

    const uazText = await uazRes.text();
    if (!uazRes.ok) {
      return jsonResponse(
        { error: parseUazHttpError("uaz_send_receipt", uazRes.status, uazText) },
        502,
      );
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
