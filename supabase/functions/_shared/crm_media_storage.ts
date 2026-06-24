const CRM_MEDIA_BUCKET = "crm-media";
const MAX_PROVIDER_MEDIA_BYTES = 50 * 1024 * 1024;

const cleanText = (value: unknown): string | null => {
  if (value && typeof value === "object") return null;
  const text = String(value ?? "").trim();
  return text || null;
};

const normalizeMime = (value: unknown): string | null => {
  const text = cleanText(value)?.toLowerCase();
  if (!text) return null;
  if (text === "image/jpg") return "image/jpeg";
  return text;
};

const extensionFrom = (
  mediaType: string | null,
  filename: string | null,
  mediaUrl: string,
): string => {
  const filenameExt = cleanText(filename)?.split("?")[0]?.split("#")[0]?.split(
    ".",
  ).pop()?.toLowerCase();
  if (filenameExt && /^[a-z0-9]{1,12}$/.test(filenameExt)) return filenameExt;

  const urlExt = cleanText(mediaUrl)?.split("?")[0]?.split("#")[0]?.split(".")
    .pop()?.toLowerCase();
  if (urlExt && /^[a-z0-9]{1,12}$/.test(urlExt)) return urlExt;

  const mime = normalizeMime(mediaType);
  if (mime?.includes("jpeg")) return "jpg";
  if (mime?.includes("png")) return "png";
  if (mime?.includes("webp")) return "webp";
  if (mime?.includes("gif")) return "gif";
  if (mime?.includes("mp4")) return "mp4";
  if (mime?.includes("webm")) return "webm";
  if (mime?.includes("ogg") || mime?.includes("opus")) return "ogg";
  if (mime?.includes("mpeg")) return "mp3";
  if (mime?.includes("pdf")) return "pdf";
  return "bin";
};

export const buildCrmMessageMediaStoragePath = (args: {
  storeId: string;
  conversationId: string;
  messageId: string;
  mediaType?: string | null;
  mediaFilename?: string | null;
  mediaUrl: string;
}): string => {
  const ext = extensionFrom(
    args.mediaType || null,
    args.mediaFilename || null,
    args.mediaUrl,
  );
  return `messages/${encodeURIComponent(args.storeId)}/${
    encodeURIComponent(args.conversationId)
  }/${encodeURIComponent(args.messageId)}.${ext}`;
};

export const persistProviderMediaToCrmStorage = async (args: {
  supabase: any;
  storeId: string;
  conversationId: string;
  messageId: string;
  mediaUrl: string;
  mediaType?: string | null;
  mediaFilename?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<
  { mediaUrl: string; mediaType: string | null; storagePath: string }
> => {
  const mediaUrl = cleanText(args.mediaUrl);
  if (!mediaUrl) throw new Error("media_url obrigatório para persistir mídia.");

  const fetchImpl = args.fetchImpl || fetch;
  const response = await fetchImpl(mediaUrl);
  if (!response.ok) {
    throw new Error(`provider_media_fetch_failed:${response.status}`);
  }

  const contentType = normalizeMime(response.headers.get("content-type")) ||
    normalizeMime(args.mediaType) ||
    "application/octet-stream";
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength === 0) throw new Error("provider_media_empty");
  if (body.byteLength > MAX_PROVIDER_MEDIA_BYTES) {
    throw new Error("provider_media_too_large");
  }

  const storagePath = buildCrmMessageMediaStoragePath({
    storeId: args.storeId,
    conversationId: args.conversationId,
    messageId: args.messageId,
    mediaType: contentType,
    mediaFilename: args.mediaFilename,
    mediaUrl,
  });

  const { error } = await args.supabase.storage
    .from(CRM_MEDIA_BUCKET)
    .upload(storagePath, body, {
      cacheControl: "31536000",
      upsert: true,
      contentType,
    });
  if (error) throw new Error(error.message || "crm_media_upload_failed");

  const { data } = args.supabase.storage.from(CRM_MEDIA_BUCKET).getPublicUrl(
    storagePath,
  );
  const publicUrl = cleanText(data?.publicUrl);
  if (!publicUrl) throw new Error("crm_media_public_url_missing");

  return { mediaUrl: publicUrl, mediaType: contentType, storagePath };
};
