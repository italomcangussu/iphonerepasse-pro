/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  logCRMEvent,
  parseJsonBody,
  requireAuthenticatedRole,
  resolveProvider,
  sanitizeText,
} from "../_shared/crm.ts";
import {
  buildUazBaseUrl,
  buildUazDownloadMessageRequest,
  parseUazDownloadedContent,
  parseUazDownloadedMedia,
  parseUazHttpError,
  resolveInstanceToken,
} from "../_shared/uazapi.ts";

type DownloadBody = {
  messageId?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabase = createServiceClient();
  try {
    await requireAuthenticatedRole(req, supabase);
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Unauthorized." }, 401);
  }

  const body = await parseJsonBody<DownloadBody>(req);
  const messageId = sanitizeText(body?.messageId);
  if (!messageId) return jsonResponse({ error: "messageId é obrigatório." }, 400);

  const { data: message, error: messageError } = await supabase
    .from("crm_messages")
    .select("id, store_id, conversation_id, lead_id, channel_id, provider_message_id, media_url, media_type")
    .eq("id", messageId)
    .maybeSingle();

  if (messageError) return jsonResponse({ error: messageError.message }, 500);
  if (!message) return jsonResponse({ error: "Mensagem não encontrada." }, 404);

  const providerMessageId = sanitizeText(message.provider_message_id);
  if (!providerMessageId) return jsonResponse({ error: "Mensagem sem ID do provedor para baixar mídia." }, 422);

  const { data: channel, error: channelError } = await supabase
    .from("crm_channels")
    .select("id, store_id, provider, is_active, uaz_subdomain, uaz_instance_token, api_key")
    .eq("id", String(message.channel_id || ""))
    .maybeSingle();

  if (channelError) return jsonResponse({ error: channelError.message }, 500);
  if (!channel) return jsonResponse({ error: "Canal não encontrado." }, 404);
  if (resolveProvider(channel.provider) !== "uazapi") {
    return jsonResponse({ error: "Download de mídia disponível apenas para canal UAZAPI." }, 422);
  }
  if (!Boolean(channel.is_active)) return jsonResponse({ error: "Canal inativo." }, 409);

  const instanceToken = resolveInstanceToken(channel as Record<string, unknown>);
  if (!instanceToken) return jsonResponse({ error: "uaz_instance_token não configurado no canal." }, 422);

  let downloadRequest: { endpoint: string; body: Record<string, unknown> };
  try {
    downloadRequest = buildUazDownloadMessageRequest({
      messageId: providerMessageId,
      mediaType: sanitizeText(message.media_type),
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Payload inválido para download de mídia." }, 422);
  }

  const endpoint = `${buildUazBaseUrl((channel as Record<string, unknown>).uaz_subdomain)}${downloadRequest.endpoint}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token: instanceToken,
    },
    body: JSON.stringify(downloadRequest.body),
  });

  const responseText = await response.text();
  let responseBody: unknown = responseText;
  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseBody = responseText;
  }

  if (!response.ok) {
    return jsonResponse({ error: parseUazHttpError("uaz_media_download_failed", response.status, responseText) }, 502);
  }

  const downloaded = parseUazDownloadedMedia(responseBody);
  const downloadedContent = parseUazDownloadedContent(responseBody);
  if (!downloaded.mediaUrl && !downloadedContent) {
    return jsonResponse({ error: "UAZAPI não retornou mídia ou texto recuperado." }, 502);
  }

  const nextMediaType = downloaded.mediaType || sanitizeText(message.media_type);
  const patch: Record<string, unknown> = {};
  if (downloaded.mediaUrl) {
    patch.media_url = downloaded.mediaUrl;
    patch.media_type = nextMediaType;
  }
  if (downloadedContent) {
    patch.content = downloadedContent;
  }

  await supabase
    .from("crm_messages")
    .update(patch)
    .eq("id", message.id);

  await logCRMEvent({
    supabase,
    storeId: String(message.store_id || channel.store_id || ""),
    eventType: "crm_uaz_media_downloaded",
    payload: {
      message_id: message.id,
      provider_message_id: providerMessageId,
      previous_media_url: message.media_url,
      media_url: downloaded.mediaUrl,
      media_type: nextMediaType,
      content_recovered: Boolean(downloadedContent),
    },
    channelId: String(channel.id),
    leadId: String(message.lead_id || ""),
    conversationId: String(message.conversation_id || ""),
  });

  return jsonResponse({
    success: true,
    messageId: message.id,
    mediaUrl: downloaded.mediaUrl,
    mediaType: nextMediaType,
    mediaFilename: downloaded.mediaFilename,
    content: downloadedContent,
  });
});
