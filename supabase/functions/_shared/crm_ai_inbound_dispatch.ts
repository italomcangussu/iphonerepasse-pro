const MANUAL_HANDOFF_DEDUP_WINDOW_MS = 30_000;
const RAW_INBOUND_MAX_BYTES = 64 * 1024;
const DISPATCH_FETCH_TIMEOUT_MS = 15_000;

import { buildCompactAiInboundPayload, type CrmAiReplyContext } from "./crm_ai_payload.ts";

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

export async function resolveLastMessageIdForAi(args: {
  supabase: any;
  leadId: string;
  currentMessageId?: string | null;
  currentProviderMessageId?: string | null;
}): Promise<{ id: string; at: string | null } | null> {
  const leadId = compactText(args.leadId);
  if (!leadId) return null;

  const currentMessageId = compactText(args.currentMessageId);
  const currentProviderMessageId = compactText(args.currentProviderMessageId);

  try {
    let query = args.supabase
      .from("crm_messages")
      .select("id,provider_message_id,created_at")
      .eq("lead_id", leadId)
      .not("provider_message_id", "is", null);

    if (currentMessageId) query = query.neq("id", currentMessageId);
    if (currentProviderMessageId) query = query.neq("provider_message_id", currentProviderMessageId);

    const { data } = await query
      .order("created_at", { ascending: false })
      .limit(5);
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    for (const row of rows.map(asRecord)) {
      const providerMessageId = compactText(row.provider_message_id);
      if (providerMessageId) {
        return {
          id: providerMessageId,
          at: compactText(row.created_at),
        };
      }
    }
  } catch (err) {
    console.warn("[crm_ai_inbound_dispatch] last messageid lookup failed:", err);
  }

  return null;
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
  replyToProviderMessageId?: string | null;
  replyPreviewText?: string | null;
}

const compactText = (value: unknown, max = 300): string | null => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max).trim() : null;
};

type ReplyLookupArgs = {
  supabase: any;
  channelId: string;
  conversationId: string;
  replyToProviderMessageId: string | null | undefined;
  replyPreviewText: string | null | undefined;
};

async function lookupReplyTarget(args: ReplyLookupArgs, scope: "channel" | "conversation") {
  const query = args.supabase
    .from("crm_messages")
    .select("id,content,direction,sender_type,created_at")
    .eq("provider_message_id", String(args.replyToProviderMessageId || "").trim())
    .limit(1);

  if (scope === "channel") {
    return await query.eq("channel_id", args.channelId).maybeSingle();
  }

  return await query.eq("conversation_id", args.conversationId).maybeSingle();
}

export async function resolveReplyContextForAi(args: ReplyLookupArgs): Promise<CrmAiReplyContext | null> {
  const targetProviderMessageId = compactText(args.replyToProviderMessageId);
  if (!targetProviderMessageId) return null;

  try {
    const channelResult = await lookupReplyTarget(args, "channel");
    const channelRow = asRecord(channelResult?.data);
    if (channelRow.id) {
      return {
        target_provider_message_id: targetProviderMessageId,
        target_message_id: compactText(channelRow.id),
        target_text: compactText(channelRow.content),
        target_direction: compactText(channelRow.direction),
        target_sender_type: compactText(channelRow.sender_type),
        target_created_at: compactText(channelRow.created_at),
        preview_source: "db_lookup",
      };
    }

    const conversationResult = await lookupReplyTarget(args, "conversation");
    const conversationRow = asRecord(conversationResult?.data);
    if (conversationRow.id) {
      return {
        target_provider_message_id: targetProviderMessageId,
        target_message_id: compactText(conversationRow.id),
        target_text: compactText(conversationRow.content),
        target_direction: compactText(conversationRow.direction),
        target_sender_type: compactText(conversationRow.sender_type),
        target_created_at: compactText(conversationRow.created_at),
        preview_source: "db_lookup",
      };
    }
  } catch (err) {
    console.warn("[crm_ai_inbound_dispatch] reply context lookup failed:", err);
  }

  const previewText = compactText(args.replyPreviewText);
  return {
    target_provider_message_id: targetProviderMessageId,
    target_message_id: null,
    target_text: previewText,
    target_direction: null,
    target_sender_type: null,
    target_created_at: null,
    preview_source: previewText ? "reply_preview_text" : "missing",
  };
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
    const [convResult, channelResult] = await Promise.all([
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
    ]);

    const conv = convResult.data as Record<string, unknown> | null;
    const channel = channelResult.data as Record<string, unknown> | null;

    if (!conv || conv.status !== "ai_handling" || conv.ai_enabled !== true) return;

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
  const lastMessage = await resolveLastMessageIdForAi({
    supabase,
    leadId,
    currentMessageId: messageId,
    currentProviderMessageId: args.providerMessageId,
  });
  const lastMessageId = lastMessage?.id ?? null;
  const lastMessageIdAt = lastMessage?.at ?? null;
  const replyContext = await resolveReplyContextForAi({
    supabase,
    channelId,
    conversationId,
    replyToProviderMessageId: args.replyToProviderMessageId,
    replyPreviewText: args.replyPreviewText,
  });

  const triggerPayload: Record<string, unknown> = {
    ...buildCompactAiInboundPayload({
      instanceName: String(leadDetail?.entity_id || "").trim() || "crm",
      storeId,
      leadId: phoneDigits || leadId,
      leadSummaryShort: String(leadDetail?.summary_short || ""),
      senderName,
      chatid,
      conversationId,
      channelId,
      messageId,
      providerMessageId: args.providerMessageId,
      lastMessageId,
      lastMessageIdAt,
      messageText: args.content,
      mediaUrl: args.mediaUrl,
      mediaType: args.mediaType,
      timestamp: messageTimestamp,
      instagramUserId: args.instagramUserId ?? null,
      instagramUsername: args.instagramUsername ?? null,
      replyContext,
    }),
    raw_inbound: truncateRawInbound(args.rawInbound),
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
      last_messageid: lastMessageId,
      last_messageid_at: lastMessageIdAt,
      store_id: storeId,
      dispatched,
      status_code: statusCode,
      error: dispatchError,
      response_body: responseBody,
      webhook_url_host: webhookUrlHost(webhookUrl),
      event: "inbound_message",
      dispatch_attempted_at: new Date().toISOString(),
      reply_context_source: replyContext?.preview_source ?? null,
      reply_target_provider_message_id: replyContext?.target_provider_message_id ?? null,
    },
  });
}

export const __private__ = {
  isAiDispatchMediaType,
  truncateRawInbound,
  webhookUrlHost,
  asRecord,
};
