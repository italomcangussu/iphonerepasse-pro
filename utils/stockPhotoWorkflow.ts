export const MAX_STOCK_PHOTOS = 10;
export const MAX_DEVICE_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;

export type LocalPhotoSource = 'camera' | 'gallery';
export type LocalPhotoStatus = 'pending' | 'uploading' | 'failed';

export interface LocalPhotoQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  source: LocalPhotoSource;
  status: LocalPhotoStatus;
  error?: string;
  isCover?: boolean;
}

export type UploadBatchOutcome =
  | {
      id: string;
      status: 'fulfilled';
      url: string;
    }
  | {
      id: string;
      status: 'rejected';
      error: string;
    };

export type SaveBlockReason = 'uploading' | 'pending_uploads' | 'failed_uploads' | null;

export const moveItemInArray = <T,>(items: T[], from: number, to: number): T[] => {
  if (from === to) return [...items];
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];

  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const clampFilesToPhotoLimit = (params: {
  uploadedCount: number;
  queuedCount: number;
  incomingFiles: File[];
  maxPhotos?: number;
}) => {
  const maxPhotos = params.maxPhotos ?? MAX_STOCK_PHOTOS;
  const availableSlots = Math.max(0, maxPhotos - (params.uploadedCount + params.queuedCount));
  const acceptedFiles = params.incomingFiles.slice(0, availableSlots);
  const overflowCount = Math.max(0, params.incomingFiles.length - acceptedFiles.length);

  return {
    acceptedFiles,
    overflowCount,
    availableSlots,
  };
};

export const setQueueCover = (queue: LocalPhotoQueueItem[], targetId: string): LocalPhotoQueueItem[] => {
  const targetIndex = queue.findIndex((item) => item.id === targetId);
  if (targetIndex === -1) return queue.map((item) => ({ ...item, isCover: false }));

  const moved = moveItemInArray(queue, targetIndex, 0);
  return moved.map((item, index) => ({ ...item, isCover: index === 0 }));
};

export const ensureSingleCoverInQueue = (
  queue: LocalPhotoQueueItem[],
  fallbackToFirst = false
): LocalPhotoQueueItem[] => {
  const firstMarked = queue.find((item) => item.isCover)?.id;
  const fallback = fallbackToFirst && queue.length > 0 ? queue[0].id : undefined;
  const coverId = firstMarked || fallback;

  return queue.map((item) => ({
    ...item,
    isCover: coverId ? item.id === coverId : false,
  }));
};

export const mergeUploadBatchOutcome = (
  queue: LocalPhotoQueueItem[],
  outcomes: UploadBatchOutcome[]
): {
  uploadedUrls: string[];
  nextQueue: LocalPhotoQueueItem[];
  successCount: number;
  failedCount: number;
} => {
  const byId = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  const uploadedUrls: string[] = [];
  const nextQueue: LocalPhotoQueueItem[] = [];

  for (const item of queue) {
    const outcome = byId.get(item.id);

    if (!outcome) {
      nextQueue.push(item);
      continue;
    }

    if (outcome.status === 'fulfilled') {
      uploadedUrls.push(outcome.url);
      continue;
    }

    nextQueue.push({
      ...item,
      status: 'failed',
      error: outcome.error,
    });
  }

  const successCount = outcomes.filter((item) => item.status === 'fulfilled').length;
  const failedCount = outcomes.length - successCount;

  return {
    uploadedUrls,
    nextQueue,
    successCount,
    failedCount,
  };
};

export const mergeUploadedPhotosWithCover = (
  existingUrls: string[],
  uploadedUrls: string[],
  coverUrl?: string
): string[] => {
  if (!coverUrl || !uploadedUrls.includes(coverUrl)) {
    return [...existingUrls, ...uploadedUrls];
  }

  const uploadedWithoutCover = uploadedUrls.filter((url) => url !== coverUrl);
  const existingWithoutCover = existingUrls.filter((url) => url !== coverUrl);

  return [coverUrl, ...existingWithoutCover, ...uploadedWithoutCover];
};

