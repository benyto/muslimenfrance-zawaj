import type { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { stripe } from "../lib/stripe.js";
import { removeAllPhotoObjects } from "../lib/photos/storage.js";
import { buildAccountExport } from "../lib/gdpr/export.js";
import { userRateLimit } from "../lib/user-rate-limit.js";

export async function gdprRoutes(fastify: FastifyInstance) {
  // GDPR Art. 15/20 — data access & portability. Gathers everything tied to
  // the caller's own account and returns it directly; low-volume enough
  // (single user's data) that there's no need for an async job + email
  // attachment, unlike a full-database export. See lib/gdpr/export.ts.
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

      try {
        const data = await buildAccountExport(userId, request.user!.email);
        // Only now is it complete.
        await supabaseAdmin
          .from("gdpr_requests")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", gdprRequest.id);
        return data;
      } catch (err) {
        // Never hand back — or record as completed — an export that could not
        // be read in full.
        request.log.error(err, "GDPR export failed");
        await supabaseAdmin.from("gdpr_requests").update({ status: "failed" }).eq("id", gdprRequest.id);
        return reply.code(500).send({ error: "L'export de vos données a échoué. Réessayez dans un instant." });
      }
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

      const { data: deletionRequest } = await supabaseAdmin
        .from("gdpr_requests")
        .insert({ user_id: userId, request_type: "delete", status: "processing" })
        .select("id")
        .single();

      // The inventory of what this member owns has to be known before anything
      // is removed. A failed read is not "no profile": carrying on would delete
      // the account and leave whatever it owned behind with nothing to find it by.
      const { data: ownProfile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, deleted_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileError) {
        request.log.error(profileError, "Failed to read the profile before account deletion");
        return reply.code(500).send({ error: "Échec de la suppression du compte" });
      }

      // Close the account before touching anything else. While the profile is
      // marked deleted, new uploads and checkouts are refused (and messages, via
      // send_message_command), so nothing new can attach itself to an account
      // that is being emptied. Any failure below puts the marker back, so a
      // failed deletion never leaves the member half-hidden.
      let closed = false;
      if (ownProfile) {
        const { error: closeError } = await supabaseAdmin
          .from("profiles")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", ownProfile.id);
        if (closeError) {
          request.log.error(closeError, "Failed to close the account before deletion");
          return reply.code(500).send({ error: "Échec de la suppression du compte" });
        }
        closed = true;
      }
      const abort = async (status: number, error: string) => {
        if (closed && ownProfile) {
          await supabaseAdmin.from("profiles").update({ deleted_at: ownProfile.deleted_at }).eq("id", ownProfile.id);
        }
        if (deletionRequest) {
          await supabaseAdmin.from("gdpr_requests").update({ status: "failed" }).eq("id", deletionRequest.id);
        }
        return reply.code(status).send({ error });
      };

      // Stop billing. Deleting the account removes our subscription rows but not
      // the Stripe subscription itself, which would keep charging a customer who
      // no longer exists. Cancelled immediately (the account is going away,
      // there's no period to honour). If Stripe can't be reached the deletion is
      // refused rather than carried on: the member retries, instead of being
      // billed with no account to cancel from.
      const { data: liveSubscriptions, error: subscriptionsError } = await supabaseAdmin
        .from("user_subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", userId)
        .in("status", ["trialing", "active", "past_due", "unpaid", "incomplete"]);
      if (subscriptionsError) {
        request.log.error(subscriptionsError, "Failed to look up subscriptions before account deletion");
        return abort(500, "Échec de la suppression du compte");
      }
      const cancelled = new Set<string>();
      for (const { stripe_subscription_id } of liveSubscriptions ?? []) {
        try {
          await stripe.subscriptions.cancel(stripe_subscription_id);
          cancelled.add(stripe_subscription_id);
        } catch (err) {
          // Already gone on Stripe's side is the outcome we wanted.
          if ((err as { code?: string }).code === "resource_missing") continue;
          request.log.error(err, "Failed to cancel Stripe subscription before account deletion");
          return abort(502, "Impossible d'annuler votre abonnement pour le moment. Réessayez dans un instant.");
        }
      }

      // Checkouts started but not (yet) reflected in user_subscriptions: an open
      // session could still be paid after the account is gone, and one completed
      // a moment ago may not have reached our table. We recorded every session we
      // created (subscription_consents), so close them all.
      const { data: sessions, error: sessionsError } = await supabaseAdmin
        .from("subscription_consents")
        .select("stripe_checkout_session_id")
        .eq("user_id", userId);
      if (sessionsError) {
        request.log.error(sessionsError, "Failed to look up checkout sessions before account deletion");
        return abort(500, "Échec de la suppression du compte");
      }
      for (const { stripe_checkout_session_id: sessionId } of sessions ?? []) {
        try {
          const session = await stripe.checkout.sessions.retrieve(sessionId);
          if (session.status === "open") {
            await stripe.checkout.sessions.expire(sessionId);
          } else if (session.status === "complete" && session.subscription) {
            const subscriptionId =
              typeof session.subscription === "string" ? session.subscription : session.subscription.id;
            if (!cancelled.has(subscriptionId)) {
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              if (subscription.status !== "canceled") await stripe.subscriptions.cancel(subscriptionId);
            }
          }
        } catch (err) {
          if ((err as { code?: string }).code === "resource_missing") continue;
          request.log.error(err, "Failed to close a Stripe checkout session before account deletion");
          return abort(502, "Impossible d'annuler votre abonnement pour le moment. Réessayez dans un instant.");
        }
      }

      // Delete the stored photo files. By the member's own folder rather than by
      // the rows that name them: the folder is the real inventory (an upload that
      // raced this request has files but maybe no row yet). A failure stops the
      // deletion rather than leaving their photos in storage.
      if (ownProfile) {
        const { error: removeError } = await removeAllPhotoObjects(ownProfile.id);
        if (removeError) {
          request.log.error(removeError, "Failed to remove photo files before account deletion");
          return abort(502, "Impossible de supprimer vos photos pour le moment. Réessayez dans un instant.");
        }
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        request.log.error(error, "Failed to delete user account");
        return abort(500, "Échec de la suppression du compte");
      }

      // The account is gone; sweep once more for anything an in-flight upload
      // wrote after the first pass. Best effort — the member's data is already
      // erased, so a failure here is logged, not reported as a failed deletion.
      if (ownProfile) {
        const { error: sweepError } = await removeAllPhotoObjects(ownProfile.id);
        if (sweepError) request.log.error(sweepError, "Final photo sweep after account deletion failed");
      }

      return { success: true };
    },
  );
}
