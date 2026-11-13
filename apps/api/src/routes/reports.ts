import type { FastifyInstance } from "fastify";
import { createReportSchema } from "@rencontre/shared";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { getUserEmail } from "../lib/get-user-email.js";
import { sendEmail } from "../lib/email/send.js";
import { reportReceivedEmail } from "../lib/email/templates.js";
import { userRateLimit } from "../lib/user-rate-limit.js";

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/reports",
    {
      preHandler: [
        fastify.requireAuth,
        userRateLimit(fastify, { max: 10, timeWindow: "1 hour" }),
      ],
    },
    async (request, reply) => {
      const parsed = createReportSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({
            error: parsed.error.issues[0]?.message ?? "Invalid request",
          });
      }
      const userId = request.user!.id;

      const { data: myProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, nickname")
        .eq("user_id", userId)
        .maybeSingle();
      if (!myProfile) {
        return reply.code(403).send({ error: "Créez votre profil avant de signaler" });
      }

      // The target has to exist, and a message report has to come from one of
      // its two participants — otherwise anyone could fill the moderation
      // queue with reports about ids that don't exist or conversations they
      // never saw. Both lookups need the service role: profiles and messages
      // aren't readable across accounts under RLS.
      if (parsed.data.contentType === "profile") {
        if (parsed.data.contentId === myProfile.id) {
          return reply.code(400).send({ error: "Vous ne pouvez pas vous signaler vous-même" });
        }
        const { data: target } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", parsed.data.contentId)
          .is("deleted_at", null)
          .maybeSingle();
        if (!target) return reply.code(404).send({ error: "Contenu introuvable" });
      } else {
        const { data: message } = await supabaseAdmin
          .from("messages")
          .select("sender_profile_id, recipient_profile_id")
          .eq("id", parsed.data.contentId)
          .maybeSingle();
        const isParticipant =
          message &&
          (message.sender_profile_id === myProfile.id || message.recipient_profile_id === myProfile.id);
        if (!isParticipant) return reply.code(404).send({ error: "Contenu introuvable" });
      }

      // Clients hold no INSERT grant on reports any more — this route is the
      // only writer, so the quota above and the checks here always apply.
      const { data: report, error } = await supabaseAdmin
        .from("reports")
        .insert({
          reporter_id: userId,
          content_type: parsed.data.contentType,
          content_id: parsed.data.contentId,
          reason: parsed.data.reason,
          description: parsed.data.description ?? null,
        })
        .select()
        .single();

      if (error) {
        // reports_one_open_per_target: already reported and not handled yet.
        if (error.code === "23505") {
          return reply
            .code(409)
            .send({ error: "Vous avez déjà signalé ce contenu — notre équipe l'examine." });
        }
        request.log.error(error, "Failed to create report");
        return reply
          .code(500)
          .send({ error: "Échec de l'envoi du signalement" });
      }

      const email = await getUserEmail(userId);
      if (email) {
        const { subject, html } = reportReceivedEmail({
          nickname: myProfile.nickname,
        });
        await sendEmail(email, { subject, html });
      }

      return report;
    },
  );
}