export const resolveSaveBlockReason = (params: {
  isUploading: boolean;
  hasPendingUploads: boolean;
  hasFailedUploads: boolean;
}): SaveBlockReason => {
  if (params.isUploading) return 'uploading';
  if (params.hasPendingUploads) return 'pending_uploads';
  if (params.hasFailedUploads) return 'failed_uploads';
  return null;
};

const loadImageElement = async (file: File): Promise<HTMLImageElement> => {
  if (typeof Image === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Image API unavailable');
  }

  const objectUrl = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image decode failed'));
    };

    image.src = objectUrl;
  });
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      type,
      quality
    );
  });

const replaceExtension = (name: string, nextExt: string) => {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) return `${name}.${nextExt}`;
  return `${name.slice(0, dotIndex)}.${nextExt}`;
};

/**
 * Detecta HEIC/HEIF — o formato nativo da câmera do iPhone. O `file.type` do
 * iOS às vezes vem vazio ao selecionar de "Arquivos"/iCloud, então caímos para
 * a extensão do nome.
 */
export const isHeicFile = (file: File): boolean => {
  const type = (file.type || '').trim().toLowerCase();
  if (type) return /image\/(heic|heif)/.test(type);
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return extension === 'heic' || extension === 'heif';
};

/**
 * Converte HEIC/HEIF para JPEG no navegador. HEIC não é decodificável por
 * `<canvas>` e não renderiza fora do Safari, então precisa da lib dedicada.
 * O import é dinâmico para não pesar no bundle de quem nunca envia HEIC.
 */
const convertHeicToJpeg = async (file: File, quality: number): Promise<File> => {
  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!blob || blob.size <= 0) {
    throw new Error('HEIC conversion produced empty blob');
  }
  return new File([blob], replaceExtension(file.name, 'jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
};

export const preparePhotoForUpload = async (
  file: File,
  opts: {
    isMobile: boolean;
    maxDimension?: number;
    quality?: number;
    minBytesToCompress?: number;
  }
): Promise<File> => {
  const quality = opts.quality ?? 0.82;

  // HEIC/HEIF (câmera do iPhone) precisa virar JPEG antes de qualquer coisa:
  // não sobe para o storage de forma confiável nem renderiza em navegadores
  // fora do Safari. Convertido, segue o fluxo normal de compressão abaixo.
  let working = file;
  if (isHeicFile(working) && typeof document !== 'undefined') {
    try {
      working = await convertHeicToJpeg(working, quality);
    } catch {
      // Se a conversão falhar, mantém o original — a validação/upload cuidam do erro.
      return working;
    }
  }

  if (!opts.isMobile) return working;

  const imageType = (working.type || '').toLowerCase();
  if (!imageType.startsWith('image/')) return working;
  if (imageType.includes('heic') || imageType.includes('heif')) return working;

  const minBytesToCompress = opts.minBytesToCompress ?? 1_200_000;
  if (working.size < minBytesToCompress) return working;

  if (typeof document === 'undefined') return working;

  const canvas = document.createElement('canvas');
  if (!(canvas instanceof HTMLCanvasElement)) return working;

  const ctx = canvas.getContext('2d');
  if (!ctx) return working;

  const maxDimension = opts.maxDimension ?? 1920;

  try {
    const image = await loadImageElement(working);
    const largestSide = Math.max(image.width, image.height);
    const scale = largestSide > maxDimension ? maxDimension / largestSide : 1;

    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const outputType = imageType.includes('png') || imageType.includes('webp') ? 'image/webp' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, outputType, quality);

    if (!blob || blob.size <= 0 || blob.size >= working.size) {
      return working;
    }

    const extension = outputType === 'image/webp' ? 'webp' : 'jpg';

    return new File([blob], replaceExtension(working.name, extension), {
      type: outputType,
      lastModified: Date.now(),
    });
  } catch {
    return working;
  }
};
