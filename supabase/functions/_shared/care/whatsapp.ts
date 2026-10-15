// Envio WhatsApp do Repasse Care+ direto pela uazapi do canal da loja.
// O código OTP passa por aqui e NÃO por crm-send-message, para nunca ficar gravado em
// crm_messages nem visível a operadores do CRM.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  buildUazBaseUrl,
  buildUazSendMessageRequest,
  parseUazProviderMessageId,
  resolveInstanceToken,
} from "../uazapi.ts";

type ChannelRow = Record<string, unknown> & { id: string; store_id: string | null; uaz_subdomain?: string | null };

export async function resolveWhatsAppChannel(supabase: SupabaseClient, storeId: string | null): Promise<ChannelRow | null> {
  const { data: defaultStoreId } = await supabase.rpc("resolve_crm_default_store_id");
  const storeIds = [storeId, defaultStoreId].filter((v): v is string => typeof v === "string" && v.length > 0);

  if (storeIds.length > 0) {
    const { data } = await supabase
      .from("crm_channels")
      .select("*")
      .eq("provider", "uazapi")
      .eq("is_active", true)
      .eq("is_admin_console", false)
      .in("store_id", storeIds)
      .order("created_at", { ascending: true })
      .limit(1);
    if (data && data.length > 0) return data[0] as ChannelRow;
  }

  const { data: fallback } = await supabase
    .from("crm_channels")
    .select("*")
    .eq("provider", "uazapi")
    .eq("is_active", true)
    .eq("is_admin_console", false)
    .order("created_at", { ascending: true })
    .limit(1);
  return fallback && fallback.length > 0 ? (fallback[0] as ChannelRow) : null;
}

export interface DirectSendResult {
  ok: boolean;
  providerMessageId: string | null;
  error: string | null;
}

export async function sendDirectWhatsApp(
  channel: ChannelRow,
  message: { number: string; text?: string; mediaUrl?: string; mediaType?: string; mediaFilename?: string },
): Promise<DirectSendResult> {
  const token = resolveInstanceToken(channel);
  if (!token) return { ok: false, providerMessageId: null, error: "Canal WhatsApp sem token de instância." };

  const request = buildUazSendMessageRequest({
    number: message.number,
    content: message.text,
    mediaUrl: message.mediaUrl,
    mediaType: message.mediaType,
    mediaFilename: message.mediaFilename,
  });

  try {
    const response = await fetch(`${buildUazBaseUrl(channel.uaz_subdomain)}${request.endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, providerMessageId: null, error: `Provedor WhatsApp respondeu ${response.status}.` };
    }
    return { ok: true, providerMessageId: parseUazProviderMessageId(payload), error: null };
  } catch (error) {
    return { ok: false, providerMessageId: null, error: error instanceof Error ? error.message : "Falha no envio." };
  }
}
