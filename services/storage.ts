import { supabase } from './supabase';
import { newId } from '../utils/id';

const resolveExtension = (file: File) => {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/i.test(fromName)) return fromName;

  if (file.type.includes('png')) return 'png';
  if (file.type.includes('webp')) return 'webp';
  if (file.type.includes('heic')) return 'heic';
  if (file.type.includes('heif')) return 'heif';
  return 'jpg';
};

export const uploadImage = async (file: File, bucket: 'logos' | 'device-images'): Promise<string> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente para enviar imagens.');
  }

  const fileExt = resolveExtension(file);
  const filePath = `${newId('img')}.${fileExt}`;

  const { data: uploaded, error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined
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
