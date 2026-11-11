import { supabase } from './supabase';
import { newId } from '../utils/id';

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

type ImageBucket = 'logos' | 'device-images';
export type StorageBucket = ImageBucket | 'device-videos';

export const MAX_DEVICE_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

const BUCKET_FILE_SIZE_LIMIT: Record<StorageBucket, number> = {
  logos: 5 * 1024 * 1024,
  'device-images': 15 * 1024 * 1024,
  'device-videos': MAX_DEVICE_VIDEO_SIZE_BYTES,
};

const ALLOWED_BUCKET_MIME_TYPES: Record<StorageBucket, Set<string>> = {
  'device-images': new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  logos: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  'device-videos': new Set(['video/mp4', 'video/quicktime', 'video/webm']),
};

const UNSUPPORTED_FORMAT_MESSAGE: Record<StorageBucket, string> = {
  logos: 'Formato de imagem não suportado para este upload.',
  'device-images': 'Formato de imagem não suportado para este upload.',
  'device-videos': 'Formato de vídeo não suportado. Use MP4, MOV ou WebM.',
};

const EXTENSION_BY_MIME_FRAGMENT: Array<[fragment: string, extension: string]> = [
  ['png', 'png'],
  ['webp', 'webp'],
  ['heic', 'heic'],
  ['heif', 'heif'],
  ['svg', 'svg'],
  ['quicktime', 'mov'],
  ['webm', 'webm'],
  ['video/', 'mp4'],
];

const resolveExtension = (file: File) => {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/i.test(fromName)) return fromName;

  const match = EXTENSION_BY_MIME_FRAGMENT.find(([fragment]) => file.type.includes(fragment));
  return match ? match[1] : 'jpg';
};

const normalizeMimeType = (file: File, fileExt: string) => {
  const raw = (file.type || '').trim().toLowerCase();
  if (raw) {
    if (raw === 'image/jpg') return 'image/jpeg';
    return raw;
  }
  return MIME_BY_EXTENSION[fileExt] || 'image/jpeg';
};

const uploadToBucket = async (file: File, bucket: StorageBucket): Promise<string> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente para enviar arquivos.');
  }

  const fileExt = resolveExtension(file);
  const contentType = normalizeMimeType(file, fileExt);
  const maxFileSize = BUCKET_FILE_SIZE_LIMIT[bucket];
  const allowedMimeTypes = ALLOWED_BUCKET_MIME_TYPES[bucket];

  if (file.size > maxFileSize) {
    throw new Error(`Arquivo acima do limite de ${(maxFileSize / (1024 * 1024)).toFixed(0)} MB para este upload.`);
  }

  if (!allowedMimeTypes.has(contentType)) {
    throw new Error(UNSUPPORTED_FORMAT_MESSAGE[bucket]);
  }

  const filePath = `${newId(bucket === 'device-videos' ? 'vid' : 'img')}.${fileExt}`;

  const { data: uploaded, error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Falha ao enviar o arquivo para o storage.');
  }

  const uploadedPath = uploaded?.path || filePath;
  const { data } = supabase.storage.from(bucket).getPublicUrl(uploadedPath);
  if (!data?.publicUrl) {
    throw new Error('Upload concluído, mas não foi possível gerar a URL pública do arquivo.');
  }

  return data.publicUrl;
};

export const uploadImage = (file: File, bucket: ImageBucket): Promise<string> =>
  uploadToBucket(file, bucket);

export const uploadDeviceVideo = (file: File): Promise<string> =>
  uploadToBucket(file, 'device-videos');

const PUBLIC_OBJECT_SEGMENT = '/storage/v1/object/public/';

/**
 * Resolve o caminho do objeto dentro do bucket a partir de uma URL pública
 * (ou de um caminho já relativo). Retorna `null` quando a entrada não pertence
 * ao bucket informado, evitando remoções acidentais de outros buckets.
 */
export const resolveStoragePath = (
  urlOrPath: string,
  bucket: StorageBucket
): string | null => {
  const value = (urlOrPath || '').trim();
  if (!value) return null;

  if (!/^https?:\/\//i.test(value)) {
    // Caminho relativo: aceita "bucket/arquivo" ou apenas "arquivo".
    const withoutBucketPrefix = value.replace(new RegExp(`^${bucket}/`), '');
    return withoutBucketPrefix || null;
  }

  const marker = `${PUBLIC_OBJECT_SEGMENT}${bucket}/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex === -1) return null;

  const rawPath = value.slice(markerIndex + marker.length).split('?')[0];
  if (!rawPath) return null;
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
};

/**
 * Remove um conjunto de arquivos (imagens ou vídeos) do storage de forma best-effort: erros são
 * registrados mas não interrompem o fluxo do chamador (limpeza não deve
 * impedir salvar/excluir um registro).
 */
export const removeImages = async (
  urlsOrPaths: string[],
  bucket: StorageBucket
): Promise<void> => {
  const paths = Array.from(
    new Set(
      (urlsOrPaths || [])
        .map((entry) => resolveStoragePath(entry, bucket))
        .filter((path): path is string => Boolean(path))
    )
  );

  if (paths.length === 0) return;

  try {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      console.error('Falha ao remover imagem(ns) do storage:', error.message);
    }
  } catch (error: any) {
    console.error('Falha ao remover imagem(ns) do storage:', error?.message || error);
  }
};

export const removeImage = (
  urlOrPath: string,
  bucket: StorageBucket
): Promise<void> => removeImages([urlOrPath], bucket);
