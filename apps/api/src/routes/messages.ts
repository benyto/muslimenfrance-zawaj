import type { FastifyInstance } from "fastify";
import { sendMessageSchema } from "@rencontre/shared";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { getUserEmail } from "../lib/get-user-email.js";
import { sendEmail } from "../lib/email/send.js";
import { newMessageEmail } from "../lib/email/templates.js";
import { userRateLimit } from "../lib/user-rate-limit.js";

async function maybeSendNewMessageEmail(params: {
  conversationId: string;
  senderNickname: string;
  recipientProfileId: string;
  messageContent: string;
}) {
  // The recipient's own prefs — opt-in and cooldown are both theirs to set
  // (Réglages > Notifications), not the sender's.
  const { data: recipientProfile } = await supabaseAdmin
    .from("profiles")
    .select(
      "user_id, nickname, email_new_message_notifications, email_new_message_cooldown_minutes"
    )
    .eq("id", params.recipientProfileId)
    .single();
  if (!recipientProfile || !recipientProfile.email_new_message_notifications) {
    return;
  }

  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("last_notification_email_sent_at")
    .eq("id", params.conversationId)
    .single();

  const cooldownMs = recipientProfile.email_new_message_cooldown_minutes * 60 * 1000;
  const lastSent = conversation?.last_notification_email_sent_at
    ? new Date(conversation.last_notification_email_sent_at).getTime()
    : 0;
  if (Date.now() - lastSent < cooldownMs) {
    return;
  }

  const recipientEmail = await getUserEmail(recipientProfile.user_id);
  if (!recipientEmail) return;

  const preview =
    params.messageContent.length > 80
      ? `${params.messageContent.slice(0, 80)}…`
      : params.messageContent;
  const { subject, html } = newMessageEmail({
    recipientNickname: recipientProfile.nickname,
    senderNickname: params.senderNickname,
    preview,
  });
  await sendEmail(recipientEmail, { subject, html });

  await supabaseAdmin
    .from("conversations")
    .update({ last_notification_email_sent_at: new Date().toISOString() })
    .eq("id", params.conversationId);
}

export async function messageRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/messages",
    {
      preHandler: [
        fastify.requireAuth,
        userRateLimit(fastify, { max: 30, timeWindow: "1 minute" }),
      ],
    },
    async (request, reply) => {
      const parsed = sendMessageSchema
        .omit({ conversationId: true })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({
            error: parsed.error.issues[0]?.message ?? "Invalid request",
          });
      }
      const { recipientProfileId, content } = parsed.data;

      // Everything that decides whether this message may exist — sender and
      // recipient approved, not the same person, subscription — plus the
      // create-or-find of the conversation and the insert, happens in one
      // database transaction inside send_message_command. That function is
      // callable by the service role only and clients hold no INSERT grant
      // on messages/conversations, so this route (and its rate limit above)
      // is the only way a message can be written.
      // Returns a single row (not a set), so no .single() — the generated
      // types model it as the row itself.
      const { data: message, error: sendError } = await supabaseAdmin.rpc("send_message_command", {
        p_sender_user_id: request.user!.id,
        p_recipient_profile_id: recipientProfileId,
        p_content: content,
      });

      if (sendError || !message) {
        const known: Record<string, { status: number; error: string }> = {
          SENDER_NOT_APPROVED: {
            status: 403,
            error: "Votre profil doit être validé avant d'envoyer des messages",
          },
          SELF_MESSAGE: { status: 400, error: "Vous ne pouvez pas vous envoyer de message" },
          RECIPIENT_NOT_FOUND: { status: 404, error: "Profil introuvable" },
          SUBSCRIPTION_REQUIRED: {
            status: 402,
            error: "Un abonnement actif est requis pour envoyer des messages",
          },
        };
        const mapped = sendError ? known[sendError.message] : undefined;
        if (mapped) return reply.code(mapped.status).send({ error: mapped.error });

        request.log.error(sendError, "Failed to send message");
        return reply.code(500).send({ error: "Échec de l'envoi du message" });
      }

      const { data: senderProfile } = await supabaseAdmin
        .from("profiles")
        .select("nickname")
        .eq("id", message.sender_profile_id)
        .single();

      await maybeSendNewMessageEmail({
        conversationId: message.conversation_id,
        senderNickname: senderProfile?.nickname ?? "Un membre",
        recipientProfileId,
        messageContent: content,
      });

      return message;
    },
  );
}
