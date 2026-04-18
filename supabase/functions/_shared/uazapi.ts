const UAZ_DEFAULT_SUBDOMAIN = "api";
const UAZ_SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const UAZ_WEBHOOK_DEFAULT_EVENTS = ["messages", "messages_update", "connection"] as const;
export const UAZ_WEBHOOK_DEFAULT_EXCLUDES = ["wasSentByApi"] as const;

type AnyRecord = Record<string, unknown>;

const sanitizeText = (value: unknown): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const normalizePhone = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `+${withCountry}`;
};

const asRecord = (value: unknown): AnyRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AnyRecord;
};

const pickFirstText = (...values: unknown[]): string | null => {
  for (const value of values) {
    const normalized = sanitizeText(value);
    if (normalized) return normalized;
  }
  return null;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

export const buildUazBaseUrl = (subdomain: unknown): string => {
  const raw = String(subdomain ?? "").trim().toLowerCase();
  const resolved = raw || UAZ_DEFAULT_SUBDOMAIN;

  if (!UAZ_SUBDOMAIN_REGEX.test(resolved)) {
    throw new Error("uaz_subdomain inválido.");
  }

  return `https://${resolved}.uazapi.com`;
};

export const resolveInstanceToken = (channel: AnyRecord): string | null =>
  pickFirstText(channel.uaz_instance_token, channel.api_key);

export const resolveAdminToken = (channel: AnyRecord): string | null =>
  pickFirstText(channel.uaz_admin_token);

export const resolveInstanceName = (channel: AnyRecord): string | null =>
  pickFirstText(channel.uaz_instance_name, channel.name);

const resolveFunctionsBaseUrl = (functionsBaseUrl?: string): string => {
  const explicit = sanitizeText(functionsBaseUrl);
  if (explicit) return explicit.replace(/\/$/, "");

  const deno = (globalThis as { Deno?: { env?: { get: (name: string) => string | undefined } } }).Deno;
  const supabaseUrl = deno?.env?.get("SUPABASE_URL") || "";
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL ausente para resolver URL do webhook.");
  }

  return supabaseUrl.replace(".supabase.co", ".functions.supabase.co").replace(/\/$/, "");
};

export const resolveWebhookUrl = (
  channelId: string,
  webhookSecret: string | null = null,
  functionsBaseUrl?: string,
): string => {
  const normalizedChannelId = sanitizeText(channelId);
  if (!normalizedChannelId) throw new Error("channel_id é obrigatório.");

  const url = new URL(`${resolveFunctionsBaseUrl(functionsBaseUrl)}/crm-uaz-webhook-receiver`);
  url.searchParams.set("channel_id", normalizedChannelId);

  const normalizedSecret = sanitizeText(webhookSecret);
  if (normalizedSecret) {
    url.searchParams.set("webhook_secret", normalizedSecret);
  }

  return url.toString();
};

export const toUazNumber = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // Keep chat identifiers (group/newsletter/JID) untouched.
  if (raw.includes("@")) return raw;

  const digits = raw.replace(/\D/g, "");
  return digits || raw;
};

export const parseUazProviderMessageId = (payload: unknown): string | null => {
  const root = asRecord(payload);
  const direct = pickFirstText(
    root.message_id,
    root.messageId,
    root.mid,
    root.id,
  );
  if (direct) return direct;

  const keyId = pickFirstText(
    asRecord(root.key).id,
    asRecord(asRecord(root.message).key).id,
    asRecord(asRecord(root.data).key).id,
    asRecord(asRecord(root.response).key).id,
  );
  if (keyId) return keyId;

  const nested = pickFirstText(
    asRecord(root.data).id,
    asRecord(root.data).message_id,
    asRecord(root.data).messageId,
    asRecord(root.response).id,
    asRecord(root.response).message_id,
    asRecord(root.response).messageId,
  );

  return nested;
};

export const isEchoFromApi = (payload: AnyRecord): boolean => {
  const data = asRecord(payload.data);
  const key = asRecord(payload.key);
  const nestedMessage = asRecord(data.message);
  const nestedKey = asRecord(nestedMessage.key);

  return (
    toBoolean(payload.wasSentByApi) ||
    toBoolean(data.wasSentByApi) ||
    toBoolean(payload.fromMe) ||
    toBoolean(data.fromMe) ||
    toBoolean(key.fromMe) ||
    toBoolean(nestedKey.fromMe) ||
    toBoolean(payload.isFromMe) ||
    toBoolean(data.isFromMe)
  );
};

const normalizeInboundPhoneCandidate = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const jidBase = raw.split("@")[0] || "";
  const normalized = normalizePhone(jidBase || raw);
  if (!normalized) return null;
  return normalized;
};

