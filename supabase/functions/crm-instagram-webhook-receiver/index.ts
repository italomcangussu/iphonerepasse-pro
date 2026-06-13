/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createServiceClient,
  ensureWebhookSecret,
  jsonResponse,
  logCRMEvent,
  parseJsonBody,
  randomProviderMessageId,
  resolveProvider,
  sanitizeText,
} from "../_shared/crm.ts";
import { dispatchAiInboundIfEligible } from "../_shared/crm_ai_inbound_dispatch.ts";
import { runAutoAIEntryForInbound } from "../_shared/crm_ai_entry_engine.ts";
import {
  compactNotificationText,
  sendCrmPushNotification,
} from "../_shared/crm_push.ts";

type InstagramEntry = Record<string, unknown>;

type InstagramMessageEvent = {
  senderId: string;
  senderUsername: string | null;
  text: string | null;
  providerMessageId: string;
  eventOrigin: "direct" | "story_reply" | "comment" | "referral" | "unknown";
};

const parseMessagingEvent = (event: Record<string, unknown>): InstagramMessageEvent | null => {
  const senderObj = (event.sender && typeof event.sender === "object") ? (event.sender as Record<string, unknown>) : {};
  const senderId = sanitizeText(senderObj.id);
  if (!senderId) return null;

  const messageObj = (event.message && typeof event.message === "object") ? (event.message as Record<string, unknown>) : {};
  const referralObj = (event.referral && typeof event.referral === "object") ? (event.referral as Record<string, unknown>) : {};

  const text = sanitizeText(messageObj.text || event.text);
  const providerMessageId = sanitizeText(messageObj.mid || event.mid || event.id) || randomProviderMessageId("ig_in");
  const senderUsername = sanitizeText(senderObj.username || senderObj.name);

  let eventOrigin: InstagramMessageEvent["eventOrigin"] = "unknown";
  if (sanitizeText(messageObj.is_story_reply) === "true") {
    eventOrigin = "story_reply";
  } else if (sanitizeText(referralObj.source) === "mention") {
    eventOrigin = "comment";
  } else if (Object.keys(referralObj).length > 0) {
    eventOrigin = "referral";
  } else if (Object.keys(messageObj).length > 0 || text) {
    eventOrigin = "direct";
  }

  return {
    senderId,
    senderUsername,
    text,
    providerMessageId,
    eventOrigin,
  };
};

const findChannelByVerifyToken = async (supabase: ReturnType<typeof createServiceClient>, verifyToken: string) => {
  const { data, error } = await supabase
    .from("crm_channels")
    .select("id, store_id, provider, is_active, webhook_secret, instagram_verify_token, instagram_ig_user_id")
    .eq("provider", "instagram_official")
    .eq("instagram_verify_token", verifyToken)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as Record<string, unknown> | null) || null;
};

