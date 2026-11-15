import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { CHECKOUT_WORDING_VERSION, TERMS_VERSION, checkoutConsentSchema } from "@rencontre/shared";
import { admin, api, cleanup, createMember, RUN, type Member } from "./helpers/world.js";

// Creating a real Checkout session needs a working Stripe account, so what is
// covered here is everything around it: that nothing proceeds without both
// explicit choices, who can touch the proof, and what happens to it.
describe("checkout consent", () => {
  let member: Member;
  const consentRows = async () =>
    (await admin.from("subscription_consents").select("id").eq("user_id", member.userId)).data ?? [];

  before(async () => {
    member = await createMember({ label: "checkout" });
  });
  after(cleanup);

  it("needs both choices to be an explicit true", () => {
    const ok = { acceptTerms: true, waiveWithdrawal: true };
    assert.equal(checkoutConsentSchema.safeParse(ok).success, true);
    for (const bad of [
      {},
      { acceptTerms: true },
      { waiveWithdrawal: true },
      { acceptTerms: true, waiveWithdrawal: false },
      { acceptTerms: false, waiveWithdrawal: true },
      { acceptTerms: "true", waiveWithdrawal: "true" },
      { acceptTerms: 1, waiveWithdrawal: 1 },
      { acceptTerms: null, waiveWithdrawal: null },
    ]) {
      assert.equal(checkoutConsentSchema.safeParse(bad).success, false, JSON.stringify(bad));
    }
  });

  it("is refused by the API without both, before anything else happens", async () => {
    assert.equal((await api(null, "POST", "/stripe/checkout", { acceptTerms: true, waiveWithdrawal: true })).status, 401);
    for (const body of [{}, { acceptTerms: true }, { waiveWithdrawal: true }, { acceptTerms: true, waiveWithdrawal: false }]) {
      const res = await api(member, "POST", "/stripe/checkout", body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.match(res.body.error, /accepter|demander/);
    }
    assert.equal((await consentRows()).length, 0, "nothing recorded for a refused request");
  });

  it("records nothing when no subscription could be started", async () => {
    // Both choices given, but with the paywall off there is nothing to subscribe to.
    const res = await api(member, "POST", "/stripe/checkout", { acceptTerms: true, waiveWithdrawal: true });
    assert.ok([400, 500, 502].includes(res.status), `status ${res.status}`);
    assert.equal((await consentRows()).length, 0);
  });

  it("states which wording was agreed to", () => {
    assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(CHECKOUT_WORDING_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("cannot be read or written by members, only by the server", async () => {
    const row = {
      user_id: member.userId,
      stripe_checkout_session_id: `cs_test_${RUN}_member`,
      terms_version: TERMS_VERSION,
      wording_version: CHECKOUT_WORDING_VERSION,
      accepted_terms: true,
      waived_withdrawal: true,
    };
    assert.ok((await member.client.from("subscription_consents").insert(row)).error, "insert refused");
    assert.ok((await member.client.from("subscription_consents").select("*")).error, "read refused");
  });

  it("refuses a record that does not carry both consents", async () => {
    const base = {
      user_id: member.userId,
      terms_version: TERMS_VERSION,
      wording_version: CHECKOUT_WORDING_VERSION,
    };
    assert.ok((await admin.from("subscription_consents").insert({ ...base, stripe_checkout_session_id: `cs_test_${RUN}_a`, accepted_terms: false, waived_withdrawal: true })).error);
    assert.ok((await admin.from("subscription_consents").insert({ ...base, stripe_checkout_session_id: `cs_test_${RUN}_b`, accepted_terms: true, waived_withdrawal: false })).error);
  });

  it("is part of the member's data export, and removed with the account", async () => {
    const insert = await admin.from("subscription_consents").insert({
      user_id: member.userId,
      stripe_checkout_session_id: `cs_test_${RUN}_export`,
      terms_version: TERMS_VERSION,
      wording_version: CHECKOUT_WORDING_VERSION,
      accepted_terms: true,
      waived_withdrawal: true,
    });
    assert.ifError(insert.error);

    const exported = await api(member, "POST", "/gdpr/export");
    assert.equal(exported.status, 200);
    assert.equal(exported.body.subscriptionConsents.length, 1);
    assert.equal(exported.body.subscriptionConsents[0].terms_version, TERMS_VERSION);

    assert.equal((await api(member, "POST", "/gdpr/delete")).status, 200);
    assert.equal((await consentRows()).length, 0, "erased with the account");
  });
});
