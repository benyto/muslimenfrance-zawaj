// The monolith's photos are public UploadThing files (br4z1rtmqx.ufs.sh).
// Each one is downloaded, pushed through the same decode / re-encode pipeline
// new uploads use (apps/api/src/lib/photos/process.ts: WebP, EXIF/GPS dropped,
// thumb + display sizes), stored in the private `profile-photos` bucket, and
// recorded in profile_photos with its storage_key.
//
// Run from apps/api so sharp resolves:
//   cd apps/api && npx tsx ../../scripts/migration/05-migrate-photos.ts
//
// All 23 monolith profiles are status='published' (none pending/blocked), so
// per the plan every migrated photo starts moderation_status='approved' and
// 'public' — they were already publicly live, this isn't skipping real
// moderation. (New uploads, by contrast, start private and pending.)
import { rencontre } from "./lib/clients.js";
import { readOutput } from "./lib/io.js";
import { processPhoto } from "../../apps/api/src/lib/photos/process.js";

const BUCKET = "profile-photos";

type MonolithPhoto = {
  id: string;
  profile_dating_id: string;
  url: string;
  position: number;
  created_at: string;
};

async function main() {
  const { photos } = readOutput<{ photos: MonolithPhoto[] }>("export");

  const now = new Date().toISOString();
  let succeeded = 0;
  const failed: { id: string; url: string; error: string }[] = [];
  const fail = (photo: MonolithPhoto, message: string) => {
    console.error(`FAILED ${photo.id} (${photo.url}): ${message}`);
    failed.push({ id: photo.id, url: photo.url, error: message });
  };

  for (const photo of photos) {
    // Same layout as apps/api/src/lib/photos/storage.ts: two objects under
    // "<profile_id>/<photo_id>", which is what storage_key records.
    const storageKey = `${photo.profile_dating_id}/${photo.id}`;
    try {
      const response = await fetch(photo.url);
      if (!response.ok) throw new Error(`download failed (HTTP ${response.status})`);
      const { thumb, display } = await processPhoto(Buffer.from(await response.arrayBuffer()));

      const bucket = rencontre.storage.from(BUCKET);
      const options = { contentType: "image/webp", upsert: true, cacheControl: "3600" };
      const thumbUpload = await bucket.upload(`${storageKey}/thumb.webp`, thumb, options);
      if (thumbUpload.error) throw thumbUpload.error;
      const displayUpload = await bucket.upload(`${storageKey}/display.webp`, display, options);
      if (displayUpload.error) throw displayUpload.error;
    } catch (err) {
      fail(photo, (err as Error).message);
      continue;
    }

    const { error } = await rencontre.from("profile_photos").insert({
      id: photo.id,
      profile_id: photo.profile_dating_id,
      storage_key: storageKey,
      position: photo.position,
      moderation_status: "approved",
      visibility: "public",
      moderated_at: now,
      created_at: photo.created_at,
    });
    if (error) {
      fail(photo, error.message);
      continue;
    }

    console.log(`${photo.id} -> ${storageKey}`);
    succeeded++;
  }

  console.log(`\n${succeeded}/${photos.length} photos migrated.`);
  if (failed.length) {
    console.log(`${failed.length} FAILED:`);
    for (const f of failed) console.log(`  - ${f.id} (${f.url}): ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
