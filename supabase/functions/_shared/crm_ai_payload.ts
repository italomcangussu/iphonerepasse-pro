export type CrmAiMessageRow = {
  id?: string;
  direction?: string | null;
  sender_type?: string | null;
  content?: string | null;
  created_at?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  webhook_payload?: unknown;
  provider_message_id?: string | null;
  event_origin?: string | null;
};

export type CrmAiReplyContextPreviewSource = "db_lookup" | "reply_preview_text" | "missing";

export type CrmAiReplyContext = {
  target_provider_message_id: string;
  target_message_id: string | null;
  target_text: string | null;
  target_direction: string | null;
  target_sender_type: string | null;
  target_created_at: string | null;
  preview_source: CrmAiReplyContextPreviewSource;
};

export type RuntimeEnv = Record<string, string | undefined>;

type FetchLike = typeof fetch;
type AiPayloadEnrichmentOptions = {
  env?: RuntimeEnv;
  fetchImpl?: FetchLike;
  maxChars?: number;
};

type AiPayloadEnrichmentResult = {
  text: string;
  pendingMessageCount: number;
  enrichedMessageCount: number;
  mediaKinds: Array<"audio" | "image" | "media">;
  errors: string[];
};

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_TRANSCRIPTION_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const DEFAULT_OPENROUTER_MODEL = "mistralai/mistral-ocr-latest";
const DEFAULT_GROQ_MODEL = "whisper-large-v3-turbo";
const MAX_SUMMARY_CHARS = 280;
const MAX_TRANSCRIPT_CHARS = 12_000;
const MAX_REPLY_TARGET_TEXT_CHARS = 300;

const clean = (value: unknown): string => String(value ?? "").replace(/\s+/g, " ").trim();
const digits = (value: unknown): string => String(value ?? "").replace(/\D/g, "");

export const readEnv = (): RuntimeEnv => ({
  OPEN_ROUTER_API_KEY: Deno.env.get("OPEN_ROUTER_API_KEY"),
  OPEN_ROUTER_IMAGE_DESCRIPTION_MODEL: Deno.env.get("OPEN_ROUTER_IMAGE_DESCRIPTION_MODEL"),
  OPEN_ROUTER_SUMMARY_MODEL: Deno.env.get("OPEN_ROUTER_SUMMARY_MODEL"),
  GROQ_API_KEY: Deno.env.get("GROQ_API_KEY"),
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
});

export function sanitizeShortMemory(value: unknown): string {
  return clean(value).slice(0, MAX_SUMMARY_CHARS).trim();
}

export function sanitizeReplyContext(value: CrmAiReplyContext | null | undefined): CrmAiReplyContext | null {
  const targetProviderMessageId = clean(value?.target_provider_message_id);
  if (!targetProviderMessageId) return null;

  const source = value?.preview_source === "db_lookup" || value?.preview_source === "reply_preview_text"
    ? value.preview_source
    : "missing";

  return {
    target_provider_message_id: targetProviderMessageId,
    target_message_id: clean(value?.target_message_id) || null,
    target_text: clean(value?.target_text).slice(0, MAX_REPLY_TARGET_TEXT_CHARS).trim() || null,
    target_direction: clean(value?.target_direction) || null,
    target_sender_type: clean(value?.target_sender_type) || null,
    target_created_at: clean(value?.target_created_at) || null,
    preview_source: source,
  };
}

export function isCustomerMessage(message: CrmAiMessageRow): boolean {
  return message.direction === "inbound" && message.sender_type === "customer";
}

export function isHumanMessage(message: CrmAiMessageRow): boolean {
  return message.direction === "outbound" && message.sender_type === "human";
}

export function inferMediaKind(message: CrmAiMessageRow): "audio" | "image" | "media" | null {
  const mediaType = clean(message.media_type).toLowerCase();
  const mediaUrl = clean(message.media_url).split("?")[0].toLowerCase();
  if (mediaType.includes("audio") || /\.(mp3|m4a|ogg|opus|wav|webm)$/.test(mediaUrl)) return "audio";
  if (mediaType.includes("image") || /\.(jpg|jpeg|png|webp|gif)$/.test(mediaUrl)) return "image";
  if (mediaType || mediaUrl) return "media";
  return null;
}

