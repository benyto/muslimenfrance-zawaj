import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { admin, api, cleanup, createMember, grantSubscription, RUN, type Member } from "./helpers/world.js";

const ALLOWED_KEYS = new Set(["moderation_status", "status", "bio_changed", "looking_for_changed"]);

describe("moderation audit log", () => {
  let moderator: Member, subject: Member, reporter: Member;
  const SECRET_BIO = `SECRET-BIO-${RUN}`;
  const SECRET_NEW_BIO = `SECRET-NEW-BIO-${RUN}`;
  const SECRET_DESCRIPTION = `SECRET-DESCRIPTION-${RUN}`;
  let nickname: string;

  const entriesBy = async (actor: Member) =>
    (await admin.from("admin_audit_log").select("action, target_type, target_id, before, after").eq("admin_user_id", actor.userId)).data ?? [];

  before(async () => {
    moderator = await createMember({ label: "audit-mod", role: "moderator" });
    subject = await createMember({ label: "audit-subject", status: "pending", bio: SECRET_BIO, lookingFor: "x" });
    reporter = await createMember({ label: "audit-reporter" });
    await grantSubscription(subject);
    nickname = (await admin.from("profiles").select("nickname").eq("id", subject.profileId).single()).data!.nickname;

    // One decision of every kind that writes an entry.
    assert.equal((await api(moderator, "POST", `/admin/profiles/${subject.profileId}/moderate`, { status: "approved", notes: `note-${SECRET_BIO}` })).status, 200);

    const photo = await admin
      .from("profile_photos")
      .insert({ profile_id: subject.profileId, storage_key: `${subject.profileId}/00000000-0000-4000-8000-0000000000bb` })
      .select("id")
      .single();
    assert.equal((await api(moderator, "POST", `/admin/photos/${photo.data!.id}/moderate`, { status: "rejected" })).status, 200);

    const report = await api(reporter, "POST", "/reports", { contentType: "profile", contentId: subject.profileId, reason: "fake", description: SECRET_DESCRIPTION });
    assert.equal(report.status, 200);
    assert.equal((await api(moderator, "POST", `/admin/reports/${report.body.id}/resolve`, { status: "resolved", adminNotes: SECRET_DESCRIPTION })).status, 200);

    assert.ifError((await subject.client.rpc("submit_profile_texts", { p_bio: SECRET_NEW_BIO, p_looking_for: "x" })).error);
    const version = (await admin.from("profiles").select("text_review_version").eq("id", subject.profileId).single()).data!.text_review_version;
    assert.equal((await api(moderator, "POST", `/admin/profiles/${subject.profileId}/texts/review`, { decision: "approved", version })).status, 200);
  });
  after(cleanup);

  it("records every kind of decision", async () => {
    const actions = (await entriesBy(moderator)).map((e) => e.action).sort();
    assert.deepEqual(actions, ["photo_rejected", "profile_approved", "profile_texts_approved", "report_resolved"]);
  });

  it("holds only the state a decision moved between, never what a member wrote", async () => {
    for (const entry of await entriesBy(moderator)) {
      for (const details of [entry.before, entry.after]) {
        for (const key of Object.keys(details ?? {})) assert.ok(ALLOWED_KEYS.has(key), `${entry.action}: unexpected "${key}"`);
      }
      const text = JSON.stringify(entry);
      for (const secret of [SECRET_BIO, SECRET_NEW_BIO, SECRET_DESCRIPTION, nickname, subject.email, reporter.userId, subject.userId]) {
        assert.equal(text.includes(secret), false, `${entry.action} leaks ${secret.slice(0, 12)}…`);
      }
    }
  });

  it("is enforced by the database, not just by the API", async () => {
    const insert = (target_type: string, details: object | null) =>
      admin.from("admin_audit_log").insert({ admin_user_id: moderator.userId, action: "test", target_type, target_id: subject.profileId, before: details, after: details });

    for (const [type, details] of [
      ["profile", { nickname: "x" }],
      ["profile", { moderation_status: "approved", bio: "x" }],
      ["photo", { profiles: { nickname: "x" } }],
      ["report", { status: "resolved", description: "x" }],
    ] as const) {
      assert.ok((await insert(type, details)).error, `${type} ${JSON.stringify(details)} must be refused`);
    }
    assert.ifError((await insert("profile", { moderation_status: "approved" })).error);
    assert.equal((await insert("subscription", { name: "Plan", price_amount: 999 })).error, null, "pricing configuration is not personal data");
  });

  it("leaves nothing that identifies the member once their account is deleted", async () => {
    const before = (await entriesBy(moderator)).filter((e) => e.target_id === subject.profileId).length;
    assert.ok(before >= 2);

    assert.equal((await api(subject, "POST", "/gdpr/delete")).status, 200);

    const left = (await admin.from("admin_audit_log").select("*").eq("target_id", subject.profileId)).data!;
    assert.ok(left.length >= before, "the trail itself is kept");
    const text = JSON.stringify(left);
    for (const personal of [nickname, subject.email, SECRET_BIO, SECRET_NEW_BIO, SECRET_DESCRIPTION, subject.userId]) {
      assert.equal(text.includes(personal), false, `still contains ${personal.slice(0, 12)}…`);
    }
    const profile = await admin.from("profiles").select("id").eq("id", subject.profileId);
    assert.equal(profile.data!.length, 0, "and the profile it pointed at is gone");
  });
});
