// The monolith's photos live on a different UploadThing app
// (br4z1rtmqx.ufs.sh) than this project's (y8z0mztmgr.ufs.sh per
// apps/api/.env's UPLOADTHING_TOKEN) — UploadThing keys/URLs are
// app-scoped, so there is no cheaper "flip the ACL in place" option here;
// every file has to be actually copied. uploadFilesFromUrl does the
// download+reupload in one call.
//
// All 23 monolith profiles are status='published' (none pending/blocked),
// so per the plan every migrated photo starts moderation_status='approved'
// — they were already publicly live, this isn't skipping real moderation.
import { rencontre, utapi } from "./lib/clients.js";
import { readOutput } from "./lib/io.js";

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

  for (const photo of photos) {
    const result = await utapi.uploadFilesFromUrl(photo.url);
    if (result.error) {
      console.error(`FAILED ${photo.id} (${photo.url}): ${result.error.message}`);
      failed.push({ id: photo.id, url: photo.url, error: result.error.message });
      continue;
    }

    const { error } = await rencontre.from("profile_photos").insert({
      id: photo.id,
      profile_id: photo.profile_dating_id,
      uploadthing_key: result.data.key,
      position: photo.position,
      moderation_status: "approved",
      moderated_at: now,
      created_at: photo.created_at,
    });
    if (error) {
      console.error(`FAILED to insert row for ${photo.id}: ${error.message}`);
      failed.push({ id: photo.id, url: photo.url, error: error.message });
      continue;
    }

    console.log(`${photo.id} -> ${result.data.key}`);
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
