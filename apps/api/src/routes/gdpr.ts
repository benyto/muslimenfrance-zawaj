import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { stripe } from "../lib/stripe.js";
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
      let photoAccess: unknown[] = [];
      let reports: unknown[] = [];
      let subscriptions: unknown[] = [];

      if (profile) {
        const [photosRes, conversationsRes, ignoresRes, subscriptionsRes, photoAccessRes] =
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
            supabaseAdmin
              .from("photo_access")
              .select("*")
              .or(`owner_profile_id.eq.${profile.id},viewer_profile_id.eq.${profile.id}`),
          ]);
        photoAccess = photoAccessRes.data ?? [];
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
        photoAccess,
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

      // Stop billing first. Deleting the account removes our subscription
      // rows but not the Stripe subscription itself, which would keep
      // charging a customer who no longer exists. Cancelled immediately (the
      // account is going away, there's no period to honour). If Stripe can't
      // be reached the deletion is refused rather than carried on: the member
      // retries, instead of being billed with no account to cancel from.
      const { data: liveSubscriptions, error: subscriptionsError } = await supabaseAdmin
        .from("user_subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", userId)
        .in("status", ["trialing", "active", "past_due", "unpaid", "incomplete"]);
      if (subscriptionsError) {
        request.log.error(subscriptionsError, "Failed to look up subscriptions before account deletion");
        return reply.code(500).send({ error: "Échec de la suppression du compte" });
      }
      for (const { stripe_subscription_id } of liveSubscriptions ?? []) {
        try {
          await stripe.subscriptions.cancel(stripe_subscription_id);
        } catch (err) {
          // Already gone on Stripe's side is the outcome we wanted.
          if ((err as { code?: string }).code === "resource_missing") continue;
          request.log.error(err, "Failed to cancel Stripe subscription before account deletion");
          return reply.code(502).send({
            error: "Impossible d'annuler votre abonnement pour le moment. Réessayez dans un instant.",
          });
        }
      }

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
