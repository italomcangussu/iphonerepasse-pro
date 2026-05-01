const UAZ_DEFAULT_SUBDOMAIN = "api";
const UAZ_SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const UAZ_WEBHOOK_DEFAULT_EVENTS = ["messages", "messages_update", "messages_updates", "connection"] as const;
export const UAZ_WEBHOOK_DEFAULT_EXCLUDES = ["wasSentByApi"] as const;

type AnyRecord = Record<string, unknown>;

const sanitizeText = (value: unknown): string | null => {
  if (value && typeof value === "object") return null;
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

const hasRecordKeys = (value: AnyRecord): boolean => Object.keys(value).length > 0;

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

const getFileExtension = (value: unknown): string | null => {
  const text = sanitizeText(value);
  if (!text) return null;
  const clean = text.split("?")[0]?.split("#")[0] || "";
  const ext = clean.split(".").pop()?.trim().toLowerCase();
  if (!ext || ext === clean || !/^[a-z0-9]{1,12}$/.test(ext)) return null;
  return ext;
};

const normalizeMime = (value: unknown): string | null => {
  const text = sanitizeText(value)?.toLowerCase();
  if (!text) return null;
  if (text === "image/jpg") return "image/jpeg";
  return text;
};

const inferMediaKind = (mediaType: unknown, fileName?: unknown): "image" | "video" | "audio" | "document" => {
  const normalized = normalizeMime(mediaType) || "";
  const ext = getFileExtension(fileName) || "";

  if (normalized.includes("video") || ["mp4", "mov", "m4v", "webm"].includes(ext)) return "video";
  if (normalized.includes("audio") || ["mp3", "m4a", "ogg", "opus", "wav", "webm"].includes(ext)) return "audio";
  if (
    normalized.includes("document") ||
    normalized.includes("application/") ||
    normalized.includes("pdf") ||
    ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"].includes(ext)
  ) {
    return "document";
  }

  return "image";
};

export const buildUazSendMessageRequest = (args: {
  number: string;
  content?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaFilename?: string | null;
  replyToProviderMessageId?: string | null;
}): { endpoint: "/send/text" | "/send/media"; body: AnyRecord } => {
  const number = toUazNumber(args.number);
  if (!number) throw new Error("number obrigatório para envio UAZAPI.");

  const text = sanitizeText(args.content);
  const mediaUrl = sanitizeText(args.mediaUrl);
  const replyid = sanitizeText(args.replyToProviderMessageId);

  if (!mediaUrl) {
    if (!text) throw new Error("text obrigatório para envio UAZAPI.");
    return {
      endpoint: "/send/text",
      body: {
        number,
        text,
        ...(replyid ? { replyid } : {}),
      },
    };
  }

  const mediaKind = inferMediaKind(args.mediaType, args.mediaFilename || args.mediaUrl);
  const mimetype = normalizeMime(args.mediaType);
  const docName = sanitizeText(args.mediaFilename);

  return {
    endpoint: "/send/media",
    body: {
      number,
      type: mediaKind,
      file: mediaUrl,
      ...(text ? { text } : {}),
      ...(mimetype ? { mimetype } : {}),
      ...(mediaKind === "document" && docName ? { docName } : {}),
      ...(replyid ? { replyid } : {}),
    },
  };
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

export const buildUazWebhookRequest = (
  url: string,
  events: readonly string[] = UAZ_WEBHOOK_DEFAULT_EVENTS,
): AnyRecord => ({
  enabled: true,
  url,
  events: [...events],
  excludeMessages: [...UAZ_WEBHOOK_DEFAULT_EXCLUDES],
  addUrlEvents: false,
  addUrlTypesMessages: false,
});

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
  const rootMessage = asRecord(root.message);
  const direct = pickFirstText(
    root.message_id,
    root.messageId,
    root.mid,
    root.id,
    rootMessage.id,
    rootMessage.messageid,
    rootMessage.message_id,
    rootMessage.messageId,
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

export const extractUazEvent = (payload: AnyRecord): string => {
  const body = asRecord(payload.body);
  const event = pickFirstText(
    payload.event,
    payload.EventType,
    payload.eventType,
    payload.type,
    body.event,
    body.EventType,
    body.eventType,
    body.type,
  );

  return String(event || "").trim().toLowerCase();
};

export const isUazMessageUpdateEvent = (event: unknown): boolean => {
  const normalized = String(event || "").trim().toLowerCase();
  return (
    normalized.includes("messages_update") ||
    normalized.includes("messages_updates") ||
    normalized.includes("messages.update") ||
    normalized.includes("messages.updates") ||
    normalized === "status" ||
    normalized === "message.update" ||
    normalized === "message.updates"
  );
};

export const extractUazPayloadData = (payload: AnyRecord): AnyRecord => {
  const data = asRecord(payload.data);
  if (hasRecordKeys(data)) return data;

  const body = asRecord(payload.body);
  if (hasRecordKeys(body)) {
    const messageRecord = asRecord(body.message);
    if (hasRecordKeys(messageRecord)) {
      return {
        ...body,
        ...messageRecord,
        message: messageRecord,
        type: pickFirstText(payload.type, body.type) || body.type,
      };
    }
    return body;
  }

  return payload;
};

export const isUazFromMe = (payload: AnyRecord): boolean => {
  const data = extractUazPayloadData(payload);
  const key = asRecord(data.key);
  const nestedMessage = asRecord(data.message);
  const nestedKey = asRecord(nestedMessage.key);

  return (
    toBoolean(payload.fromMe) ||
    toBoolean(payload.isFromMe) ||
    toBoolean(data.fromMe) ||
    toBoolean(data.isFromMe) ||
    toBoolean(nestedMessage.fromMe) ||
    toBoolean(nestedMessage.isFromMe) ||
    toBoolean(key.fromMe) ||
    toBoolean(nestedKey.fromMe)
  );
};

export const isUazApiEcho = (payload: AnyRecord): boolean => {
  const data = extractUazPayloadData(payload);
  const nestedMessage = asRecord(data.message);
  return (
    toBoolean(payload.wasSentByApi) ||
    toBoolean(data.wasSentByApi) ||
    toBoolean(nestedMessage.wasSentByApi)
  );
};

export const isEchoFromApi = (payload: AnyRecord): boolean => {
  const data = extractUazPayloadData(payload);
  const key = asRecord(payload.key);
  const dataKey = asRecord(data.key);
  const nestedMessage = asRecord(data.message);
  const nestedKey = asRecord(nestedMessage.key);

  return (
    toBoolean(payload.wasSentByApi) ||
    toBoolean(data.wasSentByApi) ||
    toBoolean(nestedMessage.wasSentByApi) ||
    toBoolean(payload.fromMe) ||
    toBoolean(data.fromMe) ||
    toBoolean(nestedMessage.fromMe) ||
    toBoolean(key.fromMe) ||
    toBoolean(dataKey.fromMe) ||
    toBoolean(nestedKey.fromMe) ||
    toBoolean(payload.isFromMe) ||
    toBoolean(data.isFromMe) ||
    toBoolean(nestedMessage.isFromMe)
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
  const data = extractUazPayloadData(payload);
  const key = asRecord(payload.key);
  const dataKey = asRecord(data.key);
  const nestedMessage = asRecord(data.message);
  const nestedKey = asRecord(nestedMessage.key);
  const contact = asRecord(payload.contact);
  const chat = asRecord(payload.chat || data.chat);

  return (
    normalizeInboundPhoneCandidate(
      pickFirstText(
        payload.phone,
        payload.from,
        payload.remoteJid,
        payload.sender,
        payload.to,
        data.phone,
        data.from,
        data.remoteJid,
        data.sender,
        data.to,
        nestedMessage.sender_pn,
        nestedMessage.senderPn,
        nestedMessage.chatid,
        nestedMessage.chatId,
        nestedMessage.remoteJid,
        nestedMessage.from,
        nestedMessage.sender,
        nestedMessage.to,
        chat.phone,
        chat.wa_chatid,
        chat.wa_chatId,
        chat.chatid,
        chat.chatId,
        key.remoteJid,
        dataKey.remoteJid,
        dataKey.participant,
        nestedKey.remoteJid,
        nestedKey.participant,
        contact.phone,
        contact.number,
      ),
    )
  );
};

export const extractInboundText = (payload: AnyRecord): string | null => {
  const data = extractUazPayloadData(payload);
  const nestedMessage = asRecord(data.message);
  const extended = asRecord(nestedMessage.extendedTextMessage);
  const imageMessage = asRecord(nestedMessage.imageMessage);
  const videoMessage = asRecord(nestedMessage.videoMessage);
  const audioMessage = asRecord(nestedMessage.audioMessage);
  const documentMessage = asRecord(nestedMessage.documentMessage);
  const reactionMessage = asRecord(nestedMessage.reactionMessage);
  const content = asRecord(data.content);
  const nestedContent = asRecord(nestedMessage.content);

  return pickFirstText(
    payload.message,
    payload.text,
    payload.body,
    data.text,
    data.body,
    data.caption,
    data.messageText,
    nestedMessage.text,
    nestedMessage.body,
    nestedMessage.caption,
    nestedMessage.messageText,
    content.text,
    content.body,
    content.caption,
    nestedContent.text,
    nestedContent.body,
    nestedContent.caption,
    nestedMessage.conversation,
    extended.text,
    imageMessage.caption,
    videoMessage.caption,
    audioMessage.caption,
    documentMessage.caption,
    reactionMessage.text,
  );
};

export const extractInboundMessageId = (payload: AnyRecord): string | null => {
  const data = extractUazPayloadData(payload);
  const key = asRecord(payload.key);
  const dataKey = asRecord(data.key);
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
    data.messageid,
    nestedMessage.id,
    nestedMessage.messageid,
    nestedMessage.message_id,
    nestedMessage.messageId,
    nestedMessage.mid,
    key.id,
    dataKey.id,
    nestedKey.id,
  );
};

export const extractUazMedia = (payload: AnyRecord): { mediaUrl: string | null; mediaType: string | null; mediaFilename: string | null } => {
  const data = extractUazPayloadData(payload);
  const nestedMessage = asRecord(data.message);
  const content = asRecord(data.content);
  const imageMessage = asRecord(nestedMessage.imageMessage);
  const videoMessage = asRecord(nestedMessage.videoMessage);
  const audioMessage = asRecord(nestedMessage.audioMessage);
  const documentMessage = asRecord(nestedMessage.documentMessage);
  const stickerMessage = asRecord(nestedMessage.stickerMessage);

  const mediaUrl = pickFirstText(
    payload.mediaUrl,
    payload.media_url,
    payload.file,
    payload.url,
    payload.downloadUrl,
    data.mediaUrl,
    data.media_url,
    data.file,
    data.url,
    data.downloadUrl,
    data.thumbnailUrl,
    content.mediaUrl,
    content.media_url,
    content.file,
    content.url,
    imageMessage.url,
    videoMessage.url,
    audioMessage.url,
    documentMessage.url,
    stickerMessage.url,
  );

  const explicitType = pickFirstText(
    payload.mediaType,
    payload.media_type,
    payload.mimetype,
    data.mediaType,
    data.media_type,
    data.mimetype,
    content.mediaType,
    content.media_type,
    content.mimetype,
    imageMessage.mimetype,
    videoMessage.mimetype,
    audioMessage.mimetype,
    documentMessage.mimetype,
    stickerMessage.mimetype,
  );

  const mediaFilename = pickFirstText(
    payload.mediaFilename,
    payload.fileName,
    payload.filename,
    payload.docName,
    data.mediaFilename,
    data.fileName,
    data.filename,
    data.docName,
    content.fileName,
    content.filename,
    documentMessage.fileName,
  );

  let mediaType = explicitType;
  if (!mediaType) {
    if (hasRecordKeys(imageMessage)) mediaType = "image";
    else if (hasRecordKeys(videoMessage)) mediaType = "video";
    else if (hasRecordKeys(audioMessage)) mediaType = "audio";
    else if (hasRecordKeys(documentMessage)) mediaType = "document";
    else if (hasRecordKeys(stickerMessage)) mediaType = "image";
    else if (mediaUrl) mediaType = inferMediaKind(mediaUrl, mediaFilename || mediaUrl);
  }

  return {
    mediaUrl,
    mediaType,
    mediaFilename,
  };
};

export const extractUazReply = (payload: AnyRecord): { targetMessageId: string | null; previewText: string | null } => {
  const data = extractUazPayloadData(payload);
  const nestedMessage = asRecord(data.message);
  const extended = asRecord(nestedMessage.extendedTextMessage);
  const imageMessage = asRecord(nestedMessage.imageMessage);
  const videoMessage = asRecord(nestedMessage.videoMessage);
  const documentMessage = asRecord(nestedMessage.documentMessage);

  const contextInfo = asRecord(data.contextInfo);
  const nestedContextInfo = asRecord(nestedMessage.contextInfo);
  const extendedContextInfo = asRecord(extended.contextInfo);
  const imageContextInfo = asRecord(imageMessage.contextInfo);
  const videoContextInfo = asRecord(videoMessage.contextInfo);
  const documentContextInfo = asRecord(documentMessage.contextInfo);
  const quotedMessage = asRecord(
    contextInfo.quotedMessage ||
      nestedContextInfo.quotedMessage ||
      extendedContextInfo.quotedMessage ||
      imageContextInfo.quotedMessage ||
      videoContextInfo.quotedMessage ||
      documentContextInfo.quotedMessage,
  );

  return {
    targetMessageId: pickFirstText(
      payload.replyid,
      payload.replyId,
      data.replyid,
      data.replyId,
      contextInfo.stanzaId,
      nestedContextInfo.stanzaId,
      extendedContextInfo.stanzaId,
      imageContextInfo.stanzaId,
      videoContextInfo.stanzaId,
      documentContextInfo.stanzaId,
    ),
    previewText: pickFirstText(
      payload.replyPreviewText,
      payload.reply_preview_text,
      data.replyPreviewText,
      data.reply_preview_text,
      extractInboundText(quotedMessage),
    ),
  };
};

export const extractUazReaction = (payload: AnyRecord): { targetMessageId: string | null; emoji: string | null } => {
  const data = extractUazPayloadData(payload);
  const nestedMessage = asRecord(data.message);
  const reactionMessage = asRecord(nestedMessage.reactionMessage || data.reactionMessage || data.reactMessage);
  const reactionKey = asRecord(reactionMessage.key);

  return {
    targetMessageId: pickFirstText(
      data.reactionTargetProviderMessageId,
      data.reaction_target_provider_message_id,
      data.targetMessageId,
      data.target_message_id,
      reactionKey.id,
      reactionMessage.messageId,
      reactionMessage.message_id,
    ),
    emoji: pickFirstText(
      data.reactionEmoji,
      data.reaction_emoji,
      data.emoji,
      data.reaction,
      reactionMessage.text,
      reactionMessage.emoji,
    ),
  };
};

export const extractUazMessageStatus = (payload: AnyRecord): "pending" | "sent" | "delivered" | "read" | "failed" | null => {
  const data = extractUazPayloadData(payload);
  const raw = pickFirstText(
    payload.status,
    payload.ack,
    data.status,
    data.ack,
    data.messageStatus,
    data.message_status,
  )?.toLowerCase();

  if (!raw) return null;
  if (raw === "pending" || raw === "0") return "pending";
  if (raw === "sent" || raw === "server_ack" || raw === "1") return "sent";
  if (raw === "delivered" || raw === "delivery_ack" || raw === "2") return "delivered";
  if (raw === "read" || raw === "played" || raw === "read_ack" || raw === "3" || raw === "4") return "read";
  if (raw === "failed" || raw === "error" || raw === "-1") return "failed";
  return null;
};

export const isUazDeletedMessageUpdate = (payload: AnyRecord): boolean => {
  const data = extractUazPayloadData(payload);
  const nestedMessage = asRecord(data.message);
  const protocol = asRecord(data.protocolMessage || nestedMessage.protocolMessage);
  const type = pickFirstText(data.type, data.messageType, protocol.type)?.toLowerCase();

  return Boolean(
    toBoolean(data.deleted) ||
      toBoolean(data.revoked) ||
      type === "revoke" ||
      type === "message_revoke" ||
      type === "protocol_message_revoke" ||
      String(type || "").includes("delete"),
  );
};

export const extractUazEditedText = (payload: AnyRecord): string | null => {
  const data = extractUazPayloadData(payload);
  const nestedMessage = asRecord(data.message);
  const protocol = asRecord(data.protocolMessage || nestedMessage.protocolMessage);
  const editedMessage = asRecord(data.editedMessage || protocol.editedMessage);
  if (!hasRecordKeys(editedMessage)) return null;
  return extractInboundText({ data: { message: editedMessage } });
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
