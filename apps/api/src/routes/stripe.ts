import type { FastifyInstance } from "fastify";
import type Stripe from "stripe";
import { env } from "../env.js";
import { stripe } from "../lib/stripe.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { getUserEmail } from "../lib/get-user-email.js";
import { sendEmail } from "../lib/email/send.js";
import {
  subscriptionStartedEmail,
  trialEndingSoonEmail,
  paymentFailedEmail,
  subscriptionCanceledEmail,
} from "../lib/email/templates.js";
import { userRateLimit } from "../lib/user-rate-limit.js";

async function getNicknameAndEmail(userId: string) {
  const [{ data: profile }, email] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("nickname")
      .eq("user_id", userId)
      .maybeSingle(),
    getUserEmail(userId),
  ]);
  if (!profile || !email) return null;
  return { nickname: profile.nickname, email };
}

async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.user_id;
  if (!userId) {
    console.error(
      "Stripe subscription missing user_id metadata",
      subscription.id,
    );
    return;
  }

  const item = subscription.items.data[0];

  const { error } = await supabaseAdmin.from("user_subscriptions").upsert(
    {
      user_id: userId,
      subscription_product_id:
        subscription.metadata.subscription_product_id || null,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      status: subscription.status,
      trial_start: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      current_period_start: item?.current_period_start
        ? new Date(item.current_period_start * 1000).toISOString()
        : null,
      current_period_end: item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: "stripe_subscription_id" },
  );

  // Throw rather than log: the caller is a webhook handler, and swallowing
  // this would tell Stripe the event was handled when the subscription was
  // never written. A thrown error makes the delivery fail and be retried.
  if (error) throw error;
}

// The state of a subscription *now*, not as it was when the event fired.
// Stripe doesn't guarantee delivery order, so projecting an event's own
// snapshot lets a late "updated" overwrite a newer "canceled". Reading the
// current object makes every event converge on the same result whatever order
// they arrive in. (If Stripe no longer has it, the snapshot is all there is.)
async function currentSubscription(snapshot: Stripe.Subscription) {
  try {
    return await stripe.subscriptions.retrieve(snapshot.id);
  } catch (err) {
    if ((err as { code?: string }).code === "resource_missing") return snapshot;
    throw err;
  }
}

type DeferredEmail = () => Promise<unknown>;

// Does the event's real work. Anything that goes wrong throws, so the caller
// can leave the event 'failed' and ask Stripe to redeliver it. Emails are not
// sent here: they are returned and sent only after the event has been marked
// processed, so a retry after a failed projection can't email twice, and a
// slow or failing mail provider can't fail the webhook.
async function processStripeEvent(event: Stripe.Event): Promise<DeferredEmail[]> {
  const emails: DeferredEmail[] = [];
  const emailTo = (userId: string | undefined, build: (who: { nickname: string; email: string }) => { subject: string; html: string }) => {
    if (!userId) return;
    emails.push(async () => {
      const who = await getNicknameAndEmail(userId);
      if (who) await sendEmail(who.email, build(who));
    });
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await upsertSubscriptionFromStripe(subscription);
        const trialEnd = subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null;
        emailTo(subscription.metadata.user_id, (who) =>
          subscriptionStartedEmail({ nickname: who.nickname, trialEnd }),
        );
      }
      break;
    }
    case "customer.subscription.updated": {
      await upsertSubscriptionFromStripe(
        await currentSubscription(event.data.object as Stripe.Subscription),
      );
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = await currentSubscription(event.data.object as Stripe.Subscription);
      await upsertSubscriptionFromStripe(subscription);
      emailTo(subscription.metadata.user_id, (who) =>
        subscriptionCanceledEmail({ nickname: who.nickname }),
      );
      break;
    }
    case "customer.subscription.trial_will_end": {
      // Stripe fires this ~3 days before trial end automatically, no cron
      // needed on our side.
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.trial_end) {
        const trialEnd = new Date(subscription.trial_end * 1000).toISOString();
        emailTo(subscription.metadata.user_id, (who) =>
          trialEndingSoonEmail({ nickname: who.nickname, trialEnd }),
        );
      }
      break;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // current_period_start/end moved onto subscription items and
      // invoice's subscription reference moved under `parent` in a
      // recent Stripe API revision — no longer a top-level field.
      const subscriptionRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId =
        typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscriptionFromStripe(subscription);
        if (event.type === "invoice.payment_failed") {
          emailTo(subscription.metadata.user_id, (who) =>
            paymentFailedEmail({ nickname: who.nickname }),
          );
        }
      }
      break;
    }
    default:
      break;
  }

  return emails;
}

