import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { getUserEmail } from "../lib/get-user-email.js";
import { sendEmail } from "../lib/email/send.js";
import {
  profileModeratedEmail,
  photoRejectedEmail,
  profileTextsReviewedEmail,
  reportResolvedEmail,
} from "../lib/email/templates.js";
import type { Database } from "@rencontre/shared";

type Json = Database["public"]["Tables"]["admin_audit_log"]["Insert"]["before"];

const moderateProfileSchema = z.object({
  status: z.enum(["approved", "rejected", "disabled"]),
  notes: z.string().max(1000).optional(),
});

const reviewProfileTextsSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  // The version the moderator was shown (profiles.text_review_version). If the
  // member has changed their text since, the decision is refused.
  version: z.number().int().min(0),
  notes: z.string().max(1000).optional(),
});

const moderatePhotoSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

const resolveReportSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
  adminNotes: z.string().max(1000).optional(),
});

const subscriptionProductSchema = z.object({
  audience: z.enum(["all", "male", "female"]),
  name: z.string().min(1).max(100),
  stripeProductId: z.string().nullable().optional(),
  stripePriceId: z.string().nullable().optional(),
  priceAmount: z.number().int().nullable().optional(),
  currency: z.string().min(3).max(3).default("eur"),
  interval: z.string().default("month"),
  trialPeriodDays: z.number().int().min(0).default(7),
  enabled: z.boolean().default(false),
});

// What an audit entry may record about a decision on a member's profile, photo
// or report: the state it moved between, never the content. A snapshot of the
// row would put the member's data (nickname, birth date, texts, a reporter's
// description…) into a log that outlives their account. The database enforces
// the same list (admin_audit_log_details_minimal), so widening it is a
// deliberate migration, not a one-line slip.
type AuditState = {
  moderation_status?: string;
  status?: string;
  bio_changed?: boolean;
  looking_for_changed?: boolean;
};

async function insertAuditRow(row: {
  adminUserId: string;
  action: string;
  targetType: "profile" | "photo" | "report" | "subscription" | "user";
  targetId: string;
  before?: Json;
  after?: Json;
  ip?: string;
}) {
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    admin_user_id: row.adminUserId,
    action: row.action,
    target_type: row.targetType,
    target_id: row.targetId,
    before: row.before ?? null,
    after: row.after ?? null,
    ip_address: row.ip ?? null,
  });
  if (error) console.error("Failed to write admin_audit_log", error);
  return !error;
}

async function writeAuditLog(params: {
  adminUserId: string;
  action: string;
  targetType: "profile" | "photo" | "report" | "user";
  targetId: string;
  before?: AuditState;
  after?: AuditState;
  ip?: string;
}) {
  // Most callers ignore the result: a moderation decision has already been made
  // and must not fail because its log line could not be written. Reading a
  // private conversation is the exception — it checks the result and refuses.
  return insertAuditRow(params);
}

// Pricing configuration is business data, not personal data, so its full
// before/after is kept.
async function writeProductAuditLog(params: {
  adminUserId: string;
  action: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}) {
  await insertAuditRow({
    ...params,
    targetType: "subscription",
    before: params.before as Json,
    after: params.after as Json,
  });
}

