import { after, afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { IN_PROCESS_WEBHOOK_SECRET, startApp } from "./helpers/app.js";

// Webhook handling with Stripe replaced by a controllable fake, so the paths
// that read the subscription back from Stripe — which the signature/claim tests
// deliberately skip — can be driven, including two events racing.
const inproc = await startApp();
const { admin, cleanup, createMember, RUN, trackWebhookEvent } = await import("./helpers/world.js");

const signer = new Stripe("sk_test_signer_only");
let counter = 0;
const eventId = () => trackWebhookEvent(`evt_test_${RUN}_proj_${++counter}`);

const post = (event: object) => {
  const body = JSON.stringify(event);
  const signature = signer.webhooks.generateTestHeaderString({ payload: body, secret: IN_PROCESS_WEBHOOK_SECRET });
  return fetch(`${inproc.url}/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": signature },
    body,
  });
};

const subscription = (id: string, userId: string, status: string) => ({
  id,
  object: "subscription",
  customer: `cus_test_${RUN}`,
  status,
  metadata: { user_id: userId },
  trial_start: null,
  trial_end: null,
  cancel_at_period_end: false,
  items: { data: [{ current_period_start: 1_800_000_000, current_period_end: 1_802_592_000 }] },
});

const updated = (id: string, object: object) => ({
  id,
  object: "event",
  api_version: "2025-01-01",
  created: Math.floor(Date.now() / 1000),
  type: "customer.subscription.updated",
  data: { object },
  livemode: false,
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
});

const rowOf = async (subscriptionId: string) =>
  (await admin.from("user_subscriptions").select("status, user_id").eq("stripe_subscription_id", subscriptionId).maybeSingle()).data;
const eventRow = async (id: string) => (await admin.from("webhook_events").select("status, attempts").eq("id", id).single()).data!;

describe("webhook projection of a subscription", () => {
  afterEach(() => mock.restoreAll());
  after(async () => {
    await cleanup();
    await inproc.close();
  });

  it("writes what Stripe currently says, not what the event carried", async () => {
    const member = await createMember({ label: "proj-current" });
    const id = `sub_test_${RUN}_current`;
    mock.method(inproc.stripe.subscriptions, "retrieve", async () => subscription(id, member.userId, "active"));

    // The event is stale ("incomplete"); Stripe says active.
    const res = await post(updated(eventId(), subscription(id, member.userId, "incomplete")));
    assert.equal(res.status, 200);
    assert.equal((await rowOf(id))!.status, "active");
  });

  it("converges when two events about one subscription are processed at the same time", async () => {
    const member = await createMember({ label: "proj-race" });
    const id = `sub_test_${RUN}_race`;

    // Event A reads the subscription as "active" — but its answer only arrives
    // after event B has read "canceled" and finished writing it. Left alone, A
    // would then write its out-of-date "active" over B's newer state.
    let reads = 0;
    let stripeSays = "active";
    let releaseA!: () => void;
    const gateA = new Promise<void>((resolve) => (releaseA = resolve));
    mock.method(inproc.stripe.subscriptions, "retrieve", async () => {
      reads += 1;
      if (reads === 1) {
        await gateA;
        return subscription(id, member.userId, "active"); // the stale read
      }
      return subscription(id, member.userId, stripeSays);
    });

    const a = post(updated(eventId(), subscription(id, member.userId, "active")));
    while (reads < 1) await new Promise((resolve) => setTimeout(resolve, 20));

    stripeSays = "canceled"; // the subscription is cancelled while A is still waiting
    const b = await post(updated(eventId(), subscription(id, member.userId, "canceled")));
    assert.equal(b.status, 200);
    assert.equal((await rowOf(id))!.status, "canceled");

    releaseA();
    assert.equal((await a).status, 200);
    assert.equal((await rowOf(id))!.status, "canceled", "A's stale read did not stick");
  });

  it("answers 5xx and writes nothing when Stripe cannot be read, then succeeds on redelivery", async () => {
    const member = await createMember({ label: "proj-retry" });
    const id = `sub_test_${RUN}_retry`;
    const evt = eventId();
    let first = true;
    mock.method(inproc.stripe.subscriptions, "retrieve", async () => {
      if (first) {
        first = false;
        throw Object.assign(new Error("Stripe is down"), { code: "api_connection_error" });
      }
      return subscription(id, member.userId, "active");
    });

    const failed = await post(updated(evt, subscription(id, member.userId, "active")));
    assert.equal(failed.status, 500);
    assert.equal(await rowOf(id), null, "nothing half-written");
    assert.equal((await eventRow(evt)).status, "failed");

    const redelivered = await post(updated(evt, subscription(id, member.userId, "active")));
    assert.equal(redelivered.status, 200);
    assert.equal((await rowOf(id))!.status, "active");
    assert.deepEqual(await eventRow(evt), { status: "processed", attempts: 2 });
  });
});