// Checkout + portal — normal JSON bodies, both require a real session.
export async function stripeRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/stripe/checkout",
    {
      preHandler: [
        fastify.requireAuth,
        userRateLimit(fastify, { max: 10, timeWindow: "1 hour" }),
      ],
    },
    async (request, reply) => {
      const db = request.supabase!;

      const { data: myProfile } = await db
        .from("profiles")
        .select("id, gender")
        .eq("user_id", request.user!.id)
        .maybeSingle();
      if (!myProfile) {
        return reply
          .code(403)
          .send({ error: "Créez votre profil avant de vous abonner" });
      }

      const { data: existing } = await db
        .from("user_subscriptions")
        .select("status")
        .eq("user_id", request.user!.id)
        .in("status", ["trialing", "active"])
        .maybeSingle();
      if (existing) {
        return reply
          .code(400)
          .send({ error: "Vous avez déjà un abonnement actif" });
      }

      // enabled=true is the only thing gating this select for other rows too
      // (RLS: "subscription_products select enabled"), so this naturally
      // returns nothing if the paywall is currently off for this audience.
      const { data: product } = await db
        .from("subscription_products")
        .select("*")
        .eq("enabled", true)
        .or(`audience.eq.all,audience.eq.${myProfile.gender}`)
        .limit(1)
        .maybeSingle();
      if (!product || !product.stripe_price_id) {
        return reply
          .code(400)
          .send({ error: "Aucun abonnement disponible actuellement" });
      }

      let customerId: string | undefined;
      const { data: priorSub } = await db
        .from("user_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", request.user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      customerId = priorSub?.stripe_customer_id ?? undefined;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        customer_email: customerId ? undefined : request.user!.email,
        line_items: [{ price: product.stripe_price_id, quantity: 1 }],
        subscription_data: {
          trial_period_days: product.trial_period_days,
          metadata: {
            user_id: request.user!.id,
            subscription_product_id: product.id,
          },
        },
        metadata: {
          user_id: request.user!.id,
          subscription_product_id: product.id,
        },
        success_url: `${env.SITE_URL}/settings?checkout=success`,
        cancel_url: `${env.SITE_URL}/settings?checkout=cancelled`,
      });

      return { url: session.url };
    },
  );

  fastify.post(
    "/stripe/portal",
    {
      preHandler: [
        fastify.requireAuth,
        userRateLimit(fastify, { max: 10, timeWindow: "1 hour" }),
      ],
    },
    async (request, reply) => {
      const db = request.supabase!;

      const { data: sub } = await db
        .from("user_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", request.user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub) {
        return reply.code(404).send({ error: "Aucun abonnement trouvé" });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: `${env.SITE_URL}/settings`,
      });

      return { url: session.url };
    },
  );
}

// Webhook needs the *raw* request body to verify Stripe's signature, so its
// content-type parser is registered in this route's own encapsulated
// Fastify scope — it must not affect JSON parsing anywhere else in the app.
export async function stripeWebhookRoutes(fastify: FastifyInstance) {
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body, done) => {
      done(null, body);
    },
  );

  fastify.post("/stripe/webhook", async (request, reply) => {
    const signature = request.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      return reply.code(400).send({ error: "Missing signature" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      request.log.warn(err, "Stripe webhook signature verification failed");
      return reply.code(400).send({ error: "Invalid signature" });
    }

    // Take the event for processing. Only a duplicate of something already
    // *processed* is acknowledged as such; a database error is not a
    // duplicate and must not be answered with a 200, or the event is lost.
    const { data: claim, error: claimError } = await supabaseAdmin.rpc("claim_webhook_event", {
      p_id: event.id,
      p_type: event.type,
    });
    if (claimError || !claim) {
      request.log.error(claimError, "Failed to record Stripe webhook event");
      return reply.code(500).send({ error: "Could not record event, will retry" });
    }
    if (claim === "duplicate") {
      return reply.code(200).send({ received: true, deduped: true });
    }
    if (claim === "in_progress") {
      // Another delivery is working on it. Not a 2xx: if that one dies, this
      // redelivery is what picks it back up.
      return reply.code(409).send({ error: "Event is being processed" });
    }

    let emails: DeferredEmail[];
    try {
      emails = await processStripeEvent(event);
    } catch (err) {
      request.log.error(err, "Stripe webhook processing failed");
      await supabaseAdmin
        .from("webhook_events")
        .update({ status: "failed", last_error: String((err as Error).message ?? err).slice(0, 500) })
        .eq("id", event.id);
      return reply.code(500).send({ error: "Processing failed, will retry" });
    }

    const { error: markError } = await supabaseAdmin
      .from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString(), last_error: null })
      .eq("id", event.id);
    if (markError) {
      // The work is done and re-running it is harmless (projections are
      // idempotent), so still acknowledge — a stale 'processing' row is
      // taken over by the next delivery, not lost.
      request.log.error(markError, "Failed to mark Stripe webhook event processed");
    }

    // After the event is safely recorded as processed, and without holding up
    // the response: a mail problem must never fail or repeat a webhook.
    for (const send of emails) {
      void send().catch((err) => request.log.error(err, "Stripe webhook email failed"));
    }

    return { received: true };
  });
}