export async function adminRoutes(fastify: FastifyInstance) {
  const adminPreHandler = [fastify.requireAuth, fastify.requireAdmin];
  // Subscription pricing is business-sensitive — restrict to admin, not
  // moderators (who can still moderate profiles/photos/reports above).
  const adminOnlyPreHandler = [fastify.requireAuth, fastify.requireAdminOnly];

  fastify.post<{ Params: { id: string } }>(
    "/admin/profiles/:id/moderate",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const parsed = moderateProfileSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid request",
        });
      }

      const { data: before } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", request.params.id)
        .maybeSingle();
      if (!before) {
        return reply.code(404).send({ error: "Profil introuvable" });
      }

      const { data: after, error } = await supabaseAdmin
        .from("profiles")
        .update({
          moderation_status: parsed.data.status,
          moderation_notes: parsed.data.notes ?? null,
          moderated_by: request.user!.id,
          moderated_at: new Date().toISOString(),
        })
        .eq("id", request.params.id)
        .select()
        .single();
      if (error) {
        request.log.error(error, "Failed to moderate profile");
        return reply.code(500).send({ error: "Échec de la mise à jour" });
      }

      await writeAuditLog({
        adminUserId: request.user!.id,
        action: `profile_${parsed.data.status}`,
        targetType: "profile",
        targetId: request.params.id,
        before: { moderation_status: before.moderation_status },
        after: { moderation_status: after.moderation_status },
        ip: request.ip,
      });

      if (
        parsed.data.status === "approved" ||
        parsed.data.status === "rejected"
      ) {
        const email = await getUserEmail(before.user_id);
        if (email) {
          const { subject, html } = profileModeratedEmail({
            nickname: before.nickname,
            approved: parsed.data.status === "approved",
            notes: parsed.data.notes,
          });
          await sendEmail(email, { subject, html });
        }
      }

      return after;
    },
  );

  // Approves or rejects the text edit (about me / looking for) a member made
  // on an already-approved profile. Until then the profile keeps showing its
  // previous text. See migration 20261116100000_profile_text_review.sql.
  fastify.post<{ Params: { id: string } }>(
    "/admin/profiles/:id/texts/review",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const parsed = reviewProfileTextsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid request",
        });
      }
      const approve = parsed.data.decision === "approved";

      const { data: before } = await supabaseAdmin
        .from("profiles")
        .select("user_id, nickname, bio, looking_for, bio_pending, looking_for_pending")
        .eq("id", request.params.id)
        .maybeSingle();
      if (!before) {
        return reply.code(404).send({ error: "Profil introuvable" });
      }

      const { data: after, error } = await supabaseAdmin.rpc("review_profile_texts", {
        p_profile_id: request.params.id,
        p_approve: approve,
        p_expected_version: parsed.data.version,
      });
      if (error || !after) {
        const known: Record<string, { status: number; error: string }> = {
          NO_PENDING_TEXT: { status: 409, error: "Aucune modification en attente pour ce profil" },
          STALE_REVIEW: {
            status: 409,
            error: "Le membre a modifié son texte entre-temps — rechargez pour voir la dernière version",
          },
          PROFILE_NOT_FOUND: { status: 404, error: "Profil introuvable" },
        };
        const mapped = error ? known[error.message] : undefined;
        if (mapped) return reply.code(mapped.status).send({ error: mapped.error });
        request.log.error(error, "Failed to review profile texts");
        return reply.code(500).send({ error: "Échec de la mise à jour" });
      }

      await writeAuditLog({
        adminUserId: request.user!.id,
        action: `profile_texts_${parsed.data.decision}`,
        targetType: "profile",
        targetId: request.params.id,
        // Which fields were up for review, not what they said.
        after: {
          bio_changed: before.bio_pending != null,
          looking_for_changed: before.looking_for_pending != null,
        },
        ip: request.ip,
      });

      const email = await getUserEmail(before.user_id);
      if (email) {
        const { subject, html } = profileTextsReviewedEmail({
          nickname: before.nickname,
          approved: approve,
          notes: parsed.data.notes,
        });
        await sendEmail(email, { subject, html });
      }

      return after;
    },
  );

  // The one way a moderator reads a private conversation. See the migration
  // 20261119090000_moderators_no_direct_message_access.sql for the rules.
  fastify.get<{ Params: { id: string } }>(
    "/admin/reports/:id/conversation",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const { data: report } = await supabaseAdmin
        .from("reports")
        .select("id, content_type, content_id, status")
        .eq("id", request.params.id)
        .maybeSingle();
      if (!report) return reply.code(404).send({ error: "Signalement introuvable" });
      if (report.content_type !== "message") {
        return reply.code(400).send({ error: "Ce signalement ne concerne pas un message" });
      }
      if (!["pending", "reviewed"].includes(report.status)) {
        return reply
          .code(409)
          .send({ error: "Ce signalement est déjà traité : la conversation n’est plus consultable" });
      }

      const { data: reported } = await supabaseAdmin
        .from("messages")
        .select("id, conversation_id, sender_profile_id, recipient_profile_id, content, created_at")
        .eq("id", report.content_id)
        .maybeSingle();
      if (!reported) return reply.code(404).send({ error: "Le message signalé n’existe plus" });

      // A window around the reported message — enough to judge it in context,
      // not the whole history. (created_at, id) is the same total order the
      // members' own message history uses, so ties at a boundary stay in place.
      const CONTEXT = 25;
      const [older, newer] = await Promise.all([
        supabaseAdmin
          .from("messages")
          .select("id, sender_profile_id, content, created_at")
          .eq("conversation_id", reported.conversation_id)
          .or(`created_at.lt.${reported.created_at},and(created_at.eq.${reported.created_at},id.lt.${reported.id})`)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(CONTEXT),
        supabaseAdmin
          .from("messages")
          .select("id, sender_profile_id, content, created_at")
          .eq("conversation_id", reported.conversation_id)
          .or(`created_at.gt.${reported.created_at},and(created_at.eq.${reported.created_at},id.gt.${reported.id})`)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(CONTEXT),
      ]);
      if (older.error || newer.error) {
        request.log.error(older.error ?? newer.error, "Failed to read the reported conversation");
        return reply.code(500).send({ error: "Impossible de charger la conversation" });
      }

      const { data: people } = await supabaseAdmin
        .from("profiles")
        .select("id, nickname")
        .in("id", [reported.sender_profile_id, reported.recipient_profile_id]);

      // Logged before anything is handed over; if it cannot be recorded, nothing
      // is read. The entry says who looked at which report — not what was in it.
      const logged = await writeAuditLog({
        adminUserId: request.user!.id,
        action: "conversation_viewed",
        targetType: "report",
        targetId: report.id,
        ip: request.ip,
      });
      if (!logged) return reply.code(500).send({ error: "Consultation impossible pour le moment" });

      return {
        reportedMessageId: reported.id,
        participants: Object.fromEntries((people ?? []).map((p) => [p.id, p.nickname])),
        messages: [
          ...(older.data ?? []).reverse(),
          { id: reported.id, sender_profile_id: reported.sender_profile_id, content: reported.content, created_at: reported.created_at },
          ...(newer.data ?? []),
        ],
      };
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/admin/photos/:id/moderate",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const parsed = moderatePhotoSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid request",
        });
      }

      const { data: before } = await supabaseAdmin
        .from("profile_photos")
        .select("*, profiles(user_id, nickname)")
        .eq("id", request.params.id)
        .maybeSingle();
      if (!before) {
        return reply.code(404).send({ error: "Photo introuvable" });
      }

      const { data: after, error } = await supabaseAdmin
        .from("profile_photos")
        .update({
          moderation_status: parsed.data.status,
          moderated_by: request.user!.id,
          moderated_at: new Date().toISOString(),
        })
        .eq("id", request.params.id)
        .select()
        .single();
      if (error) {
        request.log.error(error, "Failed to moderate photo");
        return reply.code(500).send({ error: "Échec de la mise à jour" });
      }

      await writeAuditLog({
        adminUserId: request.user!.id,
        action: `photo_${parsed.data.status}`,
        targetType: "photo",
        targetId: request.params.id,
        before: { moderation_status: before.moderation_status },
        after: { moderation_status: after.moderation_status },
        ip: request.ip,
      });

      const profile = before.profiles as {
        user_id: string;
        nickname: string;
      } | null;
      if (parsed.data.status === "rejected" && profile) {
        const email = await getUserEmail(profile.user_id);
        if (email) {
          const { subject, html } = photoRejectedEmail({
            nickname: profile.nickname,
          });
          await sendEmail(email, { subject, html });
        }
      }

      return after;
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/admin/reports/:id/resolve",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const parsed = resolveReportSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid request",
        });
      }

      const { data: before } = await supabaseAdmin
        .from("reports")
        .select("*")
        .eq("id", request.params.id)
        .maybeSingle();
      if (!before) {
        return reply.code(404).send({ error: "Signalement introuvable" });
      }

      const { data: after, error } = await supabaseAdmin
        .from("reports")
        .update({
          status: parsed.data.status,
          admin_notes: parsed.data.adminNotes ?? null,
          reviewed_by: request.user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request.params.id)
        .select()
        .single();
      if (error) {
        request.log.error(error, "Failed to resolve report");
        return reply.code(500).send({ error: "Échec de la mise à jour" });
      }

      await writeAuditLog({
        adminUserId: request.user!.id,
        action: `report_${parsed.data.status}`,
        targetType: "report",
        targetId: request.params.id,
        before: { status: before.status },
        after: { status: after.status },
        ip: request.ip,
      });

      const email = await getUserEmail(before.reporter_id);
      if (email) {
        const { subject, html } = reportResolvedEmail();
        await sendEmail(email, { subject, html });
      }

      return after;
    },
  );

  fastify.post(
    "/admin/subscription-products",
    { preHandler: adminOnlyPreHandler },
    async (request, reply) => {
      const parsed = subscriptionProductSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid request",
        });
      }

      const { data: after, error } = await supabaseAdmin
        .from("subscription_products")
        .insert({
          audience: parsed.data.audience,
          name: parsed.data.name,
          stripe_product_id: parsed.data.stripeProductId ?? null,
          stripe_price_id: parsed.data.stripePriceId ?? null,
          price_amount: parsed.data.priceAmount ?? null,
          currency: parsed.data.currency,
          interval: parsed.data.interval,
          trial_period_days: parsed.data.trialPeriodDays,
          enabled: parsed.data.enabled,
        })
        .select()
        .single();
      if (error) {
        return reply.code(400).send({ error: error.message });
      }

      await writeProductAuditLog({
        adminUserId: request.user!.id,
        action: "subscription_product_created",
        targetId: after.id,
        after,
        ip: request.ip,
      });

      return after;
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    "/admin/subscription-products/:id",
    { preHandler: adminOnlyPreHandler },
    async (request, reply) => {
      const parsed = subscriptionProductSchema
        .partial()
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid request",
        });
      }

      const { data: before } = await supabaseAdmin
        .from("subscription_products")
        .select("*")
        .eq("id", request.params.id)
        .maybeSingle();
      if (!before) {
        return reply.code(404).send({ error: "Produit introuvable" });
      }

      const updates: Database["public"]["Tables"]["subscription_products"]["Update"] =
        {};
      if (parsed.data.audience !== undefined)
        updates.audience = parsed.data.audience;
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.stripeProductId !== undefined)
        updates.stripe_product_id = parsed.data.stripeProductId;
      if (parsed.data.stripePriceId !== undefined)
        updates.stripe_price_id = parsed.data.stripePriceId;
      if (parsed.data.priceAmount !== undefined)
        updates.price_amount = parsed.data.priceAmount;
      if (parsed.data.currency !== undefined)
        updates.currency = parsed.data.currency;
      if (parsed.data.interval !== undefined)
        updates.interval = parsed.data.interval;
      if (parsed.data.trialPeriodDays !== undefined)
        updates.trial_period_days = parsed.data.trialPeriodDays;
      if (parsed.data.enabled !== undefined)
        updates.enabled = parsed.data.enabled;

      const { data: after, error } = await supabaseAdmin
        .from("subscription_products")
        .update(updates)
        .eq("id", request.params.id)
        .select()
        .single();
      if (error) {
        return reply.code(400).send({ error: error.message });
      }

      await writeProductAuditLog({
        adminUserId: request.user!.id,
        action: "subscription_product_updated",
        targetId: request.params.id,
        before,
        after,
        ip: request.ip,
      });

      return after;
    },
  );
}