function mediaFallback(kind: "audio" | "image" | "media" | null): string {
  if (kind === "audio") return "Cliente enviou áudio e aguarda continuidade do atendimento.";
  if (kind === "image") return "Cliente enviou imagem e aguarda continuidade do atendimento.";
  if (kind === "media") return "Cliente enviou mídia e aguarda continuidade do atendimento.";
  return "Cliente aguarda continuidade do atendimento.";
}

export function messageTextForAi(message: CrmAiMessageRow): string {
  const content = clean(message.content);
  if (content) return content;
  return mediaFallback(inferMediaKind(message));
}

export function buildTranscript(messages: CrmAiMessageRow[], maxChars = MAX_TRANSCRIPT_CHARS): string {
  return messages
    .filter((message) => isCustomerMessage(message) || isHumanMessage(message))
    .map((message) => {
      const text = messageTextForAi(message);
      if (!text) return "";
      return `${isCustomerMessage(message) ? "CLIENTE" : "ATENDENTE"}: ${text}`;
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, maxChars);
}

export function selectLatestCustomerMessage(messages: CrmAiMessageRow[]): CrmAiMessageRow | null {
  return [...messages]
    .filter(isCustomerMessage)
    .sort((a, b) => {
      const bTime = Date.parse(clean(b.created_at)) || 0;
      const aTime = Date.parse(clean(a.created_at)) || 0;
      return bTime - aTime;
    })[0] ?? null;
}

function customerTextAsSentForHandoff(message: CrmAiMessageRow): string {
  const content = String(message.content ?? "").trim();
  if (content) return content;
  return mediaFallback(inferMediaKind(message));
}

export function pendingCustomerTextForAiHandoff(messages: CrmAiMessageRow[]): string {
  const sorted = messages
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const aTime = Date.parse(clean(a.message.created_at)) || 0;
      const bTime = Date.parse(clean(b.message.created_at)) || 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.index - b.index;
    });

  let pending: string[] = [];
  for (const { message } of sorted) {
    if (String(message.direction || "").trim() === "outbound") {
      pending = [];
      continue;
    }
    if (!isCustomerMessage(message)) continue;
    const text = customerTextAsSentForHandoff(message);
    if (text) pending.push(text);
  }

  return pending.join("\n").trim();
}

const pushUniqueMediaKind = (
  kinds: Array<"audio" | "image" | "media">,
  kind: "audio" | "image" | "media" | null,
) => {
  if (!kind || kinds.includes(kind)) return;
  kinds.push(kind);
};

const safeEnrichmentError = (kind: "audio" | "image" | "media" | null, error: string | null): string | null => {
  const cleanError = clean(error);
  if (!kind || !cleanError) return null;
  return `${kind}:${cleanError}`.slice(0, 240);
};

export async function resolveMessageTextForAi(args: {
  message: CrmAiMessageRow | null;
  env?: RuntimeEnv;
  fetchImpl?: FetchLike;
}): Promise<{ text: string; mediaKind: "audio" | "image" | "media" | null; usedFallback: boolean; error: string | null }> {
  if (!args.message) {
    return { text: mediaFallback(null), mediaKind: null, usedFallback: true, error: "missing_message" };
  }

  const directText = clean(args.message.content);
  const mediaKind = inferMediaKind(args.message);
  if (directText) return { text: directText, mediaKind, usedFallback: false, error: null };

  if (mediaKind === "audio") {
    const result = await transcribeAudioForAi({
      mediaUrl: clean(args.message.media_url),
      mediaType: args.message.media_type,
      env: args.env,
      fetchImpl: args.fetchImpl,
    });
    if (result.text) return { text: result.text, mediaKind, usedFallback: false, error: null };
    return { text: mediaFallback(mediaKind), mediaKind, usedFallback: true, error: result.error || "audio_transcription_empty" };
  }

  if (mediaKind === "image") {
    const result = await describeImageForAi({
      mediaUrl: clean(args.message.media_url),
      mediaType: args.message.media_type,
      env: args.env,
      fetchImpl: args.fetchImpl,
    });
    if (result.text) return { text: `Descrição da imagem enviada: ${result.text}`, mediaKind, usedFallback: false, error: null };
    return { text: mediaFallback(mediaKind), mediaKind, usedFallback: true, error: result.error || "image_description_empty" };
  }

  return { text: mediaFallback(mediaKind), mediaKind, usedFallback: true, error: `${mediaKind || "message"}_fallback` };
}

