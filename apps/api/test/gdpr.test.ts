import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { admin, api, cleanup, createMember, grantSubscription, signPhoto, storedFiles, uploadPhoto, type Member } from "./helpers/world.js";
import { jpeg } from "./helpers/images.js";

describe("account export", () => {
  let me: Member, friend: Member, moderator: Member;
  let photoKey: string;

  before(async () => {
    me = await createMember({ label: "exp-me" });
    friend = await createMember({ label: "exp-friend" });
    moderator = await createMember({ label: "exp-mod", role: "moderator" });
    await grantSubscription(me);
    await grantSubscription(friend);

    const up = await uploadPhoto(me, await jpeg());
    assert.equal(up.status, 200);
    photoKey = up.body.storage_key;
    // A moderator acting on the photo and the profile, so internal columns hold real values.
    assert.equal((await api(moderator, "POST", `/admin/photos/${up.body.id}/moderate`, { status: "approved" })).status, 200);
    assert.equal(
      (await api(moderator, "POST", `/admin/profiles/${me.profileId}/moderate`, { status: "approved", notes: "ok" })).status,
      200
    );

    assert.equal((await api(me, "POST", "/messages", { recipientProfileId: friend.profileId, content: "out" })).status, 200);
    assert.equal((await api(friend, "POST", "/messages", { recipientProfileId: me.profileId, content: "in" })).status, 200);

    // friend asks for access to my photos and I decline: the friend must keep seeing "pending".
    assert.ifError((await friend.client.rpc("request_photo_access", { p_owner_profile_id: me.profileId })).error);
    assert.ifError((await me.client.rpc("set_photo_access", { p_viewer_profile_id: friend.profileId, p_grant: false })).error);

    assert.equal(
      (await api(friend, "POST", "/reports", { contentType: "profile", contentId: me.profileId, reason: "spam" })).status,
      200
    );
  });
  after(cleanup);

  it("needs a session", async () => {
    assert.equal((await api(null, "POST", "/gdpr/export")).status, 401);
  });

  it("returns the member's own data, with working photo links, and records the request", async () => {
    const res = await api(me, "POST", "/gdpr/export");
    assert.equal(res.status, 200, JSON.stringify(res.body).slice(0, 300));
    const data = res.body;

    assert.equal(data.profile.id, me.profileId);
    assert.deepEqual(data.messages.map((m: any) => m.content).sort(), ["in", "out"]);
    assert.equal(data.conversations.length, 1);
    assert.equal(data.photos.length, 1);
    assert.match(data.photos[0].file_url, /^https?:\/\//);
    assert.equal((await fetch(data.photos[0].file_url)).status, 200, "the link downloads the photo");
    assert.ok(data.photoLinksExpireAt);

    const row = await admin.from("gdpr_requests").select("status, completed_at").eq("user_id", me.userId).single();
    assert.equal(row.data!.status, "completed");
    assert.ok(row.data!.completed_at);
  });

  it("leaves out internal fields", async () => {
    // Fresh member would hit the daily limit sooner; reuse the same call's shape via a second member.
    const res = await api(friend, "POST", "/gdpr/export");
    assert.equal(res.status, 200);
    const text = JSON.stringify(res.body);
    assert.equal(text.includes("moderated_by"), false);
    assert.equal(text.includes("reviewed_by"), false);
    assert.equal(text.includes("admin_notes"), false);
    assert.equal(text.includes("storage_key"), false);
    assert.equal(text.includes(photoKey), false, "no storage path of anyone's photo");
    assert.equal(text.includes(moderator.userId), false, "no moderator identity");
  });

  it("shows a declined photo request as still pending, to the person who asked", async () => {
    const res = await api(friend, "POST", "/gdpr/export");
    assert.equal(res.status, 200);
    const asViewer = res.body.photoAccess.asViewer;
    assert.equal(asViewer.length, 1);
    assert.equal(asViewer[0].status, "pending");
  });

  it("is limited to three a day per member", async () => {
    // friend has already done two exports above.
    assert.equal((await api(friend, "POST", "/gdpr/export")).status, 200);
    assert.equal((await api(friend, "POST", "/gdpr/export")).status, 429);
  });
});

describe("account deletion", () => {
  let member: Member, friend: Member;
  before(async () => {
    member = await createMember({ label: "gone" });
    friend = await createMember({ label: "stays" });
    await grantSubscription(member);
  });
  after(cleanup);

  it("needs a session", async () => {
    assert.equal((await api(null, "POST", "/gdpr/delete")).status, 401);
  });

  it("removes the account, its rows, and its stored photos — and nothing of anyone else's", async () => {
    const mine = await uploadPhoto(member, await jpeg());
    const theirs = await uploadPhoto(friend, await jpeg());
    assert.equal(mine.status, 200);
    assert.equal(theirs.status, 200);
    assert.equal((await api(member, "POST", "/messages", { recipientProfileId: friend.profileId, content: "bye" })).status, 200);
    assert.equal(await storedFiles(mine.body.storage_key), "display.webp,thumb.webp");

    const res = await api(member, "POST", "/gdpr/delete");
    assert.equal(res.status, 200, JSON.stringify(res.body));

    assert.equal(await storedFiles(mine.body.storage_key), "", "files are gone");
    assert.equal(await storedFiles(theirs.body.storage_key), "display.webp,thumb.webp", "other member's files untouched");

    const user = await admin.auth.admin.getUserById(member.userId);
    assert.ok(user.error || !user.data.user, "auth user is gone");
    const { data: profile } = await admin.from("profiles").select("id").eq("id", member.profileId);
    assert.equal(profile!.length, 0);
    const { data: photos } = await admin.from("profile_photos").select("id").eq("profile_id", member.profileId);
    assert.equal(photos!.length, 0);
    const { data: messages } = await admin.from("messages").select("id").eq("sender_profile_id", member.profileId);
    assert.equal(messages!.length, 0);

    // The deleted member's token no longer works.
    assert.equal((await api(member, "POST", "/gdpr/export")).status, 401);
    // Still a full, working friend.
    assert.equal((await signPhoto(friend, theirs.body.storage_key)).url !== undefined, true);
  });
});

describe("deleting a moderator", () => {
  it("keeps what they moderated and the audit trail, without their identity", async () => {
    const moderator = await createMember({ label: "mod-del", role: "moderator" });
    const subject = await createMember({ label: "mod-subject" });
    try {
      const moderated = await api(moderator, "POST", `/admin/profiles/${subject.profileId}/moderate`, { status: "disabled" });
      assert.equal(moderated.status, 200);

      const res = await api(moderator, "POST", "/gdpr/delete");
      assert.equal(res.status, 200, JSON.stringify(res.body));

      const { data: profile } = await admin.from("profiles").select("moderation_status, moderated_by").eq("id", subject.profileId).single();
      assert.equal(profile!.moderation_status, "disabled", "the decision stands");
      assert.equal(profile!.moderated_by, null, "…without naming the deleted moderator");

      const { data: audit } = await admin.from("admin_audit_log").select("id, admin_user_id").eq("target_id", subject.profileId);
      assert.ok(audit!.length >= 1, "the audit entry survives");
      assert.ok(audit!.every((row) => row.admin_user_id === null));
    } finally {
      await cleanup();
    }
  });
});
