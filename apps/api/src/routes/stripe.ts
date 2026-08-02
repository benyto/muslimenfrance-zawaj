import type { FastifyInstance } from "fastify";
import type Stripe from "stripe";
import { env } from "../env.js";
import { stripe } from "../lib/stripe.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";

async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.user_id;
  if (!userId) {
    console.error("Stripe subscription missing user_id metadata", subscription.id);
    return;
  }

  const item = subscription.items.data[0];

  const { error } = await supabaseAdmin.from("user_subscriptions").upsert(
    {
      user_id: userId,
      subscription_product_id: subscription.metadata.subscription_product_id || null,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      status: subscription.status,
      trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      current_period_start: item?.current_period_start
        ? new Date(item.current_period_start * 1000).toISOString()
        : null,
      current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: "stripe_subscription_id" }
  );

  if (error) {
    console.error("Failed to upsert user_subscriptions from Stripe webhook", error);
  }
}

// Checkout + portal — normal JSON bodies, both require a real session.
export async function stripeRoutes(fastify: FastifyInstance) {
  fastify.post("/stripe/checkout", { preHandler: fastify.requireAuth }, async (request, reply) => {
    const db = request.supabase!;

    const { data: myProfile } = await db.from("profiles").select("id, gender").eq("user_id", request.user!.id).maybeSingle();
    if (!myProfile) {
      return reply.code(403).send({ error: "Créez votre profil avant de vous abonner" });
    }

    const { data: existing } = await db
      .from("user_subscriptions")
      .select("status")
      .eq("user_id", request.user!.id)
      .in("status", ["trialing", "active"])
      .maybeSingle();
    if (existing) {
      return reply.code(400).send({ error: "Vous avez déjà un abonnement actif" });
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
      return reply.code(400).send({ error: "Aucun abonnement disponible actuellement" });
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
        metadata: { user_id: request.user!.id, subscription_product_id: product.id },
      },
      metadata: { user_id: request.user!.id, subscription_product_id: product.id },
      success_url: `${env.SITE_URL}/settings?checkout=success`,
      cancel_url: `${env.SITE_URL}/settings?checkout=cancelled`,
    });

    return { url: session.url };
  });

  fastify.post("/stripe/portal", { preHandler: fastify.requireAuth }, async (request, reply) => {
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
  });
}

// Webhook needs the *raw* request body to verify Stripe's signature, so its
// content-type parser is registered in this route's own encapsulated
// Fastify scope — it must not affect JSON parsing anywhere else in the app.
export async function stripeWebhookRoutes(fastify: FastifyInstance) {
  fastify.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
    done(null, body);
  });

  fastify.post("/stripe/webhook", async (request, reply) => {
    const signature = request.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      return reply.code(400).send({ error: "Missing signature" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(request.body as Buffer, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      request.log.warn(err, "Stripe webhook signature verification failed");
      return reply.code(400).send({ error: "Invalid signature" });
    }

    // Idempotency: Stripe retries aggressively on anything but a fast 2xx.
    // Insert first; a unique-violation means we've already processed this
    // event, so ack without re-running side effects.
    const { error: dedupeError } = await supabaseAdmin
      .from("webhook_events")
      .insert({ id: event.id, type: event.type });
    if (dedupeError) {
      return reply.code(200).send({ received: true, deduped: true });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await upsertSubscriptionFromStripe(subscription);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertSubscriptionFromStripe(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.trial_will_end": {
        // Resend notification wired in Phase 7 — Stripe fires this ~3 days
        // before trial end automatically, no cron needed on our side.
        break;
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // current_period_start/end moved onto subscription items and
        // invoice's subscription reference moved under `parent` in a
        // recent Stripe API revision — no longer a top-level field.
        const subscriptionRef = invoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscriptionFromStripe(subscription);
        }
        break;
      }
      default:
        break;
    }

    return { received: true };
  });
}
