import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SPECIAL_CATEGORY_CONSENT_TEXT,
  SPECIAL_CATEGORY_CONSENT_VERSION,
  hasCurrentSpecialCategoryConsent,
  needsSpecialCategoryReconsent,
} from "@rencontre/shared";
import { admin, api, cleanup, createMember, type Member } from "./helpers/world.js";

describe("special-category consent: the rules the app applies", () => {
  const profile = (over: object) => ({
    special_category_consent: true,
    special_category_consent_version: null as string | null,
    ethnicity: "Kabyle" as string | null,
    ...over,
  });

  it("names every kind of sensitive data the profile holds", () => {
    for (const word of ["religion", "pratique religieuse", "origine ethnique", "visibles des autres membres"]) {
      assert.ok(SPECIAL_CATEGORY_CONSENT_TEXT.includes(word), `wording lacks "${word}"`);
    }
  });

  it("asks members who agreed to an older wording and hold ethnicity", () => {
    assert.equal(needsSpecialCategoryReconsent(profile({})), true);
    assert.equal(needsSpecialCategoryReconsent(profile({ special_category_consent_version: "2025-01-01" })), true);
  });

  it("does not ask when there is nothing newly covered, or it was already accepted", () => {
    assert.equal(needsSpecialCategoryReconsent(profile({ ethnicity: null })), false);
    assert.equal(needsSpecialCategoryReconsent(profile({ ethnicity: "  " })), false);
    assert.equal(needsSpecialCategoryReconsent(profile({ special_category_consent_version: SPECIAL_CATEGORY_CONSENT_VERSION })), false);
    assert.equal(needsSpecialCategoryReconsent(profile({ special_category_consent_version: "2099-01-01" })), false);
    assert.equal(needsSpecialCategoryReconsent(profile({ special_category_consent: false })), false, "never consented: the form asks");
  });

  it("counts a consent as current only with the current version", () => {
    assert.equal(hasCurrentSpecialCategoryConsent({ special_category_consent: true, special_category_consent_version: null }), false);
    assert.equal(hasCurrentSpecialCategoryConsent({ special_category_consent: true, special_category_consent_version: SPECIAL_CATEGORY_CONSENT_VERSION }), true);
    assert.equal(hasCurrentSpecialCategoryConsent({ special_category_consent: false, special_category_consent_version: SPECIAL_CATEGORY_CONSENT_VERSION }), false);
  });
});

describe("special-category consent: the database", () => {
  let owner: Member, viewer: Member;
  const ethnicityAsSeenBy = async (who: Member) => {
    const { data, error } = await who.client.rpc("get_profile_detail", { p_profile_id: owner.profileId });
    assert.ifError(error);
    return { ethnicity: data[0].ethnicity as string | null, religion: data[0].religion as string | null };
  };

  before(async () => {
    owner = await createMember({ label: "consent-owner", ethnicity: "Kabyle", religion: "islam" });
    viewer = await createMember({ label: "consent-viewer" });
  });
  after(cleanup);

  it("keeps ethnicity from other members until the new wording is accepted — and shows the rest", async () => {
    assert.deepEqual(await ethnicityAsSeenBy(viewer), { ethnicity: null, religion: "islam" });
    const kept = await admin.from("profiles").select("ethnicity").eq("id", owner.profileId).single();
    assert.equal(kept.data!.ethnicity, "Kabyle", "hidden, not deleted");
  });

  it("an older version does not unlock it", async () => {
    await admin.from("profiles").update({ special_category_consent_version: "2025-01-01" }).eq("id", owner.profileId);
    assert.equal((await ethnicityAsSeenBy(viewer)).ethnicity, null);
  });

  it("records the acceptance — version and time — when the member accepts", async () => {
    const before = Date.now();
    assert.ifError((await owner.client.rpc("record_special_category_consent", { p_version: SPECIAL_CATEGORY_CONSENT_VERSION })).error);
    const row = (await admin.from("profiles").select("special_category_consent, special_category_consent_version, special_category_consent_at").eq("id", owner.profileId).single()).data!;
    assert.equal(row.special_category_consent, true);
    assert.equal(row.special_category_consent_version, SPECIAL_CATEGORY_CONSENT_VERSION);
    assert.ok(new Date(row.special_category_consent_at!).getTime() >= before - 5000, "stamped now by the server");
    assert.deepEqual(await ethnicityAsSeenBy(viewer), { ethnicity: "Kabyle", religion: "islam" });
  });

  it("only takes a sensible version", async () => {
    for (const bad of ["", "yesterday", "2026-13", "9999-12-31"]) {
      assert.ok((await owner.client.rpc("record_special_category_consent", { p_version: bad })).error, `"${bad}" must be refused`);
    }
  });

  it("cannot be written from the browser", async () => {
    for (const patch of [{ special_category_consent_version: "2099-01-01" }, { special_category_consent_at: new Date().toISOString() }]) {
      const { error } = await owner.client.from("profiles").update(patch).eq("id", owner.profileId);
      assert.ok(error, `${Object.keys(patch)[0]} must be refused`);
    }
    // …nor is it a way to fabricate consent for someone else.
    assert.ok((await viewer.client.rpc("record_special_category_consent", { p_version: "2026-11-15" })).error === null);
    const theirs = await admin.from("profiles").select("special_category_consent_version").eq("id", owner.profileId).single();
    assert.equal(theirs.data!.special_category_consent_version, SPECIAL_CATEGORY_CONSENT_VERSION, "unchanged by someone else's call");
  });

  it("still lets members edit anything else, and remove the data themselves", async () => {
    assert.ifError((await owner.client.from("profiles").update({ height: 172 }).eq("id", owner.profileId)).error);
    assert.ifError((await owner.client.from("profiles").update({ ethnicity: null }).eq("id", owner.profileId)).error);
    assert.equal((await ethnicityAsSeenBy(viewer)).ethnicity, null);
  });

  it("is in the member's data export", async () => {
    const res = await api(owner, "POST", "/gdpr/export");
    assert.equal(res.status, 200);
    assert.equal(res.body.profile.special_category_consent_version, SPECIAL_CATEGORY_CONSENT_VERSION);
  });

  it("is not callable without a session", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const { env } = await import("./helpers/env.js");
    const anon = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
    assert.ok((await anon.rpc("record_special_category_consent", { p_version: "2026-11-15" })).error);
  });
});