export const extractInboundPhone = (payload: AnyRecord): string | null => {
  const data = asRecord(payload.data);
  const key = asRecord(payload.key);
  const nestedMessage = asRecord(data.message);
  const nestedKey = asRecord(nestedMessage.key);
  const contact = asRecord(payload.contact);

  return (
    normalizeInboundPhoneCandidate(
      pickFirstText(
        payload.phone,
        payload.from,
        payload.remoteJid,
        payload.sender,
        data.phone,
        data.from,
        data.remoteJid,
        data.sender,
        key.remoteJid,
        nestedKey.remoteJid,
        contact.phone,
        contact.number,
      ),
    )
  );
};

export const extractInboundText = (payload: AnyRecord): string | null => {
  const data = asRecord(payload.data);
  const nestedMessage = asRecord(data.message);
  const extended = asRecord(nestedMessage.extendedTextMessage);
  const imageMessage = asRecord(nestedMessage.imageMessage);
  const videoMessage = asRecord(nestedMessage.videoMessage);
  const documentMessage = asRecord(nestedMessage.documentMessage);
  const reactionMessage = asRecord(nestedMessage.reactionMessage);

  return pickFirstText(
    payload.message,
    payload.text,
    payload.body,
    data.text,
    data.body,
    nestedMessage.conversation,
    extended.text,
    imageMessage.caption,
    videoMessage.caption,
    documentMessage.caption,
    reactionMessage.text,
  );
};

export const extractInboundMessageId = (payload: AnyRecord): string | null => {
  const data = asRecord(payload.data);
  const key = asRecord(payload.key);
  const nestedMessage = asRecord(data.message);
  const nestedKey = asRecord(nestedMessage.key);

  return pickFirstText(
    payload.message_id,
    payload.messageId,
    payload.mid,
    payload.id,
    data.message_id,
    data.messageId,
    data.mid,
    data.id,
    key.id,
    nestedKey.id,
  );
};

export const parseUazConnectionStatus = (payload: unknown): "unknown" | "connecting" | "connected" | "disconnected" | "error" => {
  const root = asRecord(payload);
  const status = asRecord(root.status);
  const instance = asRecord(root.instance);
  const statusValue = pickFirstText(
    status.status,
    status.state,
    instance.status,
    root.status,
    root.state,
  )?.toLowerCase();

  const connected = toBoolean(status.connected ?? root.connected ?? instance.connected);
  const loggedIn = toBoolean(status.loggedIn ?? root.loggedIn ?? instance.loggedIn);

  if (connected || loggedIn) return "connected";
  if (statusValue === "connecting" || statusValue === "open") return "connecting";
  if (statusValue === "error" || statusValue === "failed") return "error";
  if (statusValue === "disconnected" || statusValue === "close" || statusValue === "closed") return "disconnected";

  return "unknown";
};

export const parseUazHttpError = (context: string, status: number, responseText: string): string => {
  const body = String(responseText || "").replace(/\s+/g, " ").trim().slice(0, 240);
  const reason = status === 401
    ? "unauthorized"
    : status === 403
    ? "forbidden"
    : status === 429
    ? "rate_limited"
    : status >= 500
    ? "provider_error"
    : "request_error";

  return `${context}:${status}:${reason}:${body || "no_response_body"}`;
};

export const buildUazMessageActionRequest = (args: {
  action: string;
  messageId: string | null;
  payload?: AnyRecord;
  fallbackNumber?: string | null;
}): { endpoint: string; body: AnyRecord } => {
  const normalizedAction = String(args.action || "").trim().toLowerCase();
  const payload = asRecord(args.payload);
  const messageId = pickFirstText(args.messageId, payload.id, payload.message_id, payload.messageId);

  if (normalizedAction === "delete") {
    if (!messageId) throw new Error("message_id obrigatório para ação delete.");
    return { endpoint: "/message/delete", body: { id: messageId } };
  }

  if (normalizedAction === "edit") {
    if (!messageId) throw new Error("message_id obrigatório para ação edit.");
    const text = pickFirstText(payload.text, payload.message, payload.content);
    if (!text) throw new Error("text obrigatório para ação edit.");
    return { endpoint: "/message/edit", body: { id: messageId, text } };
  }

  if (normalizedAction === "pin") {
    if (!messageId) throw new Error("message_id obrigatório para ação pin.");
    const pin = payload.pin;
    const duration = payload.duration;
    return {
      endpoint: "/message/pin",
      body: {
        id: messageId,
        ...(typeof pin === "boolean" ? { pin } : {}),
        ...(typeof duration === "number" && Number.isFinite(duration) ? { duration } : {}),
      },
    };
  }

  if (normalizedAction === "react") {
    if (!messageId) throw new Error("message_id obrigatório para ação react.");
    const text = pickFirstText(payload.text, payload.reaction, payload.emoji);
    if (!text) throw new Error("text obrigatório para ação react.");

    const number = toUazNumber(pickFirstText(payload.number, args.fallbackNumber));
    if (!number) throw new Error("number obrigatório para ação react.");

    return { endpoint: "/message/react", body: { id: messageId, text, number } };
  }

  throw new Error(`Ação UAZAPI não suportada: ${normalizedAction}`);
};
