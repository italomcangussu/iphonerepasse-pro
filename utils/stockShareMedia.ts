import { useEffect, useRef, useState } from 'react';
import type { StockItem } from '../types';

export type ShareMediaOptions = { includePhotos: boolean; includeVideos: boolean };

export const fileNameFromUrl = (url: string, fallback: string) => {
  try {
    const path = new URL(url).pathname;
    return path.split('/').pop() || fallback;
  } catch {
    return fallback;
  }
};

export const safeBaseName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'aparelho';

/** Fotos primeiro, vídeos depois: é a ordem em que chegam na conversa. */
export const selectShareMediaUrls = (
  item: Pick<StockItem, 'photos' | 'videos'>,
  options: ShareMediaOptions
): string[] => [
  ...(options.includePhotos ? item.photos : []),
  ...(options.includeVideos ? item.videos ?? [] : [])
];

const extensionFor = (url: string, blob: Blob): string => {
  const name = fileNameFromUrl(url, '');
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex > 0) return name.slice(dotIndex + 1);
  return blob.type.startsWith('video/') ? 'mp4' : 'jpg';
};

const fetchMediaFile = async (url: string, name: string): Promise<File | null> => {
  const response = await fetch(url);
  if (!response.ok) return null;
  const blob = await response.blob();
  return new File([blob], `${name}.${extensionFor(url, blob)}`, { type: blob.type || 'image/jpeg' });
};

/** Baixa cada mídia como arquivo; a que falhar fica de fora em vez de derrubar o envio. */
export const fetchMediaFiles = async (
  urls: string[],
  baseName: string,
  cache: Map<string, File> = new Map()
): Promise<File[]> => {
  const files: File[] = [];
  for (const [index, url] of urls.entries()) {
    const file = cache.get(url) ?? await fetchMediaFile(url, `${baseName}-${index + 1}`).catch(() => null);
    if (!file) continue;
    cache.set(url, file);
    files.push(file);
  }
  return files;
};

/**
 * Deixa os arquivos prontos antes do toque em "Abrir WhatsApp": o navegador só
 * abre a folha de compartilhar logo após um toque, e baixar vídeo depois dele
 * faz esse prazo expirar.
 */
export const usePreparedShareFiles = (urls: string[], baseName: string, enabled: boolean) => {
  const cacheRef = useRef(new Map<string, File>());
  const [prepared, setPrepared] = useState<{ key: string; files: File[] } | null>(null);
  const key = urls.join('|');
  const hasWork = enabled && urls.length > 0;

  useEffect(() => {
    if (!hasWork) return;
    let isCancelled = false;
    void fetchMediaFiles(key.split('|'), baseName, cacheRef.current).then((files) => {
      if (!isCancelled) setPrepared({ key, files });
    });
    return () => {
      isCancelled = true;
    };
  }, [hasWork, key, baseName]);

  const isReady = prepared?.key === key;
  return { files: hasWork && isReady ? prepared.files : [], isPreparing: hasWork && !isReady };
};
