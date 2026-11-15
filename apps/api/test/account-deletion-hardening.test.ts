import { after, afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "./helpers/app.js";

// The real API runs inside this process (Stripe mocked, real Supabase), so the
// failures the deletion route has to survive can be injected on purpose.
const inproc = await startApp();
const { admin, api, cleanup, createMember, grantSubscription, uploadPhoto, RUN, BUCKET } = await import("./helpers/world.js");
const { jpeg } = await import("./helpers/images.js");
type Member = Awaited<ReturnType<typeof createMember>>;

const consent = (member: Member, sessionId: string) => ({
  user_id: member.userId,
  stripe_checkout_session_id: sessionId,
  terms_version: "2026-11-15",
  wording_version: "2026-11-15",
  accepted_terms: true,
  waived_withdrawal: true,
});
const userExists = async (member: Member) => Boolean((await admin.auth.admin.getUserById(member.userId)).data.user);
const filesUnder = async (prefix: string) => ((await admin.storage.from(BUCKET).list(prefix)).data ?? []).length;

describe("account deletion survives the failures it can meet", () => {
  afterEach(() => mock.restoreAll());
  after(async () => {
    await cleanup();
    await inproc.close();
  });

  it("stops, and leaves everything, when it cannot read the profile", async () => {
    const member = await createMember({ label: "del-read" });
    const photo = await uploadPhoto(member, await jpeg());
    assert.equal(photo.status, 200);

    // The inventory read fails: "no profile" would be a wrong answer, and
    // carrying on would delete the account and orphan its files.
    const original = inproc.supabaseAdmin.from.bind(inproc.supabaseAdmin);
    const failing: Record<string, unknown> = {};
    failing.select = () => failing;
    failing.eq = () => failing;
    failing.maybeSingle = async () => ({ data: null, error: { message: "injected read failure" } });
    mock.method(inproc.supabaseAdmin, "from", (table: string) => (table === "profiles" ? failing : (original as (t: string) => unknown)(table)));
    const deleteUser = mock.method(inproc.supabaseAdmin.auth.admin, "deleteUser");

    const res = await api(member, "POST", "/gdpr/delete");
    mock.restoreAll();

    assert.equal(res.status, 500);
    assert.equal(deleteUser.mock.callCount(), 0, "the account was not deleted");
    assert.equal(await userExists(member), true);
    assert.equal((await admin.from("profiles").select("id").eq("id", member.profileId)).data!.length, 1);
    assert.equal(await filesUnder(`${member.profileId}/${photo.body.id}`), 2, "photo files untouched");
  });

  it("removes files that no row knows about", async () => {
    const member = await createMember({ label: "del-orphan" });
    const kept = await uploadPhoto(member, await jpeg());
    // What an upload racing the deletion leaves: files written, row not (yet) there.
    const orphan = `${member.profileId}/orphan-${RUN}/display.webp`;
    assert.ifError((await admin.storage.from(BUCKET).upload(orphan, await jpeg(), { contentType: "image/webp" })).error);
    assert.ok(kept.body.id);

    assert.equal((await api(member, "POST", "/gdpr/delete")).status, 200);
    assert.equal(await userExists(member), false);
    assert.equal(await filesUnder(member.profileId), 0, "nothing left under the member's folder");
  });

  it("closes open checkout links and cancels a subscription a checkout created meanwhile", async () => {
    const member = await createMember({ label: "del-checkout" });
    assert.ifError((await admin.from("subscription_consents").insert([consent(member, `cs_open_${RUN}`), consent(member, `cs_done_${RUN}`)])).error);

    const expired: string[] = [];
    const cancelled: string[] = [];
    mock.method(inproc.stripe.checkout.sessions, "retrieve", async (id: string) =>
      id === `cs_open_${RUN}` ? { id, status: "open" } : { id, status: "complete", subscription: `sub_done_${RUN}` }
    );
    mock.method(inproc.stripe.checkout.sessions, "expire", async (id: string) => (expired.push(id), { id }));
    mock.method(inproc.stripe.subscriptions, "retrieve", async (id: string) => ({ id, status: "active" }));
    mock.method(inproc.stripe.subscriptions, "cancel", async (id: string) => (cancelled.push(id), { id }));

    assert.equal((await api(member, "POST", "/gdpr/delete")).status, 200);
    assert.deepEqual(expired, [`cs_open_${RUN}`], "the payable link is closed");
    assert.deepEqual(cancelled, [`sub_done_${RUN}`], "the subscription that was just created is cancelled");
    assert.equal(await userExists(member), false);
    assert.equal((await admin.from("subscription_consents").select("id").eq("user_id", member.userId)).data!.length, 0, "the records go with the account");
  });

  it("puts the account back when a step fails, so nobody is left half-hidden", async () => {
    const member = await createMember({ label: "del-restore" });
    await grantSubscription(member);
    mock.method(inproc.stripe.subscriptions, "cancel", async () => {
      throw Object.assign(new Error("Stripe is unreachable"), { code: "api_connection_error" });
    });

    const res = await api(member, "POST", "/gdpr/delete");
    mock.restoreAll();

    assert.equal(res.status, 502);
    assert.equal(await userExists(member), true);
    const profile = (await admin.from("profiles").select("deleted_at").eq("id", member.profileId).single()).data!;
    assert.equal(profile.deleted_at, null, "visible again");
    const request = (await admin.from("gdpr_requests").select("status").eq("user_id", member.userId).eq("request_type", "delete")).data!;
    assert.deepEqual(request.map((r) => r.status), ["failed"], "recorded as failed, not left 'processing'");
  });

  it("refuses new uploads and checkouts while the account is being closed", async () => {
    const member = await createMember({ label: "del-closed" });
    assert.ifError((await admin.from("profiles").update({ deleted_at: new Date().toISOString() }).eq("id", member.profileId)).error);

    const upload = await uploadPhoto(member, await jpeg());
    assert.equal(upload.status, 409);
    assert.equal(await filesUnder(member.profileId), 0, "nothing stored");

    const checkout = await api(member, "POST", "/stripe/checkout", { acceptTerms: true, waiveWithdrawal: true });
    assert.equal(checkout.status, 409);
    assert.equal((await admin.from("subscription_consents").select("id").eq("user_id", member.userId)).data!.length, 0);
  });
});
