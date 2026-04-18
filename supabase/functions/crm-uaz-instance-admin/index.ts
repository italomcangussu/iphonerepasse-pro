/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  parseJsonBody,
  requireAuthenticatedRole,
  resolveProvider,
  sanitizeText,
} from "../_shared/crm.ts";
import {
  UAZ_WEBHOOK_DEFAULT_EVENTS,
  UAZ_WEBHOOK_DEFAULT_EXCLUDES,
  buildUazBaseUrl,
  parseUazConnectionStatus,
  parseUazHttpError,
  resolveAdminToken,
  resolveInstanceName,
  resolveInstanceToken,
  resolveWebhookUrl,
  toUazNumber,
} from "../_shared/uazapi.ts";

type UazAdminBody = {
  action?: string;
  channelId?: string;
  payload?: Record<string, unknown>;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const parseJsonOrText = async (response: Response): Promise<{ text: string; body: unknown }> => {
  const text = await response.text();
  if (!text) return { text, body: {} };
  try {
    return { text, body: JSON.parse(text) };
  } catch {
    return { text, body: text };
  }
};

const resolveWebhookIdFromResponse = (payload: unknown): string | null => {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const id = sanitizeText(asRecord(item).id);
      if (id) return id;
    }
    return null;
  }

  const root = asRecord(payload);
  return sanitizeText(
    root.id ||
      root.webhook_id ||
      asRecord(root.webhook).id ||
      asRecord(root.data).id,
  );
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Failed to initialize Supabase." }, 500);
  }

  try {
    await requireAuthenticatedRole(req, supabase);
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Unauthorized." }, 401);
  }

  const body = await parseJsonBody<UazAdminBody>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const action = String(body.action || "").trim().toLowerCase();
  const channelId = sanitizeText(body.channelId);
  const payload = asRecord(body.payload);

  if (!action) return jsonResponse({ error: "action é obrigatório." }, 400);
  if (!channelId) return jsonResponse({ error: "channelId é obrigatório." }, 400);

  const { data: channel, error: channelError } = await supabase
    .from("crm_channels")
    .select(
      "id, store_id, provider, is_active, name, uaz_subdomain, webhook_secret, uaz_instance_token, uaz_admin_token, uaz_instance_name, uaz_webhook_id, api_key",
    )
    .eq("id", channelId)
    .maybeSingle();

  if (channelError) return jsonResponse({ error: channelError.message }, 500);
  if (!channel) return jsonResponse({ error: "Canal não encontrado." }, 404);
  if (resolveProvider(channel.provider) !== "uazapi") {
    return jsonResponse({ error: "Ação disponível apenas para canais UAZAPI." }, 422);
  }

  const channelRecord = channel as Record<string, unknown>;
  const baseUrl = buildUazBaseUrl(channelRecord.uaz_subdomain);

  const requestUaz = async (args: {
    method: "GET" | "POST";
    path: string;
    tokenHeaderName: "token" | "admintoken";
    tokenValue: string;
    bodyPayload?: Record<string, unknown>;
    errorContext: string;
  }) => {
    const response = await fetch(`${baseUrl}${args.path}`, {
      method: args.method,
      headers: {
        "Content-Type": "application/json",
        [args.tokenHeaderName]: args.tokenValue,
      },
      ...(args.bodyPayload ? { body: JSON.stringify(args.bodyPayload) } : {}),
    });

    const { text, body } = await parseJsonOrText(response);
    if (!response.ok) {
      throw new Error(parseUazHttpError(args.errorContext, response.status, text));
    }
    return { status: response.status, body };
  };

  const updateChannel = async (patch: Record<string, unknown>) => {
    const { data: updated, error: updateError } = await supabase
      .from("crm_channels")
      .update(patch)
      .eq("id", channelId)
      .select("*")
      .single();

    if (updateError) throw new Error(updateError.message);
    return updated;
  };

  try {
    if (action === "create_instance") {
      const adminToken = resolveAdminToken(channelRecord);
      if (!adminToken) return jsonResponse({ error: "uaz_admin_token não configurado." }, 422);

      const instanceName = sanitizeText(payload.instance_name || payload.instanceName) || resolveInstanceName(channelRecord);
      if (!instanceName) return jsonResponse({ error: "Nome da instância é obrigatório." }, 422);

      const systemName = sanitizeText(payload.system_name || payload.systemName);
      const { body: responseBody } = await requestUaz({
        method: "POST",
        path: "/instance/create",
        tokenHeaderName: "admintoken",
        tokenValue: adminToken,
        bodyPayload: {
          name: instanceName,
          ...(systemName ? { systemName } : {}),
        },
        errorContext: "uaz_create_instance_failed",
      });

      const created = asRecord(responseBody);
      const generatedToken = sanitizeText(created.token || asRecord(created.instance).token);
      const updatedChannel = await updateChannel({
        uaz_instance_name: instanceName,
        ...(generatedToken ? { uaz_instance_token: generatedToken } : {}),
        uaz_connection_status: "disconnected",
        uaz_last_status: asRecord(responseBody),
        uaz_last_status_at: new Date().toISOString(),
      });

      return jsonResponse({
        success: true,
        action,
        channel: updatedChannel,
        uaz: responseBody,
      });
    }

    if (action === "connect_instance") {
      const instanceToken = resolveInstanceToken(channelRecord);
      if (!instanceToken) return jsonResponse({ error: "uaz_instance_token não configurado." }, 422);

      const rawPhone = sanitizeText(payload.phone);
      const phone = rawPhone ? String(toUazNumber(rawPhone) || "").replace(/\D/g, "") : null;
      const { body: responseBody } = await requestUaz({
        method: "POST",
        path: "/instance/connect",
        tokenHeaderName: "token",
        tokenValue: instanceToken,
        bodyPayload: phone ? { phone } : {},
        errorContext: "uaz_connect_instance_failed",
      });

      const computedStatus = parseUazConnectionStatus(responseBody);
      const updatedChannel = await updateChannel({
        uaz_connection_status: computedStatus === "unknown" ? "connecting" : computedStatus,
        uaz_last_status: asRecord(responseBody),
        uaz_last_status_at: new Date().toISOString(),
      });

      return jsonResponse({
        success: true,
        action,
        channel: updatedChannel,
        uaz: responseBody,
      });
    }

    if (action === "status_instance") {
      const instanceToken = resolveInstanceToken(channelRecord);
      if (!instanceToken) return jsonResponse({ error: "uaz_instance_token não configurado." }, 422);

      const { body: responseBody } = await requestUaz({
        method: "GET",
        path: "/instance/status",
        tokenHeaderName: "token",
        tokenValue: instanceToken,
        errorContext: "uaz_status_instance_failed",
      });

      const updatedChannel = await updateChannel({
        uaz_connection_status: parseUazConnectionStatus(responseBody),
        uaz_last_status: asRecord(responseBody),
        uaz_last_status_at: new Date().toISOString(),
      });

      return jsonResponse({
        success: true,
        action,
        channel: updatedChannel,
        uaz: responseBody,
      });
    }

    if (action === "get_webhook") {
      const instanceToken = resolveInstanceToken(channelRecord);
      if (!instanceToken) return jsonResponse({ error: "uaz_instance_token não configurado." }, 422);

      const { body: responseBody } = await requestUaz({
        method: "GET",
        path: "/webhook",
        tokenHeaderName: "token",
        tokenValue: instanceToken,
        errorContext: "uaz_get_webhook_failed",
      });

      return jsonResponse({
        success: true,
        action,
        channel,
        uaz: responseBody,
      });
    }

    if (action === "sync_webhook") {
      const instanceToken = resolveInstanceToken(channelRecord);
      if (!instanceToken) return jsonResponse({ error: "uaz_instance_token não configurado." }, 422);

      const events = Array.isArray(payload.events)
        ? (payload.events as unknown[]).map((item) => String(item).trim()).filter(Boolean)
        : [...UAZ_WEBHOOK_DEFAULT_EVENTS];

      const webhookUrl = resolveWebhookUrl(
        String(channelRecord.id),
        sanitizeText(channelRecord.webhook_secret),
      );

      const { body: responseBody } = await requestUaz({
        method: "POST",
        path: "/webhook",
        tokenHeaderName: "token",
        tokenValue: instanceToken,
        bodyPayload: {
          url: webhookUrl,
          events,
          excludeMessages: [...UAZ_WEBHOOK_DEFAULT_EXCLUDES],
          addUrlEvents: false,
          addUrlTypesMessages: false,
        },
        errorContext: "uaz_sync_webhook_failed",
      });

      const webhookId = resolveWebhookIdFromResponse(responseBody);
      const updatedChannel = await updateChannel({
        ...(webhookId ? { uaz_webhook_id: webhookId } : {}),
        uaz_last_status: asRecord(responseBody),
        uaz_last_status_at: new Date().toISOString(),
      });

      return jsonResponse({
        success: true,
        action,
        webhookUrl,
        webhookId,
        channel: updatedChannel,
        uaz: responseBody,
      });
    }

    return jsonResponse({ error: `Ação não suportada: ${action}` }, 400);
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Falha na operação UAZAPI." }, 502);
  }
});
