/// <reference lib="deno.ns" />
import {
  Gravity,
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from "npm:@imagemagick/magick-wasm@0.0.30";
import { logCRMEvent, sanitizeText } from "./crm.ts";
import {
  buildUazBaseUrl,
  buildUazChatDetailsRequest,
  parseUazChatAvatarUrl,
  parseUazHttpError,
  resolveInstanceToken,
} from "./uazapi.ts";

export type UazLeadAvatarSyncStatus =
  | "synced"
  | "unchanged"
  | "missing"
  | "removed"
  | "expired"
  | "failed"
  | "skipped_cooldown";

export type UazLeadAvatarSyncResult = {
  status: UazLeadAvatarSyncStatus;
  synced: boolean;
  skipped: boolean;
  retriedAfterExpiry: boolean;
  avatarUrl?: string;
  errorCode?: string;
};

type UazLeadAvatarSyncArgs = {
  supabase: any;
  channel: Record<string, unknown>;
  storeId: string;
  leadId: string;
  channelId: string;
  conversationId?: string | null;
  talkId: string | null;
  payloadAvatarUrl: string | null;
  trigger: "inbound_webhook" | "backfill" | "queue";
  force?: boolean;
  now?: Date;
  providerTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  convertToWebp?: (bytes: Uint8Array) => Promise<Uint8Array>;
};

const CRM_AVATAR_BUCKET = "crm-media";
const CRM_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const CRM_AVATAR_FETCH_TIMEOUT_MS = 5_000;
const CRM_AVATAR_CHAT_DETAILS_TIMEOUT_MS = 5_000;
const CRM_AVATAR_MAX_REDIRECTS = 2;
const CRM_AVATAR_MAX_DIMENSION = 320;
const CRM_AVATAR_WEBP_QUALITY = 80;
const CRM_AVATAR_COOLDOWN_MS = 24 * 60 * 60 * 1_000;
const CRM_AVATAR_CONTENT_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

let imageMagickReady: Promise<void> | null = null;

class AvatarDownloadError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
  }
}

const isAllowedAvatarHostname = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  return normalized === "whatsapp.net" || normalized.endsWith(".whatsapp.net") ||
    normalized === "whatsapp.com" || normalized.endsWith(".whatsapp.com") ||
    normalized === "uazapi.com" || normalized.endsWith(".uazapi.com");
};

const assertSafeAvatarUrl = (value: string, redirect = false): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AvatarDownloadError(redirect ? "avatar_unsafe_redirect" : "avatar_unsafe_host");
  }
  if (url.protocol !== "https:" || !isAllowedAvatarHostname(url.hostname)) {
    throw new AvatarDownloadError(redirect ? "avatar_unsafe_redirect" : "avatar_unsafe_host");
  }
  return url;
};

const resolveChannelBaseUrl = (channel: Record<string, unknown>): string => {
  const configured = sanitizeText(channel.api_endpoint);
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, "");
  }
  return buildUazBaseUrl(channel.uaz_subdomain);
};

const ensureImageMagickReady = (): Promise<void> => {
  if (!imageMagickReady) {
    imageMagickReady = (async () => {
      const wasmBytes = await Deno.readFile(
        new URL(
          "magick.wasm",
          import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.30"),
        ),
      );
      await initializeImageMagick(wasmBytes);
    })();
  }
  return imageMagickReady;
};

const isSupportedAvatarContentType = (value: string | null): boolean => {
  const contentType = String(value || "").split(";")[0].trim().toLowerCase();
  return CRM_AVATAR_CONTENT_TYPES.has(contentType);
};

