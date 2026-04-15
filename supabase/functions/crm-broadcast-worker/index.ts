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

const extractFilters = (filters: unknown): Record<string, unknown> => {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return {};
  return filters as Record<string, unknown>;
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

  const { data: broadcasts, error: broadcastError } = await supabase
    .from("crm_broadcasts")
    .select("id, store_id, channel_id, status, scheduled_for, message_template, recipient_filters")
    .in("status", ["scheduled", "processing"])
    .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
    .order("scheduled_for", { ascending: true, nullsFirst: true })
    .limit(20);

  if (broadcastError) return jsonResponse({ error: broadcastError.message }, 500);

  let broadcastsProcessed = 0;
  let recipientsSent = 0;
  let recipientsFailed = 0;

  for (const broadcast of (broadcasts || [])) {
    broadcastsProcessed += 1;

    const broadcastId = String(broadcast.id);
    const storeId = String(broadcast.store_id);
    const fallbackChannelId = sanitizeText(broadcast.channel_id);
    const messageTemplate = sanitizeText(broadcast.message_template);
    if (!messageTemplate) {
      await supabase
        .from("crm_broadcasts")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", broadcastId);
      continue;
    }

    await supabase
      .from("crm_broadcasts")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", broadcastId);

    const { count: recipientCount } = await supabase
      .from("crm_broadcast_recipients")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", broadcastId);

    if (!recipientCount) {
      const filters = extractFilters(broadcast.recipient_filters);
      const funnelStage = sanitizeText(filters.funnel_stage);
      const isCustomer = typeof filters.is_customer === "boolean" ? Boolean(filters.is_customer) : null;

      let leadsQuery = supabase
        .from("crm_leads")
        .select("id, store_id, source_channel_id")
        .eq("store_id", storeId)
        .limit(500);

      if (funnelStage) leadsQuery = leadsQuery.eq("funnel_stage", funnelStage);
      if (isCustomer !== null) leadsQuery = leadsQuery.eq("is_customer", isCustomer);

      const { data: leads, error: leadsError } = await leadsQuery;
      if (leadsError) {
        await supabase
          .from("crm_broadcasts")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", broadcastId);
        continue;
      }

      const recipientsPayload = (leads || []).map((lead) => ({
        broadcast_id: broadcastId,
        store_id: storeId,
        lead_id: lead.id,
        channel_id: fallbackChannelId || sanitizeText(lead.source_channel_id),
        status: "pending",
      }));

      if (recipientsPayload.length > 0) {
        const { error: insertRecipientsError } = await supabase
          .from("crm_broadcast_recipients")
          .insert(recipientsPayload);

        if (insertRecipientsError) {
          await supabase
            .from("crm_broadcasts")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", broadcastId);
          continue;
        }
      }
    }

    const { data: recipients, error: recipientsError } = await supabase
      .from("crm_broadcast_recipients")
      .select("id, lead_id, conversation_id, channel_id")
      .eq("broadcast_id", broadcastId)
      .eq("status", "pending")
      .limit(200);

    if (recipientsError) {
      await supabase
        .from("crm_broadcasts")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", broadcastId);
      continue;
    }

    for (const recipient of (recipients || [])) {
      const recipientId = String(recipient.id);
      const leadId = sanitizeText(recipient.lead_id);

      try {
        if (!leadId) throw new Error("missing_lead_id");

        let conversationId = sanitizeText(recipient.conversation_id);
        if (!conversationId) {
          const { data: conversation, error: conversationError } = await supabase
            .from("crm_conversations")
            .select("id")
            .eq("store_id", storeId)
            .eq("lead_id", leadId)
            .maybeSingle();

          if (conversationError) throw new Error(conversationError.message);

          if (conversation?.id) {
            conversationId = String(conversation.id);
          } else {
            const { data: createdConversation, error: createConversationError } = await supabase
              .from("crm_conversations")
              .insert({
                store_id: storeId,
                lead_id: leadId,
                channel_id: sanitizeText(recipient.channel_id) || fallbackChannelId,
                status: "open",
                ai_enabled: true,
              })
              .select("id")
              .single();

            if (createConversationError) throw new Error(createConversationError.message);
            conversationId = String(createdConversation.id);
          }
        }

        const channelId = sanitizeText(recipient.channel_id) || fallbackChannelId;
        if (!channelId) throw new Error("missing_channel_id");

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

        const providerMessageId = randomProviderMessageId(provider === "uazapi" ? "uaz_brd" : "ig_brd");

        const { data: insertedMessage, error: insertMessageError } = await supabase
          .from("crm_messages")
          .insert({
            conversation_id: conversationId,
            lead_id: leadId,
            store_id: storeId,
            channel_id: channelId,
            direction: "outbound",
            sender_type: "human",
            content: messageTemplate,
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: providerMessageId,
            webhook_payload: {
              source: "crm_broadcast_worker",
              broadcast_id: broadcastId,
              recipient_id: recipientId,
            },
          })
          .select("id")
          .single();

        if (insertMessageError) throw new Error(insertMessageError.message);

        await supabase
          .from("crm_broadcast_recipients")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: providerMessageId,
            conversation_id: conversationId,
            channel_id: channelId,
            error_message: null,
          })
          .eq("id", recipientId);

        await logCRMEvent({
          supabase,
          storeId,
          eventType: "crm_broadcast_recipient_sent",
          payload: {
            broadcast_id: broadcastId,
            recipient_id: recipientId,
            message_id: insertedMessage.id,
            provider,
          },
          channelId,
          leadId,
          conversationId,
        });

        recipientsSent += 1;
      } catch (error: any) {
        recipientsFailed += 1;
        await supabase
          .from("crm_broadcast_recipients")
          .update({
            status: "failed",
            error_message: String(error?.message || "broadcast_send_failed"),
          })
          .eq("id", recipientId);
      }
    }

    const { count: pendingCount } = await supabase
      .from("crm_broadcast_recipients")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", broadcastId)
      .eq("status", "pending");

    if ((pendingCount || 0) === 0) {
      await supabase
        .from("crm_broadcasts")
        .update({
          status: "completed",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", broadcastId);

      await logCRMEvent({
        supabase,
        storeId,
        eventType: "crm_broadcast_completed",
        payload: {
          broadcast_id: broadcastId,
        },
        channelId: fallbackChannelId,
      });
    }
  }

  return jsonResponse({
    success: true,
    broadcastsProcessed,
    recipientsSent,
    recipientsFailed,
  });
});
