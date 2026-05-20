export const MAX_MEDIA_BATCH_ITEMS = 10;
export const MAX_MESSAGE_FILE_SIZE_BYTES = 16 * 1024 * 1024;

export type AttachmentPickerMode = "single" | "media-batch";

export interface AttachmentLike {
  name: string;
  size: number;
  type: string;
}

export interface MediaUploadLike {
  mediaUrl: string;
  mediaType: string;
  mediaFilename?: string;
}

export interface BatchMessagePayload extends MediaUploadLike {
  content: string;
}

export interface EnsurePublicMediaUrlReadyOptions {
  attempts?: number;
  delayMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface AttachmentSelectionResult<T extends AttachmentLike> {
  acceptedFiles: T[];
  rejectedInvalidTypeFiles: T[];
  rejectedOversizeFiles: T[];
  rejectedOverflowFiles: T[];
}

const isBatchMediaFile = (file: AttachmentLike): boolean =>
  file.type.startsWith("image/") || file.type.startsWith("video/");

export function validateAttachmentSelection<T extends AttachmentLike>(params: {
  files: readonly T[];
  mode: AttachmentPickerMode;
  existingMediaCount?: number;
  maxBatchItems?: number;
  maxFileSizeBytes?: number;
}): AttachmentSelectionResult<T> {
  const {
    files,
    mode,
    existingMediaCount = 0,
    maxBatchItems = MAX_MEDIA_BATCH_ITEMS,
    maxFileSizeBytes = MAX_MESSAGE_FILE_SIZE_BYTES,
  } = params;

  const acceptedFiles: T[] = [];
  const rejectedInvalidTypeFiles: T[] = [];
  const rejectedOversizeFiles: T[] = [];
  const rejectedOverflowFiles: T[] = [];
  let currentMediaCount = existingMediaCount;

  files.forEach((file, index) => {
    if (mode === "single" && index > 0) {
      rejectedOverflowFiles.push(file);
      return;
    }

    if (currentMediaCount >= maxBatchItems) {
      rejectedOverflowFiles.push(file);
      return;
    }

    if (file.size > maxFileSizeBytes) {
      rejectedOversizeFiles.push(file);
      return;
    }

    if (mode === "media-batch" && !isBatchMediaFile(file)) {
      rejectedInvalidTypeFiles.push(file);
      return;
    }

    currentMediaCount += 1;
    acceptedFiles.push(file);
  });

  return {
    acceptedFiles,
    rejectedInvalidTypeFiles,
    rejectedOversizeFiles,
    rejectedOverflowFiles,
  };
}

export function buildBatchMessagePayloads(
  uploads: readonly MediaUploadLike[],
  caption: string,
): BatchMessagePayload[] {
  return uploads.map((upload, index) => ({
    content: index === 0 ? caption : "",
    mediaUrl: upload.mediaUrl,
    mediaType: upload.mediaType,
    mediaFilename: upload.mediaFilename,
  }));
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function ensurePublicMediaUrlReady(
  url: string,
  opts: EnsurePublicMediaUrlReadyOptions = {},
): Promise<void> {
  const attempts = opts.attempts ?? 3;
  const delayMs = opts.delayMs ?? 400;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const fetchImpl = opts.fetchImpl ?? fetch;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const response = await fetchImpl(url, {
        method: "GET",
        cache: "no-store",
        signal: controller?.signal,
      });

      const cancelBody = response.body?.cancel();
      if (cancelBody) await cancelBody.catch(() => undefined);

      if (response.ok || response.status === 206) {
        return;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    if (attempt < attempts && delayMs > 0) {
      await wait(delayMs);
    }
  }

  const detail = lastError instanceof Error && lastError.message ? ` (${lastError.message})` : "";
  throw new Error(`A mídia foi enviada, mas ainda não ficou disponível para envio${detail}. Tente novamente.`);
}
