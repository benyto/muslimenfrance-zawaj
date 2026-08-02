import type { FastifyInstance } from "fastify";
import { UTApi } from "uploadthing/server";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { userRateLimit } from "../lib/user-rate-limit.js";

const utapi = new UTApi();

export async function photoRoutes(fastify: FastifyInstance) {
  // Deletes both the UploadThing file and the DB row together — the RLS
  // "profile_photos owner delete" policy only covers the DB row (a direct
  // client-side delete would orphan the file in storage), so this route is
  // the one real path for removing a photo.
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
        .select("id, uploadthing_key, profile_id")
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

      await utapi.deleteFiles(photo.uploadthing_key);

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
