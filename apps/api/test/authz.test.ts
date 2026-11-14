import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { admin, anonymousClient, api, cleanup, createMember, type Member } from "./helpers/world.js";

describe("admin routes", () => {
  let member: Member, moderator: Member, boss: Member, subject: Member;

  before(async () => {
    member = await createMember({ label: "plain" });
    moderator = await createMember({ label: "moderator", role: "moderator" });
    boss = await createMember({ label: "boss", role: "admin" });
    subject = await createMember({ label: "subject", status: "pending" });
  });
  after(cleanup);

  const moderate = (who: Member | null) =>
    api(who, "POST", `/admin/profiles/${subject.profileId}/moderate`, { status: "approved" });

  it("refuses anonymous callers and ordinary members", async () => {
    assert.equal((await moderate(null)).status, 401);
    assert.equal((await moderate(member)).status, 403);
    const { data } = await admin.from("profiles").select("moderation_status").eq("id", subject.profileId).single();
    assert.equal(data!.moderation_status, "pending");
  });

  it("lets a moderator moderate, and records who and what in the audit log", async () => {
    const res = await moderate(moderator);
    assert.equal(res.status, 200);
    assert.equal(res.body.moderation_status, "approved");
    assert.equal(res.body.moderated_by, moderator.userId);
    const { data } = await admin.from("admin_audit_log").select("action, admin_user_id").eq("target_id", subject.profileId);
    assert.equal(data!.length, 1);
    assert.equal(data![0].action, "profile_approved");
    assert.equal(data![0].admin_user_id, moderator.userId);
  });

  it("validates the body and the target", async () => {
    assert.equal((await api(moderator, "POST", `/admin/profiles/${subject.profileId}/moderate`, { status: "pending" })).status, 400);
    assert.equal(
      (await api(moderator, "POST", "/admin/profiles/00000000-0000-4000-8000-000000000000/moderate", { status: "approved" })).status,
      404
    );
  });

  it("keeps pricing for admins, not moderators", async () => {
    const patch = (who: Member) =>
      api(who, "PATCH", "/admin/subscription-products/00000000-0000-4000-8000-000000000000", { name: "x" });
    assert.equal((await patch(member)).status, 403);
    assert.equal((await patch(moderator)).status, 403);
    assert.equal((await patch(boss)).status, 404, "an admin gets past the gate and finds no such product");
  });
});

describe("what a signed-in member can do straight against the database", () => {
  let me: Member, other: Member;
  before(async () => {
    me = await createMember({ label: "db-me" });
    other = await createMember({ label: "db-other" });
  });
  after(cleanup);

  it("sees no one else's profile row, only through the functions that decide what is shown", async () => {
    const { data } = await me.client.from("profiles").select("id").eq("id", other.profileId);
    assert.equal(data!.length, 0);
  });

  it("cannot promote itself or approve itself", async () => {
    const role = await me.client.from("user_roles").insert({ user_id: me.userId, role: "admin" });
    assert.ok(role.error);
    await me.client.from("profiles").update({ moderation_status: "approved", moderated_by: me.userId }).eq("id", me.profileId);
    const { data } = await admin.from("profiles").select("moderated_by").eq("id", me.profileId).single();
    assert.equal(data!.moderated_by, null);
  });

  it("cannot read the server-only tables", async () => {
    for (const table of ["webhook_events", "message_email_claims", "admin_audit_log", "gdpr_requests"] as const) {
      const { data } = await me.client.from(table).select("*").limit(1);
      assert.deepEqual(data ?? [], [], table);
    }
  });

  it("anonymous visitors get nothing", async () => {
    const anon = anonymousClient();
    for (const table of ["profiles", "messages", "profile_photos", "reports"] as const) {
      const { data } = await anon.from(table).select("*").limit(1);
      assert.deepEqual(data ?? [], [], table);
    }
  });
});