export async function pendingCustomerTextForAiHandoffEnriched(
  messages: CrmAiMessageRow[],
  options: AiPayloadEnrichmentOptions = {},
): Promise<AiPayloadEnrichmentResult> {
  const sorted = messages
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const aTime = Date.parse(clean(a.message.created_at)) || 0;
      const bTime = Date.parse(clean(b.message.created_at)) || 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.index - b.index;
    });

  const pending: CrmAiMessageRow[] = [];
  for (const { message } of sorted) {
    if (isHumanMessage(message)) {
      pending.length = 0;
      continue;
    }
    if (!isCustomerMessage(message)) continue;
    pending.push(message);
  }

  const texts: string[] = [];
  const mediaKinds: Array<"audio" | "image" | "media"> = [];
  const errors: string[] = [];
  let enrichedMessageCount = 0;

  for (const message of pending) {
    const resolution = await resolveMessageTextForAi({
      message,
      env: options.env,
      fetchImpl: options.fetchImpl,
    });
    pushUniqueMediaKind(mediaKinds, resolution.mediaKind);
    if (resolution.mediaKind && !resolution.usedFallback) enrichedMessageCount += 1;
    const error = safeEnrichmentError(resolution.mediaKind, resolution.error);
    if (error) errors.push(error);
    if (resolution.text) texts.push(resolution.text);
  }

  return {
    text: texts.join("\n").slice(0, options.maxChars ?? MAX_TRANSCRIPT_CHARS).trim(),
    pendingMessageCount: pending.length,
    enrichedMessageCount,
    mediaKinds,
    errors,
  };
}

export async function buildEnrichedTranscript(
  messages: CrmAiMessageRow[],
  options: AiPayloadEnrichmentOptions = {},
): Promise<{ transcript: string; enrichedMessageCount: number; mediaKinds: Array<"audio" | "image" | "media">; errors: string[] }> {
  const lines: string[] = [];
  const mediaKinds: Array<"audio" | "image" | "media"> = [];
  const errors: string[] = [];
  let enrichedMessageCount = 0;

  for (const message of messages.filter((item) => isCustomerMessage(item) || isHumanMessage(item))) {
    let text = "";
    if (isCustomerMessage(message)) {
      const resolution = await resolveMessageTextForAi({
        message,
        env: options.env,
        fetchImpl: options.fetchImpl,
      });
      text = resolution.text;
      pushUniqueMediaKind(mediaKinds, resolution.mediaKind);
      if (resolution.mediaKind && !resolution.usedFallback) enrichedMessageCount += 1;
      const error = safeEnrichmentError(resolution.mediaKind, resolution.error);
      if (error) errors.push(error);
    } else {
      text = messageTextForAi(message);
    }
    if (!text) continue;
    lines.push(`${isCustomerMessage(message) ? "CLIENTE" : "ATENDENTE"}: ${text}`);
  }

  return {
    transcript: lines.join("\n").slice(0, options.maxChars ?? MAX_TRANSCRIPT_CHARS),
    enrichedMessageCount,
    mediaKinds,
    errors,
  };
}

export function normalizeAiLeadId(leadPhone: unknown, fallbackLeadId: unknown): string {
  return digits(leadPhone) || clean(fallbackLeadId);
}

function chatIdFor(leadPhone: string, chatid: string): string {
  const explicit = clean(chatid);
  if (explicit) return explicit;
  const phoneDigits = digits(leadPhone);
  return phoneDigits ? `${phoneDigits}@s.whatsapp.net` : clean(leadPhone);
}

