import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { env } from "./helpers/env.js";
import { admin, cleanup, createMember, RUN, trackWebhookEvent, type Member } from "./helpers/world.js";

// Only events that never call back to Stripe are driven end to end here — the
// ones that read the subscription from Stripe need the real API. What is
// covered instead is everything around them: signature checks, the
// claim/retry state machine, and idempotency.
const stripe = new Stripe("sk_test_unused");
let counter = 0;
const eventId = () => trackWebhookEvent(`evt_test_${RUN}_${++counter}`);

function post(payload: object, { signed = true, secret = env.webhookSecret }: { signed?: boolean; secret?: string } = {}) {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signed) headers["Stripe-Signature"] = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  return fetch(`${env.apiUrl}/stripe/webhook`, { method: "POST", headers, body });
}

const event = (id: string, type: string, object: object = {}) => ({
  id,
  object: "event",
  api_version: "2025-01-01",
  created: Math.floor(Date.now() / 1000),
  type,
  data: { object },
  livemode: false,
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
});

const status = async (id: string) =>
  (await admin.from("webhook_events").select("status, attempts, processed_at, last_error").eq("id", id).single()).data;

describe("POST /stripe/webhook", { skip: !env.webhookSecret && "set TEST_STRIPE_WEBHOOK_SECRET (same value as the API's STRIPE_WEBHOOK_SECRET)" }, () => {
  let member: Member;
  before(async () => {
    member = await createMember({ label: "wh" });
  });
  after(cleanup);

  it("rejects a request with no signature, or a wrong one", async () => {
    const id = eventId();
    assert.equal((await post(event(id, "ping"), { signed: false })).status, 400);
    assert.equal((await post(event(id, "ping"), { secret: "whsec_wrong" })).status, 400);
    assert.equal(await status(id), null, "nothing recorded for an unverified request");
  });

  it("processes an event once and acknowledges a repeat without redoing it", async () => {
    const id = eventId();
    const first = await post(event(id, "customer.subscription.trial_will_end", {
      id: "sub_x",
      object: "subscription",
      metadata: { user_id: member.userId },
      trial_end: Math.floor(Date.now() / 1000) + 3 * 86400,
    }));
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { received: true });
    const afterFirst = await status(id);
    assert.equal(afterFirst!.status, "processed");
    assert.ok(afterFirst!.processed_at);

    const again = await post(event(id, "customer.subscription.trial_will_end", {}));
    assert.equal(again.status, 200);
    assert.deepEqual(await again.json(), { received: true, deduped: true });
    assert.equal((await status(id))!.attempts, 1);
  });

  it("acknowledges event types it does not act on", async () => {
    const id = eventId();
    assert.equal((await post(event(id, "customer.created"))).status, 200);
    assert.equal((await status(id))!.status, "processed");
  });

  it("is not throttled by the per-IP limit", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => post(event(eventId(), "customer.created"))));
    assert.ok(results.every((r) => r.status === 200));
  });
});

describe("claim_webhook_event", () => {
  after(cleanup);
  const claim = async (id: string, staleSeconds?: number) => {
    const { data, error } = await admin.rpc("claim_webhook_event", {
      p_id: id,
      p_type: "test",
      ...(staleSeconds !== undefined ? { p_stale_seconds: staleSeconds } : {}),
    });
    assert.ifError(error);
    return data;
  };

  it("hands a new event to exactly one of several simultaneous deliveries", async () => {
    const id = eventId();
    const results = await Promise.all(Array.from({ length: 6 }, () => claim(id)));
    assert.equal(results.filter((r) => r === "claimed").length, 1);
    assert.equal(results.filter((r) => r === "in_progress").length, 5);
  });

  it("lets a failed event be taken again, and drops it once processed", async () => {
    const id = eventId();
    assert.equal(await claim(id), "claimed");
    await admin.from("webhook_events").update({ status: "failed", last_error: "boom" }).eq("id", id);
    assert.equal(await claim(id), "claimed", "redelivery after a failure is processed again");
    assert.equal((await status(id))!.attempts, 2);

    await admin.from("webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", id);
    assert.equal(await claim(id), "duplicate");
  });

  it("takes over an attempt that died mid-way, but not one still running", async () => {
    const id = eventId();
    assert.equal(await claim(id), "claimed");
    assert.equal(await claim(id), "in_progress");
    await admin
      .from("webhook_events")
      .update({ processing_started_at: new Date(Date.now() - 10 * 60_000).toISOString() })
      .eq("id", id);
    assert.equal(await claim(id), "claimed");
  });

  it("is not callable by members", async () => {
    const m = await createMember({ label: "wh-client" });
    const res = await m.client.rpc("claim_webhook_event", { p_id: "x", p_type: "x" });
    assert.ok(res.error);
  });
});
