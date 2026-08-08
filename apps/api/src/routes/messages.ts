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
      const db = request.supabase!;

      const { data: myProfile, error: myProfileError } = await db
        .from("profiles")
        .select("id, nickname")
        .eq("user_id", request.user!.id)
        .maybeSingle();
      if (myProfileError || !myProfile) {
        return reply
          .code(403)
          .send({ error: "Créez votre profil avant d'envoyer des messages" });
      }
      if (myProfile.id === recipientProfileId) {
        return reply
          .code(400)
          .send({ error: "Vous ne pouvez pas vous envoyer de message" });
      }

      // profiles RLS is owner-only — request.supabase (Amina's own RLS
      // context) cannot see Karim's row at all, regardless of whether it
      // exists. Checking a message recipient exists/is approved is exactly
      // the kind of privileged cross-user read the API exists to perform,
      // so this one deliberately uses the service-role client.
      const { data: recipientProfile, error: recipientError } =
        await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", recipientProfileId)
          .eq("moderation_status", "approved")
          .maybeSingle();
      if (recipientError || !recipientProfile) {
        return reply.code(404).send({ error: "Profil introuvable" });
      }

      const { data: blocked } = await db.rpc("is_profile_blocked", {
        p_profile_a: myProfile.id,
        p_profile_b: recipientProfileId,
      });
      if (blocked) {
        return reply
          .code(403)
          .send({ error: "Impossible d'envoyer un message à ce profil" });
      }

      const { data: hasSubscription } = await db.rpc(
        "has_active_dating_subscription",
        {
          p_user_id: request.user!.id,
        },
      );
      if (!hasSubscription) {
        return reply
          .code(402)
          .send({
            error: "Un abonnement actif est requis pour envoyer des messages",
          });
      }

      // conversations' unique constraint is on the exact (profile1_id,
      // profile2_id) pair, not normalized — without a canonical order here,
      // Alice→Bob and Bob→Alice could each create their own conversation
      // row instead of sharing one. Always store the lexicographically
      // smaller id first so the same pair always maps to the same row,
      // and look up using both possible orderings for existing rows
      // created before this fix.
      const [profileA, profileB] = [myProfile.id, recipientProfileId].sort();

      const { data: existingConversation } = await db
        .from("conversations")
        .select("id")
        .or(
          `and(profile1_id.eq.${myProfile.id},profile2_id.eq.${recipientProfileId}),and(profile1_id.eq.${recipientProfileId},profile2_id.eq.${myProfile.id})`,
        )
        .maybeSingle();

      let conversationId = existingConversation?.id;
      if (!conversationId) {
        const { data: newConversation, error: conversationError } = await db
          .from("conversations")
          .insert({ profile1_id: profileA, profile2_id: profileB })
          .select("id")
          .single();
        if (conversationError || !newConversation) {
          request.log.error(conversationError, "Failed to create conversation");
          return reply
            .code(500)
            .send({ error: "Échec de la création de la conversation" });
        }
        conversationId = newConversation.id;
      }

      const { data: message, error: messageError } = await db
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_profile_id: myProfile.id,
          recipient_profile_id: recipientProfileId,
          content,
        })
        .select()
        .single();

      if (messageError) {
        request.log.error(messageError, "Failed to send message");
        return reply.code(500).send({ error: "Échec de l'envoi du message" });
      }

      await maybeSendNewMessageEmail({
        conversationId,
        senderNickname: myProfile.nickname,
        recipientProfileId,
        messageContent: content,
      });

      return message;
    },
  );
}