export function buildCompactManualHandoffPayload(args: {
  event: "manual_handoff_to_ai";
  instanceName: string;
  storeId: string;
  leadId: string;
  leadPhone: string;
  chatid: string;
  senderName: string;
  conversationId: string;
  channelId: string;
  reason: string;
  messageText: string;
  lastMessageId?: string | null;
  lastMessageIdAt?: string | null;
  summaryShort: string;
  timestamp: number;
  instagramUserId?: string | null;
  instagramUsername?: string | null;
}) {
  const messageText = clean(args.messageText) || mediaFallback(null);
  const chatid = chatIdFor(args.leadPhone, args.chatid);
  return {
    event: args.event,
    instanceName: clean(args.instanceName) || "crm",
    type: "text",
    lead_id: normalizeAiLeadId(args.leadPhone, args.leadId),
    store_id: args.storeId,
    body: {
      sender: chatid,
      message: {
        messageTimestamp: args.timestamp,
        text: messageText,
        senderName: clean(args.senderName) || "Cliente",
        messageid: `manual-ai-${args.conversationId}-${args.timestamp}`,
        last_messageid: clean(args.lastMessageId) || null,
        last_messageid_at: clean(args.lastMessageIdAt) || null,
        fromMe: false,
        edited: "",
        owner: "",
        chatid,
        content: messageText,
      },
      BaseUrl: "https://crm.internal/manual-handoff",
      EventType: "messages",
      chatid,
      mediaType: "",
    },
    lead: {
      summary_short: sanitizeShortMemory(args.summaryShort),
      instagram_user_id: args.instagramUserId ?? null,
      instagram_username: args.instagramUsername ?? null,
    },
    media: { URL: null, mimetype: null, mediaKey: null },
    meta: {
      source: "crm_manual_handoff",
      conversation_id: args.conversationId,
      channel_id: args.channelId,
      reason: args.reason,
      instagram_user_id: args.instagramUserId ?? null,
      instagram_username: args.instagramUsername ?? null,
    },
  };
}

export function buildCompactAiInboundPayload(args: {
  instanceName: string;
  storeId: string;
  leadId: string;
  leadSummaryShort: string;
  senderName: string;
  chatid: string;
  conversationId: string;
  channelId: string;
  messageId: string;
  providerMessageId: string | null;
  lastMessageId?: string | null;
  lastMessageIdAt?: string | null;
  messageText: string;
  mediaUrl: string | null;
  mediaType: string | null;
  timestamp: number;
  instagramUserId?: string | null;
  instagramUsername?: string | null;
  replyContext?: CrmAiReplyContext | null;
}) {
  const hasMedia = Boolean(clean(args.mediaUrl) || clean(args.mediaType));
  const text = clean(args.messageText);
  const replyContext = sanitizeReplyContext(args.replyContext);
  return {
    event: "inbound_message",
    instanceName: clean(args.instanceName) || "crm",
    type: hasMedia ? "media" : "text",
    lead_id: args.leadId,
    store_id: args.storeId,
    ...(replyContext ? { reply_context: replyContext } : {}),
    body: {
      sender: args.chatid,
      message: {
        messageTimestamp: args.timestamp,
        text,
        senderName: clean(args.senderName) || "Cliente",
        messageid: clean(args.providerMessageId) || args.messageId,
        last_messageid: clean(args.lastMessageId) || null,
        last_messageid_at: clean(args.lastMessageIdAt) || null,
        fromMe: false,
        edited: "",
        owner: "",
        chatid: args.chatid,
        content: text,
      },
      BaseUrl: "https://crm.internal/inbound-dispatch",
      EventType: "messages",
      chatid: args.chatid,
      mediaType: args.mediaType || "",
    },
    lead: {
      summary_short: sanitizeShortMemory(args.leadSummaryShort),
      instagram_user_id: args.instagramUserId ?? null,
      instagram_username: args.instagramUsername ?? null,
    },
    media: { URL: args.mediaUrl ?? null, mimetype: null, mediaKey: null },
    meta: {
      source: "crm_inbound_message",
      conversation_id: args.conversationId,
      channel_id: args.channelId,
      message_id: args.messageId,
      instagram_user_id: args.instagramUserId ?? null,
      instagram_username: args.instagramUsername ?? null,
    },
  };
}

