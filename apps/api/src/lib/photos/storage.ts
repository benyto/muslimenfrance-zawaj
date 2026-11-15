import { supabaseAdmin } from "../supabase-admin.js";

export const PHOTO_BUCKET = "profile-photos";

// A photo is two objects under "<profile_id>/<photo_id>"; that prefix is what
// profile_photos.storage_key holds.
export const photoObjectPaths = (storageKey: string) => [
  `${storageKey}/thumb.webp`,
  `${storageKey}/display.webp`,
];

// Cache lifetime stored on each object. Note what actually governs how long a
// photo stays loadable after it is deleted or access is withdrawn: responses
// served through a signed link carry an `Expires` equal to the link's own
// lifetime (SIGNED_URL_TTL_SECONDS in the web app's photo-urls.tsx), not this
// header. This is kept equal to it so the two never disagree. Only applies to
// objects uploaded from now on — the header is stored with each object.
const PHOTO_CACHE_SECONDS = 10 * 60;

export async function uploadPhotoObjects(
  storageKey: string,
  { thumb, display }: { thumb: Buffer; display: Buffer }
): Promise<{ error: Error | null }> {
  const [thumbPath, displayPath] = photoObjectPaths(storageKey);
  const bucket = supabaseAdmin.storage.from(PHOTO_BUCKET);
  const options = { contentType: "image/webp", upsert: false, cacheControl: String(PHOTO_CACHE_SECONDS) };

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

/**
 * Removes every object under a member's folder, whatever the database says.
 *
 * The rows in profile_photos are the usual record of what a member has stored,
 * but they can disagree with Storage — an upload racing an account deletion
 * writes its files before its row. Listing the folder is the authoritative
 * inventory, so deletion sweeps it (before and after the account is removed).
 */
export async function removeAllPhotoObjects(profileId: string): Promise<{ error: Error | null }> {
  const bucket = supabaseAdmin.storage.from(PHOTO_BUCKET);
  const paths: string[] = [];

  for (let offset = 0; ; offset += 1000) {
    const { data: folders, error } = await bucket.list(profileId, { limit: 1000, offset });
    if (error) return { error };
    for (const folder of folders ?? []) {
      const { data: files, error: filesError } = await bucket.list(`${profileId}/${folder.name}`, { limit: 100 });
      if (filesError) return { error: filesError };
      paths.push(...(files ?? []).map((file) => `${profileId}/${folder.name}/${file.name}`));
    }
    if ((folders ?? []).length < 1000) break;
  }

  if (paths.length === 0) return { error: null };
  const { error } = await bucket.remove(paths);
  return { error };
}
