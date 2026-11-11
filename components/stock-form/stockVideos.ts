export const MAX_STOCK_VIDEOS = 3;
export const STOCK_VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm';

const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'webm']);

export type VideoSelection = {
  accepted: File[];
  notVideoCount: number;
  tooLargeCount: number;
  overLimitCount: number;
};

export type SelectVideosInput = {
  files: File[];
  currentCount: number;
  maxBytes: number;
  maxVideos?: number;
};

const isVideoFile = (file: File): boolean => {
  if (file.type) return file.type.startsWith('video/');
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return VIDEO_EXTENSIONS.has(extension);
};

/** Separa os vídeos que cabem (formato, tamanho e vagas) dos recusados, contando cada motivo. */
export const selectVideosToUpload = ({
  files,
  currentCount,
  maxBytes,
  maxVideos = MAX_STOCK_VIDEOS
}: SelectVideosInput): VideoSelection => {
  const videoFiles = files.filter(isVideoFile);
  const withinSize = videoFiles.filter((file) => file.size <= maxBytes);
  const availableSlots = Math.max(0, maxVideos - currentCount);
  const accepted = withinSize.slice(0, availableSlots);

  return {
    accepted,
    notVideoCount: files.length - videoFiles.length,
    tooLargeCount: videoFiles.length - withinSize.length,
    overLimitCount: withinSize.length - accepted.length
  };
};

export const describeVideoRejections = (selection: VideoSelection, maxBytes: number): string[] => {
  const maxMb = Math.round(maxBytes / (1024 * 1024));
  const messages: string[] = [];
  if (selection.notVideoCount > 0) messages.push('Só vídeos MP4, MOV ou WebM entram aqui.');
  if (selection.tooLargeCount > 0) messages.push(`Vídeo acima de ${maxMb} MB. Grave um trecho mais curto e tente de novo.`);
  if (selection.overLimitCount > 0) messages.push(`Limite de ${MAX_STOCK_VIDEOS} vídeos por aparelho. Remova um para adicionar outro.`);
  return messages;
};
