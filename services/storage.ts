import { supabase } from './supabase';
import { newId } from '../utils/id';

export const uploadImage = async (file: File, bucket: 'logos' | 'device-images'): Promise<string | null> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${newId('img')}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
};
