import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { userRateLimit } from "../lib/user-rate-limit.js";
import { InvalidImageError, processPhoto } from "../lib/photos/process.js";
import { removePhotoObjects, uploadPhotoObjects } from "../lib/photos/storage.js";

const MAX_PHOTOS = 10;
// Phone photos are routinely 4–8 MB; the API shrinks them anyway, so the cap
// only exists to bound memory and bandwidth, not to police quality.
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export async function photoRoutes(fastify: FastifyInstance) {
  await fastify.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

  // The only way a photo comes to exist. The client sends the raw file here
  // rather than writing to storage or the table itself (it holds no INSERT
  // grant on either), so everything that makes a photo acceptable happens in
  // one place: whose profile it is, the count limit, and the file actually
  // being an image — decoded and re-encoded, with its metadata dropped.
  fastify.post(
    "/photos",
    {
      preHandler: [
        fastify.requireAuth,
        userRateLimit(fastify, { max: 30, timeWindow: "1 minute" }),
      ],
    },
    async (request, reply) => {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("user_id", request.user!.id)
        .maybeSingle();
      if (!profile) {
        return reply.code(403).send({ error: "Créez votre profil avant d'ajouter des photos" });
      }

      const { count } = await supabaseAdmin
        .from("profile_photos")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id);
      if ((count ?? 0) >= MAX_PHOTOS) {
        return reply.code(409).send({ error: `${MAX_PHOTOS} photos maximum` });
      }

      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: "Aucun fichier reçu" });
      }

      let input: Buffer;
      try {
        input = await file.toBuffer();
      } catch {
        return reply.code(413).send({ error: "Photo trop lourde (12 Mo maximum)" });
      }

      let processed;
      try {
        processed = await processPhoto(input);
      } catch (err) {
        if (err instanceof InvalidImageError) {
          return reply
            .code(400)
            .send({ error: "Image invalide ou format non pris en charge (JPEG, PNG ou WebP)" });
        }
        throw err;
      }

      const photoId = randomUUID();
      const storageKey = `${profile.id}/${photoId}`;

      const { error: uploadError } = await uploadPhotoObjects(storageKey, processed);
      if (uploadError) {
        request.log.error(uploadError, "Failed to store photo objects");
        return reply.code(502).send({ error: "L'enregistrement de la photo a échoué, réessayez." });
      }

      const { data: photo, error: insertError } = await supabaseAdmin
        .from("profile_photos")
        .insert({
          id: photoId,
          profile_id: profile.id,
          storage_key: storageKey,
          position: count ?? 0,
        })
        .select()
        .single();
      if (insertError) {
        request.log.error(insertError, "Failed to record uploaded photo");
        // Objects without a row would be unreachable and never cleaned up.
        await removePhotoObjects([storageKey]);
        return reply.code(500).send({ error: "L'enregistrement de la photo a échoué, réessayez." });
      }

      return photo;
    },
  );

  // Removes the files and then the row. The row is what remembers where the
  // files are, so it goes last: if removing the files fails, the photo stays
  // listed and the member simply retries, instead of leaving files nobody can
  // find. (Clients can't delete rows or objects themselves.)
  fastify.delete<{ Params: { id: string } }>(
    "/photos/:id",
    {
      preHandler: [
        fastify.requireAuth,
        userRateLimit(fastify, { max: 30, timeWindow: "1 minute" }),
      ],
    },
    async (request, reply) => {
      const { data: photo, error: fetchError } = await supabaseAdmin
        .from("profile_photos")
        .select("id, storage_key, profile_id")
        .eq("id", request.params.id)
        .maybeSingle();

      if (fetchError) {
        request.log.error(fetchError, "Failed to look up photo");
        return reply.code(500).send({ error: "Failed to look up photo" });
      }
      if (!photo) {
        return reply.code(404).send({ error: "Photo not found" });
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("id", photo.profile_id)
        .single();

      if (profileError || profile.user_id !== request.user!.id) {
        return reply.code(404).send({ error: "Photo not found" });
      }

      if (photo.storage_key) {
        const { error: removeError } = await removePhotoObjects([photo.storage_key]);
        if (removeError) {
          request.log.error(removeError, "Failed to remove photo objects");
          return reply.code(502).send({ error: "La suppression du fichier a échoué, réessayez." });
        }
      }

      const { error: deleteError } = await supabaseAdmin
        .from("profile_photos")
        .delete()
        .eq("id", photo.id);

      if (deleteError) {
        request.log.error(deleteError, "Failed to delete photo row");
        return reply.code(500).send({ error: "Failed to delete photo" });
      }

      return { success: true };
    },
  );
}
