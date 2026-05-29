const MANUAL_HANDOFF_DEDUP_WINDOW_MS = 30_000;
const RAW_INBOUND_MAX_BYTES = 64 * 1024;
const DISPATCH_FETCH_TIMEOUT_MS = 15_000;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function truncateRawInbound(raw: unknown): unknown {
  try {
    const serialized = JSON.stringify(raw);
    if (serialized.length <= RAW_INBOUND_MAX_BYTES) return raw;
    return {
      _truncated: true,
      size_bytes: serialized.length,
      preview: serialized.slice(0, 1024),
    };
  } catch {
    return { _truncated: true, size_bytes: -1, preview: null };
  }
}

function webhookUrlHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function isAiDispatchMediaType(mediaType: string | null | undefined): boolean {
  const normalized = String(mediaType || "").trim().toLowerCase();
  if (!normalized) return false;
  return !(normalized === "text" || normalized === "conversation" || normalized === "chat");
}

async function safeLog(args: {
  supabase: any;
  storeId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  try {
    await args.supabase.from("crm_event_log").insert({
      store_id: args.storeId,
      event_type: args.eventType,
      is_outbound: false,
      processed: true,
      processed_at: new Date().toISOString(),
      payload: args.payload,
    });
  } catch (err) {
    console.warn(`[crm_ai_inbound_dispatch] failed to log ${args.eventType}:`, err);
  }
}

export interface AiInboundDispatchArgs {
  supabase: any;
  conversationId: string;
  storeId: string;
  channelId: string;
  leadId: string;
  messageId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  rawInbound: unknown;
  chatid: string;
  phone: string;
  providerMessageId: string | null;
  messageAt: string;
  isFromMe: boolean;
  senderType: string;
  eventOrigin: string | null;
  instagramUserId?: string | null;
  instagramUsername?: string | null;
}

export async function dispatchAiInboundIfEligible(
  args: AiInboundDispatchArgs,
): Promise<void> {
  const {
    supabase,
    conversationId,
    storeId,
    channelId,
    leadId,
    messageId,
  } = args;

  if (args.isFromMe) return;
  if (args.senderType !== "customer") return;
  if (args.eventOrigin === "reaction") return;

  let webhookUrl = "";
  try {
    const [convResult, channelResult, settingsResult] = await Promise.all([
      supabase
        .from("crm_conversations")
        .select("status, ai_enabled")
        .eq("id", conversationId)
        .maybeSingle(),
      supabase
        .from("crm_channels")
        .select("ai_resume_webhook_url")
        .eq("id", channelId)
        .maybeSingle(),
      supabase
        .from("crm_ai_entry_settings")
        .select("is_enabled")
        .eq("store_id", storeId)
        .maybeSingle(),
    ]);

    const conv = convResult.data as Record<string, unknown> | null;
    const channel = channelResult.data as Record<string, unknown> | null;
    const settings = settingsResult.data as Record<string, unknown> | null;

    if (!conv || conv.status !== "ai_handling" || conv.ai_enabled !== true) return;
    if (!settings || settings.is_enabled !== true) return;

    const rawUrl = String(channel?.ai_resume_webhook_url || "").trim();
    if (!rawUrl || !rawUrl.startsWith("https://")) {
      await safeLog({
        supabase,
        storeId,
        eventType: "crm_ai_inbound_dispatch_skipped",
        payload: {
          conversation_id: conversationId,
          lead_id: leadId,
          channel_id: channelId,
          message_id: messageId,
          reason: "invalid_webhook_url",
        },
      });
      return;
    }
    webhookUrl = rawUrl;
  } catch (err) {
    console.warn("[crm_ai_inbound_dispatch] eligibility check failed:", err);
    return;
  }

  try {
    const windowStart = new Date(Date.now() - MANUAL_HANDOFF_DEDUP_WINDOW_MS).toISOString();
    const { data: recentHandoff } = await supabase
      .from("crm_event_log")
      .select("id")
      .eq("event_type", "crm_manual_handoff_to_ai")
      .eq("store_id", storeId)
      .filter("payload->>conversation_id", "eq", conversationId)
      .gte("created_at", windowStart)
      .limit(1)
      .maybeSingle();

    if ((recentHandoff as Record<string, unknown> | null)?.id) {
      await safeLog({
        supabase,
        storeId,
        eventType: "crm_ai_inbound_dispatch_skipped",
        payload: {
          conversation_id: conversationId,
          lead_id: leadId,
          channel_id: channelId,
          message_id: messageId,
          reason: "recent_manual_handoff",
        },
      });
      return;
    }
  } catch (err) {
    console.warn("[crm_ai_inbound_dispatch] dedup check failed:", err);
  }

  let leadDetail: Record<string, unknown> | null = null;
  let leadDetailError: string | null = null;
  try {
    const { data: leadRow } = await supabase
      .from("crm_leads")
      .select("*")
      .eq("id", leadId)
      .eq("store_id", storeId)
      .maybeSingle();
    leadDetail = (leadRow as Record<string, unknown> | null) || null;
  } catch (err) {
    leadDetailError = err instanceof Error ? err.message : String(err || "lead_detail_fetch_failed");
  }

  const phoneDigits = args.phone.replace(/\D/g, "");
  const chatid = args.chatid || (phoneDigits ? `${phoneDigits}@s.whatsapp.net` : args.phone);
  const hasMedia = Boolean(args.mediaUrl || isAiDispatchMediaType(args.mediaType));
  const senderName = String(leadDetail?.name || "").trim() || "Cliente";
  const messageTimestamp = Date.parse(args.messageAt) || Date.now();

  const triggerPayload: Record<string, unknown> = {
    event: "inbound_message",
    instanceName: String(leadDetail?.entity_id || "").trim() || "crm",
    type: hasMedia ? "media" : "text",
    lead_id: phoneDigits || leadId,
    store_id: storeId,
    body: {
      sender: chatid,
      message: {
        messageTimestamp,
        text: args.content,
        senderName,
        messageid: args.providerMessageId || messageId,
        fromMe: false,
        edited: "",
        owner: "",
        chatid,
        content: args.content,
      },
      BaseUrl: "https://crm.internal/inbound-dispatch",
      EventType: "messages",
      chatid,
      mediaType: args.mediaType || "",
    },
    lead: {
      summary_short: String(leadDetail?.summary_short || ""),
      instagram_user_id: args.instagramUserId ?? null,
      instagram_username: args.instagramUsername ?? null,
    },
    media: {
      URL: args.mediaUrl ?? null,
      mimetype: null,
      mediaKey: null,
    },
    meta: {
      source: "crm_inbound_message",
      conversation_id: conversationId,
      channel_id: channelId,
      message_id: messageId,
      instagram_user_id: args.instagramUserId ?? null,
      instagram_username: args.instagramUsername ?? null,
    },
    raw_inbound: truncateRawInbound(args.rawInbound),
    lead_detail: leadDetail,
    lead_detail_error: leadDetailError,
  };

  let dispatched = false;
  let statusCode: number | null = null;
  let dispatchError: string | null = null;
  let responseBody: string | null = null;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(triggerPayload),
      signal: AbortSignal.timeout(DISPATCH_FETCH_TIMEOUT_MS),
    });
    statusCode = response.status;
    responseBody = (await response.text()).slice(0, 1000);
    dispatched = response.ok;
    if (!response.ok) dispatchError = `HTTP ${response.status}`;
  } catch (err) {
    dispatchError = err instanceof Error ? err.message : String(err || "dispatch_exception");
  }

  await safeLog({
    supabase,
    storeId,
    eventType: "crm_ai_inbound_dispatched",
    payload: {
      conversation_id: conversationId,
      lead_id: leadId,
      channel_id: channelId,
      message_id: messageId,
      store_id: storeId,
      dispatched,
      status_code: statusCode,
      error: dispatchError,
      response_body: responseBody,
      webhook_url_host: webhookUrlHost(webhookUrl),
      event: "inbound_message",
      dispatch_attempted_at: new Date().toISOString(),
    },
  });
}

export const __private__ = {
  isAiDispatchMediaType,
  truncateRawInbound,
  webhookUrlHost,
  asRecord,
};