const downloadLeadAvatar = async (
  avatarUrl: string,
  fetchImpl: typeof fetch,
): Promise<Uint8Array> => {
  let currentUrl = assertSafeAvatarUrl(avatarUrl);
  for (let redirectCount = 0; redirectCount <= CRM_AVATAR_MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CRM_AVATAR_FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchImpl(currentUrl.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept:
            "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1",
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new AvatarDownloadError("avatar_download_timeout");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (!location || redirectCount === CRM_AVATAR_MAX_REDIRECTS) {
        throw new AvatarDownloadError("avatar_unsafe_redirect");
      }
      currentUrl = assertSafeAvatarUrl(new URL(location, currentUrl).toString(), true);
      continue;
    }
    if (!response.ok) {
      throw new AvatarDownloadError(`avatar_download_http_${response.status}`, response.status);
    }
    const contentType = response.headers.get("Content-Type");
    if (!isSupportedAvatarContentType(contentType)) {
      throw new AvatarDownloadError("avatar_unsupported_content_type");
    }
    const contentLength = Number(response.headers.get("Content-Length") || "0");
    if (Number.isFinite(contentLength) && contentLength > CRM_AVATAR_MAX_BYTES) {
      throw new AvatarDownloadError("avatar_too_large");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength) throw new AvatarDownloadError("avatar_empty_response");
    if (bytes.byteLength > CRM_AVATAR_MAX_BYTES) {
      throw new AvatarDownloadError("avatar_too_large");
    }
    return bytes;
  }
  throw new AvatarDownloadError("avatar_unsafe_redirect");
};

const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const digestInput = new Uint8Array(bytes.byteLength);
  digestInput.set(bytes);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", digestInput.buffer)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const buildLeadAvatarStoragePath = (
  args: { storeId: string; leadId: string },
): string => {
  const storeSegment = sanitizeStorageSegment(args.storeId, "store");
  const leadHash = fnv1a64Hex(sanitizeText(args.leadId) || "lead");
  return `avatars/${storeSegment}/lead-${leadHash}.webp`;
};

