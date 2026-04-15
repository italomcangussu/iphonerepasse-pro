/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  jsonResponse,
  logCRMEvent,
  randomProviderMessageId,
  resolveProvider,
  sanitizeText,
} from "../_shared/crm.ts";

const isWorkerAuthorized = (req: Request): boolean => {
  const expected = String(Deno.env.get("CRM_WORKER_SECRET") || "").trim();
  if (!expected) return true;
  const received = String(req.headers.get("x-worker-secret") || "").trim();
  return received !== "" && received === expected;
};

const markAsFailed = async (supabase: ReturnType<typeof createServiceClient>, scheduledId: string, errorMessage: string, retryCount: number) => {
  const nextRetryCount = retryCount + 1;
  const status = nextRetryCount >= 3 ? "failed" : "pending";
  await supabase
    .from("crm_scheduled_messages")
    .update({
      status,
      retry_count: nextRetryCount,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduledId);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return jsonResponse({ error: "Method not allowed." }, 405);

  if (!isWorkerAuthorized(req)) {
    return jsonResponse({ error: "Unauthorized worker call." }, 401);
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Failed to initialize Supabase." }, 500);
  }

  const nowIso = new Date().toISOString();
  const { data: pendingMessages, error: pendingError } = await supabase
    .from("crm_scheduled_messages")
    .select("id, store_id, lead_id, conversation_id, channel_id, message_content, media_url, media_type, retry_count")
    .in("status", ["pending", "scheduled"])
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(100);

  if (pendingError) return jsonResponse({ error: pendingError.message }, 500);

  const rows = (pendingMessages || []) as Record<string, unknown>[];
  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    processed += 1;
    const scheduledId = String(row.id);
    const storeId = String(row.store_id || "");
    const leadId = sanitizeText(row.lead_id);

    try {
      if (!storeId || !leadId) throw new Error("missing_store_or_lead");

      let conversationId = sanitizeText(row.conversation_id);
      if (!conversationId) {
        const { data: existingConversation, error: existingConversationError } = await supabase
          .from("crm_conversations")
          .select("id")
          .eq("store_id", storeId)
          .eq("lead_id", leadId)
          .maybeSingle();

        if (existingConversationError) throw new Error(existingConversationError.message);

        if (existingConversation?.id) {
          conversationId = String(existingConversation.id);
        } else {
          const { data: createdConversation, error: createConversationError } = await supabase
            .from("crm_conversations")
            .insert({
              store_id: storeId,
              lead_id: leadId,
              status: "open",
              ai_enabled: true,
            })
            .select("id")
            .single();

          if (createConversationError) throw new Error(createConversationError.message);
          conversationId = String(createdConversation.id);
        }
      }

      let channelId = sanitizeText(row.channel_id);
      if (!channelId) {
        const { data: leadChannel, error: leadChannelError } = await supabase
          .from("crm_leads")
          .select("source_channel_id")
          .eq("id", leadId)
          .maybeSingle();

        if (leadChannelError) throw new Error(leadChannelError.message);
        channelId = sanitizeText(leadChannel?.source_channel_id);
      }

      if (!channelId) throw new Error("missing_channel");

      const { data: channel, error: channelError } = await supabase
        .from("crm_channels")
        .select("id, provider, is_active")
        .eq("id", channelId)
        .maybeSingle();

      if (channelError) throw new Error(channelError.message);
      if (!channel) throw new Error("channel_not_found");

      const provider = resolveProvider(channel.provider);
      if (!provider) throw new Error("legacy_provider_not_supported");
      if (!Boolean(channel.is_active)) throw new Error("channel_inactive");

      const content = sanitizeText(row.message_content);
      const mediaUrl = sanitizeText(row.media_url);
      const mediaType = sanitizeText(row.media_type);
      if (!content && !mediaUrl) throw new Error("empty_message_payload");

      const providerMessageId = randomProviderMessageId(provider === "uazapi" ? "uaz_out" : "ig_out");

      const { data: insertedMessage, error: insertedMessageError } = await supabase
        .from("crm_messages")
        .insert({
          conversation_id: conversationId,
          lead_id: leadId,
          store_id: storeId,
          channel_id: channelId,
          direction: "outbound",
          sender_type: "human",
          content,
          media_url: mediaUrl,
          media_type: mediaType,
          provider_message_id: providerMessageId,
          status: "sent",
          sent_at: new Date().toISOString(),
          webhook_payload: { source: "crm_scheduled_messages_worker", scheduled_message_id: scheduledId },
        })
        .select("id")
        .single();

      if (insertedMessageError) throw new Error(insertedMessageError.message);

      const { error: scheduledUpdateError } = await supabase
        .from("crm_scheduled_messages")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          message_id: insertedMessage.id,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", scheduledId);

      if (scheduledUpdateError) throw new Error(scheduledUpdateError.message);

      await logCRMEvent({
        supabase,
        storeId,
        eventType: "crm_scheduled_message_sent",
        payload: {
          scheduled_message_id: scheduledId,
          message_id: insertedMessage.id,
          provider_message_id: providerMessageId,
          provider,
        },
        channelId,
        leadId,
        conversationId,
      });

      sent += 1;
    } catch (error: any) {
      failed += 1;
      const retryCount = Number(row.retry_count || 0);
      const errorMessage = String(error?.message || "worker_send_failed");
      await markAsFailed(supabase, scheduledId, errorMessage, Number.isFinite(retryCount) ? retryCount : 0);

      const storeId = String(row.store_id || "unknown");
      if (storeId !== "unknown") {
        await logCRMEvent({
          supabase,
          storeId,
          eventType: "crm_scheduled_message_failed",
          payload: {
            scheduled_message_id: scheduledId,
            error: errorMessage,
          },
          channelId: sanitizeText(row.channel_id),
          leadId: sanitizeText(row.lead_id),
          conversationId: sanitizeText(row.conversation_id),
        });
      }
    }
  }

  return jsonResponse({ success: true, processed, sent, failed });
});