async function downloadBlob(args: {
  mediaUrl: string;
  fetchImpl: FetchLike;
}): Promise<{ blob: Blob | null; error: string | null }> {
  const mediaUrl = clean(args.mediaUrl);
  if (!mediaUrl) return { blob: null, error: "missing_media_url" };
  try {
    const response = await args.fetchImpl(mediaUrl);
    if (!response.ok) return { blob: null, error: `media_download_failed:${response.status}` };
    return { blob: await response.blob(), error: null };
  } catch (error) {
    return { blob: null, error: error instanceof Error ? error.message : "media_download_failed" };
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function parseOpenRouterContent(response: Response): Promise<{ content: string; error: string | null }> {
  const raw = await response.text();
  let payload: any = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const message = clean(payload?.error?.message) || raw.slice(0, 240) || `HTTP ${response.status}`;
    return { content: "", error: message };
  }
  return { content: clean(payload?.choices?.[0]?.message?.content), error: null };
}

export async function transcribeAudioForAi(args: {
  mediaUrl: string;
  mediaType?: string | null;
  env?: RuntimeEnv;
  fetchImpl?: FetchLike;
}): Promise<{ text: string; error: string | null }> {
  const env = args.env ?? readEnv();
  const groqApiKey = clean(env.GROQ_API_KEY);
  if (!groqApiKey) return { text: "", error: "missing_groq_api_key" };

  const fetchImpl = args.fetchImpl ?? fetch;
  const downloaded = await downloadBlob({ mediaUrl: args.mediaUrl, fetchImpl });
  if (!downloaded.blob) return { text: "", error: downloaded.error };

  const payload = new FormData();
  const file = new File([downloaded.blob], "audio.webm", { type: clean(args.mediaType) || downloaded.blob.type || "audio/webm" });
  payload.set("file", file, file.name);
  payload.set("model", DEFAULT_GROQ_MODEL);
  payload.set("language", "pt");
  payload.set("response_format", "verbose_json");

  try {
    const response = await fetchImpl(GROQ_TRANSCRIPTION_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${groqApiKey}` },
      body: payload,
    });
    const raw = await response.text();
    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }
    if (!response.ok) return { text: "", error: clean(data?.error?.message) || raw.slice(0, 240) || `HTTP ${response.status}` };
    return { text: clean(data?.text), error: null };
  } catch (error) {
    return { text: "", error: error instanceof Error ? error.message : "audio_transcription_failed" };
  }
}

export async function describeImageForAi(args: {
  mediaUrl: string;
  mediaType?: string | null;
  env?: RuntimeEnv;
  fetchImpl?: FetchLike;
}): Promise<{ text: string; error: string | null }> {
  const env = args.env ?? readEnv();
  const apiKey = clean(env.OPEN_ROUTER_API_KEY);
  if (!apiKey) return { text: "", error: "missing_open_router_api_key" };

  const fetchImpl = args.fetchImpl ?? fetch;
  const downloaded = await downloadBlob({ mediaUrl: args.mediaUrl, fetchImpl });
  if (!downloaded.blob) return { text: "", error: downloaded.error };

  try {
    const mimeType = clean(args.mediaType) || downloaded.blob.type || "image/jpeg";
    const imageBase64 = arrayBufferToBase64(await downloaded.blob.arrayBuffer());
    const response = await fetchImpl(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": clean(env.SUPABASE_URL) || "https://crm.internal",
        "X-OpenRouter-Title": "CRM AI Image Description",
      },
      body: JSON.stringify({
        model: clean(env.OPEN_ROUTER_IMAGE_DESCRIPTION_MODEL) || DEFAULT_OPENROUTER_MODEL,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: "Você analisa imagens recebidas em atendimentos de CRM. Responda em português brasileiro com até 3 frases curtas. Inclua item principal, estado ou defeito visível se houver, e intenção provável do cliente. Não invente informações.",
            },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        }],
        temperature: 0.2,
        max_tokens: 180,
      }),
    });
    const parsed = await parseOpenRouterContent(response);
    return { text: parsed.content, error: parsed.error };
  } catch (error) {
    return { text: "", error: error instanceof Error ? error.message : "image_description_failed" };
  }
}

export async function resolveLatestCustomerMessageForAi(args: {
  message: CrmAiMessageRow | null;
  env?: RuntimeEnv;
  fetchImpl?: FetchLike;
}): Promise<{ text: string; mediaKind: "audio" | "image" | "media" | null; usedFallback: boolean; error: string | null }> {
  if (!args.message) {
    return { text: mediaFallback(null), mediaKind: null, usedFallback: true, error: "missing_latest_customer_message" };
  }

  const directText = clean(args.message.content);
  const mediaKind = inferMediaKind(args.message);
  if (directText) return { text: directText, mediaKind, usedFallback: false, error: null };

  if (mediaKind === "audio") {
    const result = await transcribeAudioForAi({
      mediaUrl: clean(args.message.media_url),
      mediaType: args.message.media_type,
      env: args.env,
      fetchImpl: args.fetchImpl,
    });
    if (result.text) return { text: result.text, mediaKind, usedFallback: false, error: null };
    return { text: mediaFallback(mediaKind), mediaKind, usedFallback: true, error: result.error || "audio_transcription_empty" };
  }

  if (mediaKind === "image") {
    const result = await describeImageForAi({
      mediaUrl: clean(args.message.media_url),
      mediaType: args.message.media_type,
      env: args.env,
      fetchImpl: args.fetchImpl,
    });
    if (result.text) return { text: `Descrição da imagem enviada: ${result.text}`, mediaKind, usedFallback: false, error: null };
    return { text: mediaFallback(mediaKind), mediaKind, usedFallback: true, error: result.error || "image_description_empty" };
  }

  return { text: mediaFallback(mediaKind), mediaKind, usedFallback: true, error: `${mediaKind || "message"}_fallback` };
}

export async function generateSummaryShort(args: {
  transcript: string;
  latestCustomerText: string;
  env?: RuntimeEnv;
  fetchImpl?: FetchLike;
}): Promise<{ summaryShort: string; usedFallback: boolean; error: string | null }> {
  const fallback = sanitizeShortMemory(args.latestCustomerText || args.transcript || mediaFallback(null));
  const env = args.env ?? readEnv();
  const apiKey = clean(env.OPEN_ROUTER_API_KEY);
  if (!apiKey) return { summaryShort: fallback, usedFallback: true, error: "missing_open_router_api_key" };

  try {
    const response = await (args.fetchImpl ?? fetch)(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": clean(env.SUPABASE_URL) || "https://crm.internal",
        "X-OpenRouter-Title": "CRM AI Short Memory",
      },
      body: JSON.stringify({
        model: clean(env.OPEN_ROUTER_SUMMARY_MODEL) || DEFAULT_OPENROUTER_MODEL,
        messages: [{
          role: "user",
          content: [
            "Você é um assistente que resume atendimentos de CRM.",
            "Responda em português brasileiro, com no máximo 2 frases curtas e tom operacional.",
            "O objetivo é permitir que a IA retome o atendimento humano sem perder contexto.",
            "Não invente informações.",
            "",
            `Última mensagem do cliente: ${clean(args.latestCustomerText) || "sem texto"}`,
            "",
            `Transcript:\n${String(args.transcript || "").slice(0, MAX_TRANSCRIPT_CHARS)}`,
          ].join("\n"),
        }],
        temperature: 0.2,
        max_tokens: 120,
      }),
    });
    const parsed = await parseOpenRouterContent(response);
    const summaryShort = sanitizeShortMemory(parsed.content);
    if (!summaryShort) return { summaryShort: fallback, usedFallback: true, error: parsed.error || "empty_summary" };
    return { summaryShort, usedFallback: false, error: null };
  } catch (error) {
    return { summaryShort: fallback, usedFallback: true, error: error instanceof Error ? error.message : "summary_generation_failed" };
  }
}
