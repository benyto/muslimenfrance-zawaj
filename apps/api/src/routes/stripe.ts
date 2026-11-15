import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { CHECKOUT_WORDING_VERSION, TERMS_VERSION, checkoutConsentSchema } from "@rencontre/shared";
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

// The fields our table mirrors; two reads that agree on these are the same
// state as far as we are concerned.
const stateOf = (subscription: Stripe.Subscription) =>
  JSON.stringify([
    subscription.status,
    subscription.cancel_at_period_end,
    subscription.trial_end,
    subscription.items.data[0]?.current_period_start,
    subscription.items.data[0]?.current_period_end,
  ]);

// Reads the subscription from Stripe and writes it to our table — and then
// checks that what was written is still what Stripe says.
//
// Events are claimed one by one (claim_webhook_event is per event id), so two
// different events about the same subscription can run at the same time: A reads
// "active", B reads "canceled" and writes it, and A then writes "active" over
// it. Nothing here serialises them, so instead each writer re-reads after
// writing and, if Stripe has moved on, writes again. Whoever finishes last has
// read after every other write, so the table ends on the latest state.
// (Bounded: a subscription that keeps changing is picked up by the next event.)
async function projectSubscription(snapshot: Stripe.Subscription) {
  let latest = await currentSubscription(snapshot);
  for (let attempt = 0; attempt < 3; attempt++) {
    await upsertSubscriptionFromStripe(latest);
    const confirmed = await currentSubscription(latest);
    if (stateOf(confirmed) === stateOf(latest)) return confirmed;
    latest = confirmed;
  }
  return latest;
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
        const subscription = await projectSubscription(await stripe.subscriptions.retrieve(session.subscription as string));
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
      await projectSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = await projectSubscription(event.data.object as Stripe.Subscription);
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
        const subscription = await projectSubscription(await stripe.subscriptions.retrieve(subscriptionId));
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

// Shown by Stripe next to the pay button, repeating what the member has just
// ticked in the app. Part of the checkout wording: change it together with
// CHECKOUT_WORDING_VERSION (packages/shared) and the checkboxes in the web app.
const CHECKOUT_NOTICE =
  "En confirmant, vous demandez que votre abonnement commence immédiatement. " +
  "Vous disposez de 14 jours pour vous rétracter ; si vous vous rétractez, vous paierez le service fourni jusqu’à votre demande. " +
  "L’abonnement se renouvelle automatiquement à chaque période jusqu’à sa résiliation, possible à tout moment depuis « Réglages ».";

// A payment link is reused within this window and lives this long (Stripe's
// minimum is 30 minutes).
const CHECKOUT_WINDOW_MS = 30 * 60 * 1000;
const CHECKOUT_LIFETIME_SECONDS = 30 * 60;

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
      // Before anything else — in particular before Stripe is contacted: no
      // checkout without both explicit choices (see checkoutConsentSchema).
      const consent = checkoutConsentSchema.safeParse(request.body);
      if (!consent.success) {
        return reply.code(400).send({
          error: consent.error.issues[0]?.message ?? "Consentement requis pour vous abonner",
        });
      }

      const db = request.supabase!;

      const { data: myProfile, error: profileError } = await db
        .from("profiles")
        .select("id, gender, deleted_at")
        .eq("user_id", request.user!.id)
        .maybeSingle();
      if (profileError) {
        request.log.error(profileError, "Failed to read the profile before checkout");
        return reply.code(500).send({ error: "Impossible de démarrer l’abonnement pour le moment" });
      }
      if (!myProfile) {
        return reply
          .code(403)
          .send({ error: "Créez votre profil avant de vous abonner" });
      }
      // The account is being deleted (see /gdpr/delete): no new subscription.
      if (myProfile.deleted_at) {
        return reply.code(409).send({ error: "Votre compte est en cours de suppression" });
      }

      // A failed read is not "no subscription": carrying on could sell a second
      // subscription to someone who already has one.
      const { data: existing, error: existingError } = await db
        .from("user_subscriptions")
        .select("status")
        .eq("user_id", request.user!.id)
        .in("status", ["trialing", "active"])
        .limit(1)
        .maybeSingle();
      if (existingError) {
        request.log.error(existingError, "Failed to look up the existing subscription before checkout");
        return reply.code(500).send({ error: "Impossible de démarrer l’abonnement pour le moment" });
      }
      if (existing) {
        return reply
          .code(400)
          .send({ error: "Vous avez déjà un abonnement actif" });
      }

      // enabled=true is the only thing gating this select for other rows too
      // (RLS: "subscription_products select enabled"), so this naturally
      // returns nothing if the paywall is currently off for this audience.
      const { data: product, error: productError } = await db
        .from("subscription_products")
        .select("*")
        .eq("enabled", true)
        .or(`audience.eq.all,audience.eq.${myProfile.gender}`)
        .limit(1)
        .maybeSingle();
      if (productError) {
        request.log.error(productError, "Failed to read the subscription product before checkout");
        return reply.code(500).send({ error: "Impossible de démarrer l’abonnement pour le moment" });
      }
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

      // One live payment link per member, not one per click. Two requests (a
      // double click, two tabs, a retry after a lost response) must not each end
      // up with a payable session — both could be paid, and the member would be
      // subscribed, and billed, twice.
      //   - The idempotency key makes a repeat of the same request, within the
      //     same half hour, return the SAME session instead of creating another.
      //     It also covers two requests arriving together: Stripe lets one
      //     through and answers the other with the same result (or a retryable
      //     "in use" error, handled below).
      //   - The session expires after 30 minutes (Stripe's minimum), so an unused
      //     link does not stay payable for a day.
      //   - Any OTHER open session of this member is expired after creating this
      //     one (see below).
      // The key hashes the parameters, so a change in them (say, the member got
      // a Stripe customer in between) means a new key rather than Stripe
      // rejecting a "different request with the same key".
      const params: Stripe.Checkout.SessionCreateParams = {
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
        locale: "fr",
        custom_text: { submit: { message: CHECKOUT_NOTICE } },
        success_url: `${env.SITE_URL}/settings?checkout=success`,
        cancel_url: `${env.SITE_URL}/settings?checkout=cancelled`,
      };
      const slot = Math.floor(Date.now() / CHECKOUT_WINDOW_MS);
      const idempotencyKey = `checkout:${request.user!.id}:${slot}:${createHash("sha256")
        .update(JSON.stringify(params))
        .digest("hex")
        .slice(0, 24)}`;

      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.create(
          { ...params, expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_LIFETIME_SECONDS },
          { idempotencyKey }
        );
      } catch (err) {
        request.log.error(err, "Failed to create the Stripe checkout session");
        // Another request with the same key is still being processed.
        if ((err as { code?: string }).code === "idempotency_key_in_use") {
          return reply.code(409).send({ error: "Un paiement est déjà en cours de préparation, réessayez dans un instant." });
        }
        return reply.code(502).send({ error: "Impossible de démarrer l’abonnement pour le moment. Réessayez dans un instant." });
      }

      // The proof of consent. If it cannot be kept, the member does not get the
      // payment link: better to ask them to retry than to take a subscription
      // we cannot show they agreed to. (The unused session just expires.)
      const { error: consentError } = await supabaseAdmin.from("subscription_consents").insert({
        user_id: request.user!.id,
        subscription_product_id: product.id,
        stripe_checkout_session_id: session.id,
        terms_version: TERMS_VERSION,
        wording_version: CHECKOUT_WORDING_VERSION,
        accepted_terms: true,
        waived_withdrawal: true,
      });
      // 23505: the same session again (an idempotent repeat) — already recorded.
      if (consentError && consentError.code !== "23505") {
        request.log.error(consentError, "Failed to record subscription consent");
        await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
        return reply.code(500).send({ error: "Impossible de démarrer l’abonnement pour le moment. Réessayez dans un instant." });
      }

      // Close every other payment link this member still has open, so only the
      // one just returned can be paid. Best effort: failing to close an old link
      // must not fail this request (the new link is fine), and every link
      // expires on its own within 30 minutes anyway.
      const { data: earlier } = await supabaseAdmin
        .from("subscription_consents")
        .select("stripe_checkout_session_id")
        .eq("user_id", request.user!.id)
        .neq("stripe_checkout_session_id", session.id)
        .order("created_at", { ascending: false })
        .limit(5);
      for (const { stripe_checkout_session_id: oldId } of earlier ?? []) {
        try {
          const old = await stripe.checkout.sessions.retrieve(oldId);
          if (old.status === "open") await stripe.checkout.sessions.expire(oldId);
        } catch (err) {
          request.log.warn(err, "Could not close an earlier checkout session");
        }
      }

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
