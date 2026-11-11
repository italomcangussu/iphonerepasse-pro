import React, { useRef } from 'react';
import { Loader2, Plus, Trash2, Video } from 'lucide-react';
import { MAX_STOCK_VIDEOS, STOCK_VIDEO_ACCEPT } from './stockVideos';

type StockVideoSectionProps = {
  videos: string[];
  pendingCount: number;
  maxSizeMb: number;
  onPickFiles: (files: File[]) => void;
  onRemove: (index: number) => void;
};

const TILE_CLASS = 'aspect-square relative rounded-ios-lg overflow-hidden border border-gray-200 dark:border-surface-dark-300';

const togglePlayback = (video: HTMLVideoElement) => {
  if (video.paused) void video.play().catch(() => {});
  else video.pause();
};

const StockVideoSection: React.FC<StockVideoSectionProps> = ({ videos, pendingCount, maxSizeMb, onPickFiles, onRemove }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const totalCount = videos.length + pendingCount;
  const isLimitReached = totalCount >= MAX_STOCK_VIDEOS;
  const isUploading = pendingCount > 0;
  const isAddDisabled = isUploading || isLimitReached;

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length > 0) onPickFiles(files);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="ios-label flex items-center gap-2 mb-0">
          <Video size={18} /> Vídeos
        </span>
        <span className="text-xs font-medium text-gray-500 dark:text-surface-dark-500">
          {totalCount}/{MAX_STOCK_VIDEOS}
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
        {videos.map((url, index) => (
          <div key={url} className={`${TILE_CLASS} bg-black`}>
            <video
              src={`${url}#t=0.1`}
              className="w-full h-full object-cover cursor-pointer"
              preload="metadata"
              playsInline
              onClick={(event) => togglePlayback(event.currentTarget)}
              aria-label={`Vídeo ${index + 1}. Toque para reproduzir ou pausar`}
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute top-0 right-0 flex h-11 w-11 items-center justify-center"
              aria-label={`Remover vídeo ${index + 1}`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-md ring-2 ring-white/80">
                <Trash2 size={15} />
              </span>
            </button>
          </div>
        ))}

        {Array.from({ length: pendingCount }, (_, index) => (
          <div
            key={`pending-${index}`}
            role="status"
            className={`${TILE_CLASS} flex flex-col items-center justify-center gap-1 bg-gray-100 dark:bg-surface-dark-200 text-gray-500 dark:text-surface-dark-500`}
          >
            <Loader2 size={24} className="animate-spin" />
            <span className="text-xs">Enviando…</span>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isAddDisabled}
          className={`aspect-square rounded-ios-lg border-2 border-dashed border-gray-300 dark:border-surface-dark-300 flex flex-col items-center justify-center transition-colors text-gray-400 ${
            isAddDisabled
              ? 'bg-gray-100 dark:bg-surface-dark-200 cursor-not-allowed'
              : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-dark-200 hover:border-brand-400'
          }`}
        >
          <Plus size={24} className="mb-1" />
          <span className="text-xs">{isLimitReached ? 'Limite' : 'Adicionar vídeo'}</span>
        </button>
      </div>

      <p className="mt-2 text-xs text-gray-500 dark:text-surface-dark-500">
        Até {MAX_STOCK_VIDEOS} vídeos de {maxSizeMb} MB cada. Eles vão junto quando você compartilha o aparelho.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={STOCK_VIDEO_ACCEPT}
        className="hidden"
        data-testid="stock-video-input"
        onChange={handleInputChange}
      />
    </div>
  );
};

export default StockVideoSection;
