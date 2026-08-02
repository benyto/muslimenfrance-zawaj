import { createUploadthing, type FileRouter } from "uploadthing/fastify";
import { UploadThingError } from "uploadthing/server";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { verifyBearerToken } from "../lib/verify-bearer.js";

const f = createUploadthing();

// TODO(private mode): flip to `acl: "private"` once restricted-mode is
// enabled — requires "Allow Overriding ACL" turned on in the UploadThing
// dashboard first, plus switching profile-photo reads over to
// utapi.generateSignedURL() instead of the public <app-id>.ufs.sh URL
// built client-side. Public-read for now, by explicit user decision, to
// get the upload pipeline working end-to-end before adding that layer.
export const uploadRouter = {
  profileDatingPhotos: f({ image: { maxFileSize: "4MB", maxFileCount: 10 } })
    .middleware(async ({ req }) => {
      const verified = await verifyBearerToken(req.headers.authorization);
      if (!verified) {
        throw new UploadThingError("Unauthorized");
      }

      const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("user_id", verified.user.id)
        .maybeSingle();

      if (error) {
        throw new UploadThingError("Failed to look up profile");
      }
      if (!profile) {
        throw new UploadThingError("Create your profile before adding photos");
      }

      return { profileId: profile.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const { count } = await supabaseAdmin
        .from("profile_photos")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", metadata.profileId);

      const { error } = await supabaseAdmin.from("profile_photos").insert({
        profile_id: metadata.profileId,
        uploadthing_key: file.key,
        position: count ?? 0,
      });

      if (error) {
        // The file is already uploaded at this point — log loudly rather
        // than silently losing track of an orphaned UploadThing file.
        console.error("Failed to record uploaded photo", { key: file.key, error });
      }

      return { key: file.key };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
