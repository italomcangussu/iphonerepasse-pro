import { useCallback, useState } from 'react';
import {
  mergeUploadBatchOutcome,
  type LocalPhotoQueueItem,
  type LocalPhotoSource,
  type UploadBatchOutcome
} from '../../utils/stockPhotoWorkflow';
import { getRemovedPreviewUrls, reducePhotoQueue, type PhotoQueueAction } from './photoQueue';

type UploadImage = (file: File, bucket: string) => Promise<string>;
type PreparePhotoForUpload = (file: File, options: { isMobile: boolean }) => Promise<File>;

export type UseStockPhotoQueueOptions = {
  uploadedCount: number;
  isMobile: boolean;
  createId: (prefix: string) => string;
  createObjectUrl: (file: File) => string;
  revokeObjectUrl: (previewUrl: string) => void;
  uploadImage: UploadImage;
  preparePhotoForUpload: PreparePhotoForUpload;
  onUploadedPhotos?: (uploadedUrls: string[], coverUploadedUrl?: string) => void;
};

export type UploadQueuedPhotosResult = {
  successCount: number;
  failedCount: number;
};

export const useStockPhotoQueue = ({
  uploadedCount,
  isMobile,
  createId,
  createObjectUrl,
  revokeObjectUrl,
  uploadImage,
  preparePhotoForUpload,
  onUploadedPhotos
}: UseStockPhotoQueueOptions) => {
  const [localPhotoQueue, setLocalPhotoQueue] = useState<LocalPhotoQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const dispatchPhotoQueue = useCallback(
    (action: PhotoQueueAction) => {
      setLocalPhotoQueue((prev) => {
        const next = reducePhotoQueue(prev, action);
        getRemovedPreviewUrls(prev, next).forEach((previewUrl) => revokeObjectUrl(previewUrl));
        return next;
      });
    },
    [revokeObjectUrl]
  );

  const clearLocalPhotoQueue = useCallback(() => {
    setLocalPhotoQueue((prev) => {
      prev.forEach((item) => revokeObjectUrl(item.previewUrl));
      return reducePhotoQueue(prev, { type: 'cleared' });
    });
  }, [revokeObjectUrl]);

  const replaceLocalPhotoQueue = useCallback((nextQueue: LocalPhotoQueueItem[]) => {
    setLocalPhotoQueue((prev) => {
      getRemovedPreviewUrls(prev, nextQueue).forEach((previewUrl) => revokeObjectUrl(previewUrl));
      return reducePhotoQueue([], { type: 'added', photos: nextQueue });
    });
  }, [revokeObjectUrl]);

  const addQueuedPhotos = useCallback((files: File[], source: LocalPhotoSource) => {
    setLocalPhotoQueue((prev) => {
      const hasCover = prev.some((item) => item.isCover);
      const shouldCreateCover = !hasCover && uploadedCount === 0;
      const photos: LocalPhotoQueueItem[] = files.map((file, index) => ({
        id: createId('qphoto'),
        file,
        previewUrl: createObjectUrl(file),
        source,
        status: 'pending',
        error: undefined,
        isCover: shouldCreateCover && prev.length === 0 && index === 0
      }));
      return reducePhotoQueue(prev, { type: 'added', photos });
    });
  }, [createId, createObjectUrl, uploadedCount]);

  const removeQueuedPhoto = useCallback((id: string) => {
    dispatchPhotoQueue({ type: 'removed', id });
  }, [dispatchPhotoQueue]);

  const moveQueuedPhoto = useCallback((id: string, direction: -1 | 1) => {
    dispatchPhotoQueue({ type: 'moved', id, direction });
  }, [dispatchPhotoQueue]);

  const setQueuedPhotoAsCover = useCallback((id: string) => {
    dispatchPhotoQueue({ type: 'cover-selected', id });
  }, [dispatchPhotoQueue]);

  const uploadQueuedPhotos = useCallback(async (): Promise<UploadQueuedPhotosResult> => {
    const uploadTargets = localPhotoQueue.filter(
      (item) => item.status === 'pending' || item.status === 'failed'
    );

    if (uploadTargets.length === 0) return { successCount: 0, failedCount: 0 };

    setIsUploading(true);
    dispatchPhotoQueue({ type: 'upload-started', ids: uploadTargets.map((item) => item.id) });

    try {
      const outcomes: UploadBatchOutcome[] = [];

      for (const queueItem of uploadTargets) {
        const preparedFile = await preparePhotoForUpload(queueItem.file, { isMobile });
        try {
          const publicUrl = await uploadImage(preparedFile, 'device-images');
          outcomes.push({ id: queueItem.id, status: 'fulfilled', url: publicUrl });
        } catch (error: any) {
          outcomes.push({
            id: queueItem.id,
            status: 'rejected',
            error: error?.message || 'Falha no upload.'
          });
        }
      }

      const coverCandidateId = uploadTargets.find((item) => item.isCover)?.id;
      const coverUploadedUrl = coverCandidateId
        ? outcomes.find(
            (outcome): outcome is Extract<UploadBatchOutcome, { status: 'fulfilled' }> =>
              outcome.status === 'fulfilled' && outcome.id === coverCandidateId
          )?.url
        : undefined;
      const { uploadedUrls, successCount, failedCount } = mergeUploadBatchOutcome(localPhotoQueue, outcomes);

      dispatchPhotoQueue({ type: 'upload-finished', outcomes });
      if (uploadedUrls.length > 0) {
        onUploadedPhotos?.(uploadedUrls, coverUploadedUrl);
      }

      return { successCount, failedCount };
    } finally {
      setIsUploading(false);
    }
  }, [
    dispatchPhotoQueue,
    isMobile,
    localPhotoQueue,
    onUploadedPhotos,
    preparePhotoForUpload,
    uploadImage
  ]);

  return {
    localPhotoQueue,
    isUploading,
    addQueuedPhotos,
    clearLocalPhotoQueue,
    replaceLocalPhotoQueue,
    removeQueuedPhoto,
    moveQueuedPhoto,
    setQueuedPhotoAsCover,
    uploadQueuedPhotos
  };
};
