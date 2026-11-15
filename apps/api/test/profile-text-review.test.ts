import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { admin, anonymousClient, api, cleanup, createMember, signPhoto, uploadPhoto, type Member } from "./helpers/world.js";
import { jpeg } from "./helpers/images.js";

// What another member sees of a profile: the live text only.
const seenBy = async (viewer: Member, profileId: string) => {
  const { data, error } = await viewer.client.rpc("get_profile_detail", { p_profile_id: profileId });
  assert.ifError(error);
  assert.equal(data.length, 1, "profile is visible");
  return { bio: data[0].bio as string | null, lookingFor: data[0].looking_for as string | null };
};

const rowOf = async (profileId: string) =>
  (await admin.from("profiles").select("bio, looking_for, bio_pending, looking_for_pending, text_review_version").eq("id", profileId).single()).data!;

const save = (member: Member, bio: string, lookingFor: string) =>
  member.client.rpc("submit_profile_texts", { p_bio: bio, p_looking_for: lookingFor });

describe("editing the text of an approved profile", () => {
  let author: Member, viewer: Member, moderator: Member;

  before(async () => {
    author = await createMember({ label: "txt-author", bio: "Bio approuvée", lookingFor: "Recherche approuvée" });
    viewer = await createMember({ label: "txt-viewer" });
    moderator = await createMember({ label: "txt-mod", role: "moderator" });
  });
  after(cleanup);

  const review = (member: Member | null, body: object, profileId = author.profileId) =>
    api(member, "POST", `/admin/profiles/${profileId}/texts/review`, body);

  it("cannot be done by writing to the table directly", async () => {
    for (const patch of [
      { bio: "sneaky" },
      { looking_for: "sneaky" },
      { bio_pending: "sneaky" },
      { looking_for_pending: "sneaky" },
      { text_review_version: 99 },
    ]) {
      const { error } = await author.client.from("profiles").update(patch).eq("id", author.profileId);
      assert.ok(error, `${Object.keys(patch)[0]} must be refused`);
    }
    assert.deepEqual(await rowOf(author.profileId), {
      bio: "Bio approuvée",
      looking_for: "Recherche approuvée",
      bio_pending: null,
      looking_for_pending: null,
      text_review_version: 0,
    });
  });

  it("does not get in the way of editing everything else", async () => {
    const { error } = await author.client.from("profiles").update({ height: 175 }).eq("id", author.profileId);
    assert.ifError(error);
  });

  it("is held for review while the profile keeps showing its approved text", async () => {
    assert.ifError((await save(author, "Nouvelle présentation", "Nouvelle recherche")).error);

    assert.deepEqual(await seenBy(viewer, author.profileId), { bio: "Bio approuvée", lookingFor: "Recherche approuvée" });
    const mine = await rowOf(author.profileId);
    assert.equal(mine.bio_pending, "Nouvelle présentation");
    assert.equal(mine.looking_for_pending, "Nouvelle recherche");
    assert.equal(mine.text_review_version, 1);

    // The author can read their own pending text back (the form shows it)…
    const own = await author.client.from("profiles").select("bio_pending").eq("id", author.profileId).single();
    assert.equal(own.data!.bio_pending, "Nouvelle présentation");
    // …and nobody else can read the profile row at all.
    const other = await viewer.client.from("profiles").select("bio_pending").eq("id", author.profileId);
    assert.deepEqual(other.data, []);
  });

  it("does not count saving the same text again as a new edit", async () => {
    await save(author, "Nouvelle présentation", "Nouvelle recherche");
    await save(author, "  Nouvelle présentation  ", "Nouvelle recherche");
    assert.equal((await rowOf(author.profileId)).text_review_version, 1);
  });

  it("shows up in the moderators' list, and only theirs", async () => {
    const { data, error } = await moderator.client.rpc("admin_search_profiles", { p_status: "texts_pending", p_limit: 100 });
    assert.ifError(error);
    const mine = data.find((row: { id: string }) => row.id === author.profileId);
    assert.ok(mine, "listed");
    assert.equal(mine.has_pending_texts, true);
    assert.ok(data.every((row: { has_pending_texts: boolean }) => row.has_pending_texts));
    assert.ok((await viewer.client.rpc("admin_search_profiles", { p_status: "texts_pending" })).error, "members cannot use it");
  });

  it("is included in the member's data export", async () => {
    const res = await api(author, "POST", "/gdpr/export");
    assert.equal(res.status, 200);
    assert.equal(res.body.profile.bio_pending, "Nouvelle présentation");
    assert.equal(res.body.profile.looking_for_pending, "Nouvelle recherche");
  });

  it("only moderators can decide", async () => {
    const body = { decision: "approved", version: 1 };
    assert.equal((await review(null, body)).status, 401);
    assert.equal((await review(viewer, body)).status, 403);
    assert.equal((await review(author, body)).status, 403, "not even for your own profile");
    assert.equal((await review(moderator, { decision: "maybe", version: 1 })).status, 400);
    assert.equal((await review(moderator, body, "00000000-0000-4000-8000-000000000000")).status, 404);
    assert.equal((await rowOf(author.profileId)).bio_pending, "Nouvelle présentation", "nothing changed");
  });

  it("rejecting discards the edit and leaves the approved text", async () => {
    const res = await review(moderator, { decision: "rejected", version: 1, notes: "Contact <b>externe</b>" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(await rowOf(author.profileId), {
      bio: "Bio approuvée",
      looking_for: "Recherche approuvée",
      bio_pending: null,
      looking_for_pending: null,
      text_review_version: 1,
    });
    assert.deepEqual(await seenBy(viewer, author.profileId), { bio: "Bio approuvée", lookingFor: "Recherche approuvée" });

    const { data: audit } = await admin.from("admin_audit_log").select("action, admin_user_id").eq("target_id", author.profileId).eq("action", "profile_texts_rejected");
    assert.equal(audit!.length, 1);
    assert.equal(audit![0].admin_user_id, moderator.userId);
  });

  it("answers 409 when there is nothing left to decide", async () => {
    assert.equal((await review(moderator, { decision: "approved", version: 1 })).status, 409);
  });

  it("approving puts the new text live for everyone", async () => {
    await save(author, "Texte validé", "Recherche validée");
    const { text_review_version: version } = await rowOf(author.profileId);
    const res = await review(moderator, { decision: "approved", version });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(await seenBy(viewer, author.profileId), { bio: "Texte validé", lookingFor: "Recherche validée" });
    const row = await rowOf(author.profileId);
    assert.equal(row.bio_pending, null);
    assert.equal(row.looking_for_pending, null);
  });

  it("refuses a decision on text the member has rewritten since the moderator looked", async () => {
    await save(author, "Première version", "Recherche validée");
    const shown = (await rowOf(author.profileId)).text_review_version;
    await save(author, "Seconde version, réécrite entre-temps", "Recherche validée");

    const stale = await review(moderator, { decision: "approved", version: shown });
    assert.equal(stale.status, 409);
    assert.deepEqual(await seenBy(viewer, author.profileId), { bio: "Texte validé", lookingFor: "Recherche validée" }, "the unseen text did not go live");

    const current = (await rowOf(author.profileId)).text_review_version;
    assert.equal((await review(moderator, { decision: "approved", version: current })).status, 200);
    assert.equal((await seenBy(viewer, author.profileId)).bio, "Seconde version, réécrite entre-temps");
  });

  it("typing the live text back cancels the pending edit", async () => {
    await save(author, "Un brouillon", "Recherche validée");
    assert.equal((await rowOf(author.profileId)).bio_pending, "Un brouillon");
    await save(author, "Seconde version, réécrite entre-temps", "Recherche validée");
    const row = await rowOf(author.profileId);
    assert.equal(row.bio_pending, null);
    assert.equal(row.looking_for_pending, null);
  });

  it("applies clearing a field at once, since there is nothing to review", async () => {
    assert.ifError((await save(author, "Seconde version, réécrite entre-temps", "")).error);
    assert.equal((await seenBy(viewer, author.profileId)).lookingFor, null);
  });

  it("enforces the length limit", async () => {
    assert.ok((await save(author, "a".repeat(1001), "")).error);
  });

  it("keeps the profile visible while a new photo waits for approval", async () => {
    const up = await uploadPhoto(author, await jpeg());
    assert.equal(up.status, 200);
    assert.equal(up.body.moderation_status, "pending");
    await seenBy(viewer, author.profileId); // still found
    assert.equal(Boolean((await signPhoto(viewer, up.body.storage_key)).url), false, "others cannot see the new photo yet");
    assert.equal(Boolean((await signPhoto(author, up.body.storage_key)).url), true);
  });
});

describe("a profile that is not approved yet", () => {
  it("takes text directly — the whole profile is reviewed anyway", async () => {
    const newcomer = await createMember({ label: "txt-new", status: "pending", bio: "Brouillon" });
    try {
      assert.ifError((await save(newcomer, "Texte initial", "Ce que je cherche")).error);
      const row = await rowOf(newcomer.profileId);
      assert.equal(row.bio, "Texte initial");
      assert.equal(row.bio_pending, null);
      const direct = await newcomer.client.from("profiles").update({ bio: "Modifié" }).eq("id", newcomer.profileId);
      assert.ifError(direct.error);
    } finally {
      await cleanup();
    }
  });

  it("still cannot write the pending columns", async () => {
    const newcomer = await createMember({ label: "txt-new2", status: "pending" });
    try {
      assert.ok((await newcomer.client.from("profiles").update({ bio_pending: "x" }).eq("id", newcomer.profileId)).error);
      assert.ok((await anonymousClient().rpc("submit_profile_texts", { p_bio: "x", p_looking_for: "y" })).error);
    } finally {
      await cleanup();
    }
  });
});