const findChannelByInstagramAccount = async (supabase: ReturnType<typeof createServiceClient>, igUserId: string) => {
  const { data, error } = await supabase
    .from("crm_channels")
    .select("id, store_id, provider, is_active, webhook_secret, instagram_verify_token, instagram_ig_user_id")
    .eq("provider", "instagram_official")
    .eq("instagram_ig_user_id", igUserId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as Record<string, unknown> | null) || null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Failed to initialize Supabase." }, 500);
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode") || "";
    const verifyToken = url.searchParams.get("hub.verify_token") || "";
    const challenge = url.searchParams.get("hub.challenge") || "";

    if (mode !== "subscribe" || !verifyToken || !challenge) {
      return jsonResponse({ error: "Invalid verification request." }, 400);
    }

    try {
      const channel = await findChannelByVerifyToken(supabase, verifyToken);
      if (!channel) return jsonResponse({ error: "Verify token not found." }, 403);
      return new Response(challenge, { status: 200, headers: corsHeaders });
    } catch (error: any) {
      return jsonResponse({ error: error?.message || "Verification failed." }, 500);
    }
  }

  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const body = await parseJsonBody<Record<string, unknown>>(req);
  if (!body) return jsonResponse({ error: "Invalid JSON body." }, 400);

  const payloadProvider = sanitizeText(body.provider);
  if (payloadProvider && payloadProvider.toLowerCase() !== "instagram_official") {
    return jsonResponse({ error: "provider legado não suportado. Permitido: instagram_official." }, 422);
  }

  const objectType = sanitizeText(body.object) || "";
  if (objectType && objectType.toLowerCase() !== "instagram") {
    return jsonResponse({ success: true, ignored: true, reason: "unsupported_object_type" }, 202);
  }

  const entries = Array.isArray(body.entry) ? (body.entry as InstagramEntry[]) : [];
  if (entries.length === 0) {
    return jsonResponse({ success: true, ignored: true, reason: "no_entries" }, 202);
  }

  let processed = 0;
  for (const entry of entries) {
    const igUserId = sanitizeText(entry.id);
    if (!igUserId) continue;

    let channel: Record<string, unknown> | null = null;
    try {
      channel = await findChannelByInstagramAccount(supabase, igUserId);
    } catch (error: any) {
      return jsonResponse({ error: error?.message || "Erro ao localizar canal Instagram." }, 500);
    }

    if (!channel) {
      await logCRMEvent({
        supabase,
        storeId: "unknown",
        eventType: "crm_instagram_skipped_event",
        payload: { reason: "channel_not_found", ig_user_id: igUserId },
        isOutbound: false,
      });
      continue;
    }

    if (resolveProvider(channel.provider) !== "instagram_official") {
      return jsonResponse({ error: "Canal inválido para webhook Instagram." }, 422);
    }

    try {
      ensureWebhookSecret(String(channel.webhook_secret || ""), req);
    } catch (error: any) {
      return jsonResponse({ error: error?.message || "Invalid webhook secret." }, 401);
    }

    const messagingEvents = Array.isArray(entry.messaging) ? (entry.messaging as Record<string, unknown>[]) : [];
    for (const rawEvent of messagingEvents) {
      const parsed = parseMessagingEvent(rawEvent);
      if (!parsed) continue;

      const { data: leadId, error: upsertLeadError } = await supabase.rpc("crm_upsert_lead_by_identity_rpc", {
        p_store_id: String(channel.store_id),
        p_identity_type: "instagram_igsid",
        p_identity_value: parsed.senderId,
        p_name: parsed.senderUsername,
        p_channel_id: channel.id,
        p_phone: null,
        p_email: null,
        p_contact_id: null,
        p_entity_id: null,
        p_first_message: parsed.text,
        p_utm_source: "instagram_official",
        p_utm_campaign: null,
        p_utm_medium: null,
        p_utm_content: null,
        p_utm_term: null,
        p_intent: null,
      });

      if (upsertLeadError) {
        return jsonResponse({ error: upsertLeadError.message }, 500);
      }

      const resolvedLeadId = String(leadId || "").trim();
      if (!resolvedLeadId) {
        return jsonResponse({ error: "Falha ao resolver lead por identidade Instagram." }, 500);
      }

      if (parsed.senderUsername) {
        await supabase
          .from("crm_lead_identities")
          .upsert({
            lead_id: resolvedLeadId,
            store_id: channel.store_id,
            identity_type: "instagram_username",
            identity_value: parsed.senderUsername,
            is_primary: false,
            metadata: { source: "crm_instagram_webhook" },
          }, { onConflict: "store_id,identity_type,identity_value_normalized" });
      }

      let conversation: Record<string, unknown> | null = null;
      let createdConversationForInbound = false;
      {
        const { data, error } = await supabase
          .from("crm_conversations")
          .select("id, store_id, lead_id, channel_id")
          .eq("store_id", String(channel.store_id))
          .eq("lead_id", resolvedLeadId)
          .maybeSingle();

        if (error) return jsonResponse({ error: error.message }, 500);
        conversation = (data as Record<string, unknown> | null) || null;
      }

      if (!conversation) {
        const { data, error } = await supabase
          .from("crm_conversations")
          .insert({
            store_id: channel.store_id,
            lead_id: resolvedLeadId,
            channel_id: channel.id,
            status: "open",
            ai_enabled: true,
          })
          .select("id, store_id, lead_id, channel_id")
          .single();

        if (error) return jsonResponse({ error: error.message }, 500);
        conversation = data as Record<string, unknown>;
        createdConversationForInbound = true;
      }

      await supabase.rpc("crm_apply_channel_to_conversation", {
        p_conversation_id: conversation.id,
        p_channel_id: channel.id,
        p_changed_by: null,
        p_reason: "crm_instagram_webhook",
      });

      const insertPayload = {
        conversation_id: conversation.id,
        lead_id: resolvedLeadId,
        store_id: channel.store_id,
        channel_id: channel.id,
        direction: "inbound",
        sender_type: "customer",
        content: parsed.text,
        provider_message_id: parsed.providerMessageId,
        status: "sent",
        sent_at: new Date().toISOString(),
        webhook_payload: rawEvent,
        event_origin: parsed.eventOrigin,
      };

      const { data: insertedMessage, error: insertError } = await supabase
        .from("crm_messages")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError && String(insertError.code) !== "23505") {
        return jsonResponse({ error: insertError.message }, 500);
      }

      await logCRMEvent({
        supabase,
        storeId: String(channel.store_id),
        eventType: insertError ? "crm_instagram_deduped" : "crm_instagram_inbound_message",
        payload: {
          provider_message_id: parsed.providerMessageId,
          lead_id: resolvedLeadId,
          conversation_id: conversation.id,
          event_origin: parsed.eventOrigin,
          message_id: insertedMessage?.id || null,
        },
        channelId: String(channel.id),
        leadId: resolvedLeadId,
        conversationId: String(conversation.id),
      });

      if (!insertError && insertedMessage?.id) {
        const displayName = parsed.senderUsername || "Instagram";
        const messagePreview = compactNotificationText(
          parsed.text,
          "Nova mensagem recebida.",
        );
        await sendCrmPushNotification({
          topic: "crm_inbox",
          title: "Nova mensagem CRM",
          body: `${displayName}: ${messagePreview}`,
          conversationId: String(conversation.id),
          leadId: resolvedLeadId,
          storeId: String(channel.store_id),
        });

        if (createdConversationForInbound) {
          await sendCrmPushNotification({
            topic: "new_lead",
            title: "Novo lead no CRM",
            body: compactNotificationText(
              `${displayName}: ${messagePreview}`,
              "Novo lead recebido.",
            ),
            conversationId: String(conversation.id),
            leadId: resolvedLeadId,
            storeId: String(channel.store_id),
          });
        }

        await runAutoAIEntryForInbound({
          supabase,
          conversationId: String(conversation.id),
          storeId: String(channel.store_id),
          channelId: String(channel.id),
          leadId: resolvedLeadId,
          eventOrigin: parsed.eventOrigin,
          isFromMe: false,
          senderType: "customer",
        });

        await dispatchAiInboundIfEligible({
          supabase,
          conversationId: String(conversation.id),
          storeId: String(channel.store_id),
          channelId: String(channel.id),
          leadId: resolvedLeadId,
          messageId: String(insertedMessage.id),
          content: parsed.text || "",
          mediaUrl: null,
          mediaType: null,
          rawInbound: rawEvent,
          chatid: parsed.senderId,
          phone: parsed.senderId,
          providerMessageId: parsed.providerMessageId,
          messageAt: new Date().toISOString(),
          isFromMe: false,
          senderType: "customer",
          eventOrigin: parsed.eventOrigin,
          instagramUserId: parsed.senderId,
          instagramUsername: parsed.senderUsername,
        });
      }

      processed += 1;
    }
  }

  return jsonResponse({ success: true, processed });
});
