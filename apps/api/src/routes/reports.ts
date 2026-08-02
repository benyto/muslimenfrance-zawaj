import type { FastifyInstance } from "fastify";
import { createReportSchema } from "@rencontre/shared";
import { getUserEmail } from "../lib/get-user-email.js";
import { sendEmail } from "../lib/email/send.js";
import { reportReceivedEmail } from "../lib/email/templates.js";

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/reports",
    { preHandler: fastify.requireAuth, config: { rateLimit: { max: 10, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const parsed = createReportSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      }
      const db = request.supabase!;

      // Insert as the caller — same RLS policy ("reports insert own") a
      // direct client insert would have used; the only reason this moved
      // into the API is to trigger the confirmation email as a privileged
      // side effect, not because the write itself needed it.
      const { data: report, error } = await db
        .from("reports")
        .insert({
          reporter_id: request.user!.id,
          content_type: parsed.data.contentType,
          content_id: parsed.data.contentId,
          reason: parsed.data.reason,
          description: parsed.data.description ?? null,
        })
        .select()
        .single();

      if (error) {
        request.log.error(error, "Failed to create report");
        return reply.code(500).send({ error: "Échec de l'envoi du signalement" });
      }

      const { data: myProfile } = await db
        .from("profiles")
        .select("nickname")
        .eq("user_id", request.user!.id)
        .maybeSingle();
      const email = await getUserEmail(request.user!.id);
      if (myProfile && email) {
        const { subject, html } = reportReceivedEmail({ nickname: myProfile.nickname });
        await sendEmail(email, { subject, html });
      }

      return report;
    }
  );
}
