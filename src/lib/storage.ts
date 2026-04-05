import { supabase } from './supabase';

/** Delete files from Supabase Storage given their public URLs */
export async function deleteStorageFiles(urls: string[]) {
  if (!urls.length) return;

  // Extract storage paths from public URLs
  // Public URL format: https://xxx.supabase.co/storage/v1/object/public/attachments/path/file.ext
  const paths = urls
    .map(url => {
      const match = url.match(/\/storage\/v1\/object\/public\/attachments\/(.+)$/);
      return match ? match[1] : null;
    })
    .filter((p): p is string => p !== null);

  if (paths.length > 0) {
    await supabase.storage.from('attachments').remove(paths);
  }
}