const sanitizeStorageSegment = (value: unknown, fallback: string): string => {
  const segment = (sanitizeText(value) || "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return segment || fallback;
};

const fnv1a64Hex = (value: string): string => {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
};

export const convertLeadAvatarToWebp = async (
  bytes: Uint8Array,
): Promise<Uint8Array> => {
  await ensureImageMagickReady();
  return ImageMagick.read(bytes, (image): Uint8Array => {
    image.autoOrient();
    image.strip();
    const squareSide = Math.min(image.width, image.height);
    if (squareSide > 0) image.crop(squareSide, squareSide, Gravity.Center);
    image.resize(CRM_AVATAR_MAX_DIMENSION, CRM_AVATAR_MAX_DIMENSION);
    image.quality = CRM_AVATAR_WEBP_QUALITY;
    image.format = MagickFormat.WebP;
    const webpBytes = image.write((data) => data);
    const decoder = new TextDecoder();
    if (
      decoder.decode(webpBytes.slice(0, 4)) !== "RIFF" ||
      decoder.decode(webpBytes.slice(8, 12)) !== "WEBP"
    ) {
      throw new Error("avatar_webp_encode_failed");
    }
    return webpBytes;
  });
};

const logAvatarEvent = async (
  args: UazLeadAvatarSyncArgs,
  payload: Record<string, unknown>,
) => {
  await logCRMEvent({
    supabase: args.supabase,
    storeId: args.storeId,
    eventType: "crm_uaz_avatar_sync",
    payload,
    channelId: args.channelId,
    leadId: args.leadId,
    conversationId: args.conversationId || null,
  });
};

export const removeStoredLeadAvatar = async (args: {
  supabase: any;
  storagePath: string | null | undefined;
}): Promise<boolean> => {
  const storagePath = sanitizeText(args.storagePath);
  if (!storagePath || !storagePath.startsWith("avatars/")) return false;
  try {
    const { error } = await args.supabase.storage
      .from(CRM_AVATAR_BUCKET)
      .remove([storagePath]);
    return !error;
  } catch {
    return false;
  }
};

const fetchAvatarFromChatDetails = async (
  args: UazLeadAvatarSyncArgs,
  preview: boolean,
): Promise<string | null> => {
  const token = resolveInstanceToken(args.channel);
  if (!token) throw new Error("uaz_instance_token_missing");
  const request = buildUazChatDetailsRequest({ talkId: args.talkId, preview });
  const controller = new AbortController();
  const timeoutMs = Math.max(1, args.providerTimeoutMs || CRM_AVATAR_CHAT_DETAILS_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await (args.fetchImpl || fetch)(
      `${resolveChannelBaseUrl(args.channel)}${request.endpoint}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", token },
        body: JSON.stringify(request.body),
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("uaz_chat_details_timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      parseUazHttpError("uaz_chat_details_failed", response.status, responseText),
    );
  }
  let body: unknown = {};
  try {
    body = responseText ? JSON.parse(responseText) : {};
  } catch {
    body = {};
  }
  return parseUazChatAvatarUrl(body);
};

const errorCode = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error || "avatar_sync_failed");
  const match = message.match(/(?:uaz_chat_details_(?:failed|timeout)|avatar_[a-z0-9_]+|uaz_instance_token_missing)/i);
  return match?.[0]?.toLowerCase() || "avatar_sync_failed";
};

export const syncUazLeadAvatar = async (
  args: UazLeadAvatarSyncArgs,
): Promise<UazLeadAvatarSyncResult> => {
  const now = args.now || new Date();
  const nowIso = now.toISOString();
  const fetchImpl = args.fetchImpl || fetch;
  let retriedAfterExpiry = false;
  let source = "chat_details_preview";

  try {
    const { data, error } = await args.supabase
      .from("crm_leads")
      .select(
        "avatar_url, avatar_storage_path, avatar_content_hash, avatar_missing_count, avatar_missing_since, avatar_last_checked_at, avatar_refreshed_at",
      )
      .eq("id", args.leadId)
      .eq("store_id", args.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message || "avatar_lead_lookup_failed");

    const lead = (data as Record<string, unknown> | null) || {};
    const storedAvatar = sanitizeText(lead.avatar_url);
    const lastCheckedMs = Date.parse(String(lead.avatar_last_checked_at || ""));
    const isCoolingDown = Number.isFinite(lastCheckedMs) &&
      now.getTime() - lastCheckedMs < CRM_AVATAR_COOLDOWN_MS;
    if (!args.force && isCoolingDown) {
      return {
        status: "skipped_cooldown",
        synced: false,
        skipped: true,
        retriedAfterExpiry: false,
      };
    }

    let avatarUrl = await fetchAvatarFromChatDetails(args, true);

    if (!avatarUrl) {
      const previousMissingCount = Math.max(0, Number(lead.avatar_missing_count) || 0);
      const missingCount = previousMissingCount + 1;
      const missingSince = sanitizeText(lead.avatar_missing_since) || nowIso;
      if (storedAvatar && missingCount >= 2) {
        const storagePath = sanitizeText(lead.avatar_storage_path);
        const { error: updateError } = await args.supabase.from("crm_leads").update({
          avatar_url: null,
          avatar_storage_path: null,
          avatar_content_hash: null,
          avatar_lead_updated: false,
          avatar_last_checked_at: nowIso,
          avatar_missing_count: missingCount,
          avatar_missing_since: missingSince,
          updated_at: nowIso,
        }).eq("id", args.leadId).eq("store_id", args.storeId);
        if (updateError) throw new Error("avatar_lead_update_failed");
        await removeStoredLeadAvatar({ supabase: args.supabase, storagePath });
        await logAvatarEvent(args, {
          status: "removed",
          source,
          trigger: args.trigger,
          retried_after_expiry: false,
        });
        return {
          status: "removed",
          synced: false,
          skipped: false,
          retriedAfterExpiry: false,
        };
      }

      const { error: updateError } = await args.supabase.from("crm_leads").update({
        avatar_last_checked_at: nowIso,
        avatar_missing_count: missingCount,
        avatar_missing_since: missingSince,
        updated_at: nowIso,
      }).eq("id", args.leadId).eq("store_id", args.storeId);
      if (updateError) throw new Error("avatar_lead_update_failed");
      await logAvatarEvent(args, {
        status: "missing",
        source,
        trigger: args.trigger,
        retried_after_expiry: false,
      });
      return {
        status: "missing",
        synced: false,
        skipped: false,
        retriedAfterExpiry: false,
      };
    }

    let sourceBytes: Uint8Array;
    try {
      sourceBytes = await downloadLeadAvatar(avatarUrl, fetchImpl);
    } catch (error) {
      if (!(error instanceof AvatarDownloadError) || ![401, 403, 404].includes(error.status || 0)) {
        throw error;
      }
      retriedAfterExpiry = true;
      await logAvatarEvent(args, {
        status: "expired",
        source,
        trigger: args.trigger,
        retried_after_expiry: true,
      });
      source = "chat_details_full";
      avatarUrl = await fetchAvatarFromChatDetails(args, false);
      if (!avatarUrl) throw new Error("avatar_url_missing_after_expiry");
      sourceBytes = await downloadLeadAvatar(avatarUrl, fetchImpl);
    }

    const webpBytes = await (args.convertToWebp || convertLeadAvatarToWebp)(sourceBytes);
    if (!webpBytes.byteLength) throw new Error("avatar_webp_empty");
    const contentHash = await sha256Hex(webpBytes);
    if (storedAvatar && sanitizeText(lead.avatar_content_hash) === contentHash) {
      const { error: updateError } = await args.supabase.from("crm_leads").update({
        avatar_last_checked_at: nowIso,
        avatar_missing_count: 0,
        avatar_missing_since: null,
        updated_at: nowIso,
      }).eq("id", args.leadId).eq("store_id", args.storeId);
      if (updateError) throw new Error("avatar_lead_update_failed");
      await logAvatarEvent(args, {
        status: "unchanged",
        source,
        trigger: args.trigger,
        retried_after_expiry: retriedAfterExpiry,
      });
      return {
        status: "unchanged",
        synced: false,
        skipped: false,
        retriedAfterExpiry,
        avatarUrl: storedAvatar,
      };
    }
    const storagePath = buildLeadAvatarStoragePath({
      storeId: args.storeId,
      leadId: args.leadId,
    });
    const { error: uploadError } = await args.supabase.storage
      .from(CRM_AVATAR_BUCKET)
      .upload(storagePath, webpBytes, {
        contentType: "image/webp",
        cacheControl: "86400",
        upsert: true,
      });
    if (uploadError) throw new Error(uploadError.message || "avatar_upload_failed");
    const { data: publicUrlData } = args.supabase.storage
      .from(CRM_AVATAR_BUCKET)
      .getPublicUrl(storagePath);
    const publicUrl = sanitizeText(publicUrlData?.publicUrl);
    if (!publicUrl) throw new Error("avatar_public_url_missing");
    const publicAvatarUrl = `${publicUrl}?v=${now.getTime()}`;
    const { error: updateError } = await args.supabase.from("crm_leads").update({
      avatar_url: publicAvatarUrl,
      avatar_storage_path: storagePath,
      avatar_content_hash: contentHash,
      avatar_lead_updated: true,
      avatar_last_checked_at: nowIso,
      avatar_refreshed_at: nowIso,
      avatar_missing_count: 0,
      avatar_missing_since: null,
      updated_at: nowIso,
    }).eq("id", args.leadId).eq("store_id", args.storeId);
    if (updateError) throw new Error(updateError.message || "avatar_lead_update_failed");

    await logAvatarEvent(args, {
      status: "synced",
      source,
      trigger: args.trigger,
      retried_after_expiry: retriedAfterExpiry,
    });
    return {
      status: "synced",
      synced: true,
      skipped: false,
      retriedAfterExpiry,
      avatarUrl: publicAvatarUrl,
    };
  } catch (error) {
    const code = errorCode(error);
    await logAvatarEvent(args, {
      status: "failed",
      source,
      trigger: args.trigger,
      retried_after_expiry: retriedAfterExpiry,
      error_code: code,
    });
    return {
      status: "failed",
      synced: false,
      skipped: false,
      retriedAfterExpiry,
      errorCode: code,
    };
  }
};
