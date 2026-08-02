import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { getUserEmail } from "../lib/get-user-email.js";
import { sendEmail } from "../lib/email/send.js";
import { profileModeratedEmail, photoRejectedEmail, reportResolvedEmail } from "../lib/email/templates.js";
import type { Database } from "@rencontre/shared";

type Json = Database["public"]["Tables"]["admin_audit_log"]["Insert"]["before"];

const moderateProfileSchema = z.object({
  status: z.enum(["approved", "rejected", "disabled"]),
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

async function writeAuditLog(params: {
  adminUserId: string;
  action: string;
  targetType: "profile" | "photo" | "report" | "subscription" | "user";
  targetId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}) {
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    admin_user_id: params.adminUserId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    before: (params.before as Json) ?? null,
    after: (params.after as Json) ?? null,
    ip_address: params.ip ?? null,
  });
  if (error) console.error("Failed to write admin_audit_log", error);
}

export async function adminRoutes(fastify: FastifyInstance) {
  const adminPreHandler = [fastify.requireAuth, fastify.requireAdmin];

  fastify.post<{ Params: { id: string } }>(
    "/admin/profiles/:id/moderate",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const parsed = moderateProfileSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      }

      const { data: before } = await supabaseAdmin.from("profiles").select("*").eq("id", request.params.id).maybeSingle();
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
        before,
        after,
        ip: request.ip,
      });

      if (parsed.data.status === "approved" || parsed.data.status === "rejected") {
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
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/admin/photos/:id/moderate",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const parsed = moderatePhotoSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
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
        before,
        after,
        ip: request.ip,
      });

      const profile = before.profiles as { user_id: string; nickname: string } | null;
      if (parsed.data.status === "rejected" && profile) {
        const email = await getUserEmail(profile.user_id);
        if (email) {
          const { subject, html } = photoRejectedEmail({ nickname: profile.nickname });
          await sendEmail(email, { subject, html });
        }
      }

      return after;
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/admin/reports/:id/resolve",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const parsed = resolveReportSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      }

      const { data: before } = await supabaseAdmin.from("reports").select("*").eq("id", request.params.id).maybeSingle();
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
        before,
        after,
        ip: request.ip,
      });

      const email = await getUserEmail(before.reporter_id);
      if (email) {
        const { subject, html } = reportResolvedEmail();
        await sendEmail(email, { subject, html });
      }

      return after;
    }
  );

  fastify.post("/admin/subscription-products", { preHandler: adminPreHandler }, async (request, reply) => {
    const parsed = subscriptionProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
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

    await writeAuditLog({
      adminUserId: request.user!.id,
      action: "subscription_product_created",
      targetType: "subscription",
      targetId: after.id,
      after,
      ip: request.ip,
    });

    return after;
  });

  fastify.patch<{ Params: { id: string } }>(
    "/admin/subscription-products/:id",
    { preHandler: adminPreHandler },
    async (request, reply) => {
      const parsed = subscriptionProductSchema.partial().safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      }

      const { data: before } = await supabaseAdmin
        .from("subscription_products")
        .select("*")
        .eq("id", request.params.id)
        .maybeSingle();
      if (!before) {
        return reply.code(404).send({ error: "Produit introuvable" });
      }

      const updates: Database["public"]["Tables"]["subscription_products"]["Update"] = {};
      if (parsed.data.audience !== undefined) updates.audience = parsed.data.audience;
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.stripeProductId !== undefined) updates.stripe_product_id = parsed.data.stripeProductId;
      if (parsed.data.stripePriceId !== undefined) updates.stripe_price_id = parsed.data.stripePriceId;
      if (parsed.data.priceAmount !== undefined) updates.price_amount = parsed.data.priceAmount;
      if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;
      if (parsed.data.interval !== undefined) updates.interval = parsed.data.interval;
      if (parsed.data.trialPeriodDays !== undefined) updates.trial_period_days = parsed.data.trialPeriodDays;
      if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;

      const { data: after, error } = await supabaseAdmin
        .from("subscription_products")
        .update(updates)
        .eq("id", request.params.id)
        .select()
        .single();
      if (error) {
        return reply.code(400).send({ error: error.message });
      }

      await writeAuditLog({
        adminUserId: request.user!.id,
        action: "subscription_product_updated",
        targetType: "subscription",
        targetId: request.params.id,
        before,
        after,
        ip: request.ip,
      });

      return after;
    }
  );
}
