import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "./helpers/app.js";
import { isLocal } from "./helpers/env.js";

// A member gets ONE payable link, however many times they ask. Needs a paid plan
// switched on, which on a shared database would turn the paywall on for everyone,
// so — like the paywall test — it only runs against a local stack (CI).
const inproc = await startApp();
// File level, not inside the suite: a skipped suite runs no hooks, and an
// open server would keep this process alive forever.
after(() => inproc.close());
const { admin, api, cleanup, createMember, grantSubscription, RUN } = await import("./helpers/world.js");
type Member = Awaited<ReturnType<typeof createMember>>;

const BODY = { acceptTerms: true, waiveWithdrawal: true };
type CreateCall = { params: Record<string, any>; options?: { idempotencyKey?: string } };

describe("checkout payment links", { skip: !isLocal && "would switch the paywall on for a shared database" }, () => {
  let original: { id: string; enabled: boolean; stripe_price_id: string | null; trial_period_days: number } | null = null;
  let productId: string;
  const creates: CreateCall[] = [];
  const open = new Set<string>();
  const expired: string[] = [];

  const sessionsOf = async (member: Member) =>
    ((await admin.from("subscription_consents").select("stripe_checkout_session_id").eq("user_id", member.userId)).data ?? []).map((r) => r.stripe_checkout_session_id);

  before(async () => {
    // `audience` is unique: switch the existing row on (or create one) and put it back after.
    const { data } = await admin.from("subscription_products").select("id, enabled, stripe_price_id, trial_period_days").eq("audience", "all").maybeSingle();
    original = data;
    if (data) {
      productId = data.id;
      assert.ifError((await admin.from("subscription_products").update({ enabled: true, stripe_price_id: "price_test_links", trial_period_days: 7 }).eq("id", data.id)).error);
    } else {
      const inserted = await admin.from("subscription_products").insert({ audience: "all", name: "test", enabled: true, stripe_price_id: "price_test_links" }).select("id").single();
      assert.ifError(inserted.error);
      productId = inserted.data!.id;
    }
  });

  afterEach(() => {
    mock.restoreAll();
    creates.length = 0;
    open.clear();
    expired.length = 0;
  });

  after(async () => {
    if (original) await admin.from("subscription_products").update({ enabled: original.enabled, stripe_price_id: original.stripe_price_id, trial_period_days: original.trial_period_days }).eq("id", original.id);
    else if (productId) await admin.from("subscription_products").delete().eq("id", productId);
    await cleanup();
  });

  // Stripe as it behaves for an idempotency key: the same key returns the same session.
  const fakeStripe = (failWith?: Error) => {
    const byKey = new Map<string, { id: string; url: string }>();
    mock.method(inproc.stripe.checkout.sessions, "create", async (params: Record<string, any>, options?: { idempotencyKey?: string }) => {
      creates.push({ params, options });
      if (failWith) throw failWith;
      const key = options?.idempotencyKey ?? `no-key-${creates.length}`;
      if (!byKey.has(key)) {
        const id = `cs_test_${RUN}_${byKey.size + 1}_${Math.random().toString(36).slice(2, 7)}`;
        byKey.set(key, { id, url: `https://checkout.test/${id}` });
        open.add(id);
      }
      return byKey.get(key)!;
    });
    mock.method(inproc.stripe.checkout.sessions, "retrieve", async (id: string) => ({ id, status: open.has(id) ? "open" : "expired" }));
    mock.method(inproc.stripe.checkout.sessions, "expire", async (id: string) => {
      expired.push(id);
      open.delete(id);
      return { id, status: "expired" };
    });
  };

  it("returns the same link when the member asks again", async () => {
    const member = await createMember({ label: "link-same" });
    fakeStripe();
    const first = await api(member, "POST", "/stripe/checkout", BODY);
    const second = await api(member, "POST", "/stripe/checkout", BODY);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(first.body.url, second.body.url, "one payable link, not two");
    assert.equal(creates[0].options?.idempotencyKey, creates[1].options?.idempotencyKey);
    assert.ok(creates[0].options?.idempotencyKey);
    assert.equal((await sessionsOf(member)).length, 1, "the proof of consent is recorded once");
  });

  it("asks for a short-lived French checkout with the withdrawal notice", async () => {
    const member = await createMember({ label: "link-params" });
    fakeStripe();
    assert.equal((await api(member, "POST", "/stripe/checkout", BODY)).status, 200);
    const { params } = creates[0];
    const lifetime = params.expires_at - Math.floor(Date.now() / 1000);
    assert.ok(lifetime > 25 * 60 && lifetime <= 30 * 60, `expires in ${lifetime}s`);
    assert.equal(params.locale, "fr");
    assert.match(params.custom_text.submit.message, /14 jours/);
    assert.equal(params.metadata.user_id, member.userId);
  });

  it("closes the member's other open links, so only the newest can be paid", async () => {
    const member = await createMember({ label: "link-others" });
    fakeStripe();
    const older = `cs_test_${RUN}_older`;
    open.add(older);
    assert.ifError(
      (await admin.from("subscription_consents").insert({ user_id: member.userId, stripe_checkout_session_id: older, terms_version: "2026-11-15", wording_version: "2026-11-15", accepted_terms: true, waived_withdrawal: true })).error
    );

    const res = await api(member, "POST", "/stripe/checkout", BODY);
    assert.equal(res.status, 200);
    assert.deepEqual(expired, [older], "the earlier link is closed");
    assert.equal(open.has(older), false);
    assert.ok([...open].some((id) => res.body.url.endsWith(id)), "the one just returned is still open");
  });

  it("does not sell a second subscription to someone who has one", async () => {
    const member = await createMember({ label: "link-has" });
    await grantSubscription(member);
    fakeStripe();
    const res = await api(member, "POST", "/stripe/checkout", BODY);
    assert.equal(res.status, 400);
    assert.equal(creates.length, 0, "Stripe was not even asked");
  });

  it("reports a Stripe failure plainly and records nothing", async () => {
    const member = await createMember({ label: "link-fail" });
    fakeStripe(Object.assign(new Error("Stripe is down"), { code: "api_connection_error" }));
    assert.equal((await api(member, "POST", "/stripe/checkout", BODY)).status, 502);
    assert.equal((await sessionsOf(member)).length, 0);
  });

  it("tells the client to retry when an identical request is still in flight", async () => {
    const member = await createMember({ label: "link-busy" });
    fakeStripe(Object.assign(new Error("in use"), { code: "idempotency_key_in_use" }));
    assert.equal((await api(member, "POST", "/stripe/checkout", BODY)).status, 409);
    assert.equal((await sessionsOf(member)).length, 0);
  });
});
