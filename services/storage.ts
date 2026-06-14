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
};

const BUCKET_FILE_SIZE_LIMIT: Record<'logos' | 'device-images', number> = {
  logos: 5 * 1024 * 1024,
  'device-images': 15 * 1024 * 1024,
};

const ALLOWED_BUCKET_MIME_TYPES: Record<'logos' | 'device-images', Set<string>> = {
  'device-images': new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  logos: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
};

const resolveExtension = (file: File) => {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/i.test(fromName)) return fromName;

  if (file.type.includes('png')) return 'png';
  if (file.type.includes('webp')) return 'webp';
  if (file.type.includes('heic')) return 'heic';
  if (file.type.includes('heif')) return 'heif';
  if (file.type.includes('svg')) return 'svg';
  return 'jpg';
};

const normalizeMimeType = (file: File, fileExt: string) => {
  const raw = (file.type || '').trim().toLowerCase();
  if (raw) {
    if (raw === 'image/jpg') return 'image/jpeg';
    return raw;
  }
  return MIME_BY_EXTENSION[fileExt] || 'image/jpeg';
};

export const uploadImage = async (file: File, bucket: 'logos' | 'device-images'): Promise<string> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente para enviar imagens.');
  }

  const fileExt = resolveExtension(file);
  const contentType = normalizeMimeType(file, fileExt);
  const maxFileSize = BUCKET_FILE_SIZE_LIMIT[bucket];
  const allowedMimeTypes = ALLOWED_BUCKET_MIME_TYPES[bucket];

  if (file.size > maxFileSize) {
    throw new Error(`Arquivo acima do limite de ${(maxFileSize / (1024 * 1024)).toFixed(0)} MB para este upload.`);
  }

  if (!allowedMimeTypes.has(contentType)) {
    throw new Error('Formato de imagem não suportado para este upload.');
  }

  const filePath = `${newId('img')}.${fileExt}`;

  const { data: uploaded, error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Falha ao enviar imagem para o storage.');
  }

  const uploadedPath = uploaded?.path || filePath;
  const { data } = supabase.storage.from(bucket).getPublicUrl(uploadedPath);
  if (!data?.publicUrl) {
    throw new Error('Upload concluído, mas não foi possível gerar URL pública da imagem.');
  }

  return data.publicUrl;
};

const PUBLIC_OBJECT_SEGMENT = '/storage/v1/object/public/';

/**
 * Resolve o caminho do objeto dentro do bucket a partir de uma URL pública
 * (ou de um caminho já relativo). Retorna `null` quando a entrada não pertence
 * ao bucket informado, evitando remoções acidentais de outros buckets.
 */
export const resolveStoragePath = (
  urlOrPath: string,
  bucket: 'logos' | 'device-images'
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
 * Remove um conjunto de imagens do storage de forma best-effort: erros são
 * registrados mas não interrompem o fluxo do chamador (limpeza não deve
 * impedir salvar/excluir um registro).
 */
export const removeImages = async (
  urlsOrPaths: string[],
  bucket: 'logos' | 'device-images'
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
  bucket: 'logos' | 'device-images'
): Promise<void> => removeImages([urlOrPath], bucket);
