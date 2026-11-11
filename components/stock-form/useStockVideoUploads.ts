import { useCallback, useState } from 'react';

export type VideoUploadResult = { uploadedUrls: string[]; failedCount: number };

type UseStockVideoUploadsOptions = {
  uploadVideo: (file: File) => Promise<string>;
  onUploaded: (url: string) => void;
};

/** Envia os vídeos um a um (arquivos grandes) e entrega cada URL assim que fica pronta. */
export const useStockVideoUploads = ({ uploadVideo, onUploaded }: UseStockVideoUploadsOptions) => {
  const [pendingCount, setPendingCount] = useState(0);

  const uploadVideos = useCallback(async (files: File[]): Promise<VideoUploadResult> => {
    const uploadedUrls: string[] = [];
    setPendingCount((count) => count + files.length);

    for (const file of files) {
      try {
        const url = await uploadVideo(file);
        uploadedUrls.push(url);
        onUploaded(url);
      } catch {
        // contado como falha no resultado
      } finally {
        setPendingCount((count) => count - 1);
      }
    }

    return { uploadedUrls, failedCount: files.length - uploadedUrls.length };
  }, [uploadVideo, onUploaded]);

  return { pendingCount, isUploadingVideos: pendingCount > 0, uploadVideos };
};
