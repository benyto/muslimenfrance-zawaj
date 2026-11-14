import { supabaseAdmin } from "../supabase-admin.js";

export const PHOTO_BUCKET = "profile-photos";

// A photo is two objects under "<profile_id>/<photo_id>"; that prefix is what
// profile_photos.storage_key holds.
export const photoObjectPaths = (storageKey: string) => [
  `${storageKey}/thumb.webp`,
  `${storageKey}/display.webp`,
];

export async function uploadPhotoObjects(
  storageKey: string,
  { thumb, display }: { thumb: Buffer; display: Buffer }
): Promise<{ error: Error | null }> {
  const [thumbPath, displayPath] = photoObjectPaths(storageKey);
  const bucket = supabaseAdmin.storage.from(PHOTO_BUCKET);
  const options = { contentType: "image/webp", upsert: false, cacheControl: "3600" };

  const first = await bucket.upload(thumbPath, thumb, options);
  if (first.error) return { error: first.error };
  const second = await bucket.upload(displayPath, display, options);
  if (second.error) {
    // Don't leave half a photo behind.
    await bucket.remove([thumbPath]);
    return { error: second.error };
  }
  return { error: null };
}

export async function removePhotoObjects(storageKeys: string[]): Promise<{ error: Error | null }> {
  if (storageKeys.length === 0) return { error: null };
  const { error } = await supabaseAdmin.storage
    .from(PHOTO_BUCKET)
    .remove(storageKeys.flatMap(photoObjectPaths));
  return { error };
}
