import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { userRateLimit } from "../lib/user-rate-limit.js";

export async function gdprRoutes(fastify: FastifyInstance) {
  // GDPR Art. 15/20 — data access & portability. Gathers everything tied to
  // the caller's own account and returns it directly; low-volume enough
  // (single user's data) that there's no need for an async job + email
  // attachment, unlike a full-database export.
  fastify.post(
    "/gdpr/export",
    {
      preHandler: [
        fastify.requireAuth,
        userRateLimit(fastify, { max: 3, timeWindow: "1 day" }),
      ],
    },
    async (request, reply) => {
      const userId = request.user!.id;

      const { data: gdprRequest, error: insertError } = await supabaseAdmin
        .from("gdpr_requests")
        .insert({
          user_id: userId,
          request_type: "export",
          status: "processing",
        })
        .select()
        .single();
      if (insertError) {
        request.log.error(insertError, "Failed to record GDPR export request");
        return reply.code(500).send({ error: "Échec de la demande d'export" });
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      let photos: unknown[] = [];
      let conversations: unknown[] = [];
      let messages: unknown[] = [];
      let ignores: unknown[] = [];
      let reports: unknown[] = [];
      let subscriptions: unknown[] = [];

      if (profile) {
        const [photosRes, conversationsRes, ignoresRes, subscriptionsRes] =
          await Promise.all([
            supabaseAdmin
              .from("profile_photos")
              .select("*")
              .eq("profile_id", profile.id),
            supabaseAdmin
              .from("conversations")
              .select("*")
              .or(`profile1_id.eq.${profile.id},profile2_id.eq.${profile.id}`),
            supabaseAdmin
              .from("profile_ignores")
              .select("*")
              .eq("ignorer_profile_id", profile.id),
            supabaseAdmin
              .from("user_subscriptions")
              .select("*")
              .eq("user_id", userId),
          ]);
        photos = photosRes.data ?? [];
        conversations = conversationsRes.data ?? [];
        ignores = ignoresRes.data ?? [];
        subscriptions = subscriptionsRes.data ?? [];

        const { data: messagesData } = await supabaseAdmin
          .from("messages")
          .select("*")
          .or(
            `sender_profile_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`,
          );
        messages = messagesData ?? [];

        const { data: reportsData } = await supabaseAdmin
          .from("reports")
          .select("*")
          .eq("reporter_id", userId);
        reports = reportsData ?? [];
      }

      await supabaseAdmin
        .from("gdpr_requests")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", gdprRequest.id);

      return {
        exportedAt: new Date().toISOString(),
        account: { id: userId, email: request.user!.email },
        profile,
        photos,
        conversations,
        messages,
        ignores,
        reports,
        subscriptions,
      };
    },
  );

  // GDPR Art. 17 — right to erasure. Self-service account deletion: the
  // caller can only ever delete their own account (request.user.id, never
  // a body-supplied id). auth.admin.deleteUser cascades through every FK
  // (profiles, photos, messages, ignores, reports, subscriptions,
  // gdpr_requests itself) — already verified end-to-end in earlier phases.
  fastify.post(
    "/gdpr/delete",
    {
      preHandler: [
        fastify.requireAuth,
        userRateLimit(fastify, { max: 3, timeWindow: "1 day" }),
      ],
    },
    async (request, reply) => {
      const userId = request.user!.id;

      await supabaseAdmin.from("gdpr_requests").insert({
        user_id: userId,
        request_type: "delete",
        status: "processing",
      });

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        request.log.error(error, "Failed to delete user account");
        return reply
          .code(500)
          .send({ error: "Échec de la suppression du compte" });
      }

      return { success: true };
    },
  );
}
