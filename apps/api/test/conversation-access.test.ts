import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { admin, api, cleanup, createMember, grantSubscription, type Member } from "./helpers/world.js";

describe("moderators and private conversations", () => {
  let alice: Member, bob: Member, carol: Member, moderator: Member, boss: Member;
  let conversationId: string;
  let ordered: { id: string; content: string }[] = []; // the conversation, oldest first
  let reportId: string;

  const view = (who: Member | null, id = reportId) => api(who, "GET", `/admin/reports/${id}/conversation`);
  const viewEntries = async (id = reportId) =>
    (await admin.from("admin_audit_log").select("admin_user_id, target_type, before, after").eq("action", "conversation_viewed").eq("target_id", id)).data ?? [];

  before(async () => {
    alice = await createMember({ label: "conv-alice" });
    bob = await createMember({ label: "conv-bob" });
    carol = await createMember({ label: "conv-carol" });
    moderator = await createMember({ label: "conv-mod", role: "moderator" });
    boss = await createMember({ label: "conv-admin", role: "admin" });
    await grantSubscription(alice);

    const first = await api(alice, "POST", "/messages", { recipientProfileId: bob.profileId, content: "msg-0" });
    assert.equal(first.status, 200);
    conversationId = first.body.conversation_id;

    // A long history, so the window around the reported message is visible.
    const base = Date.now() - 3_600_000;
    const rows = Array.from({ length: 59 }, (_, i) => ({
      conversation_id: conversationId,
      sender_profile_id: i % 2 ? alice.profileId : bob.profileId,
      recipient_profile_id: i % 2 ? bob.profileId : alice.profileId,
      content: `SECRET-LINE-${i + 1}`,
      created_at: new Date(base + i * 1000).toISOString(),
    }));
    assert.ifError((await admin.from("messages").insert(rows)).error);
    ordered = (await admin.from("messages").select("id, content").eq("conversation_id", conversationId).order("created_at").order("id")).data!;
    assert.equal(ordered.length, 60);

    const report = await api(bob, "POST", "/reports", { contentType: "message", contentId: ordered[30].id, reason: "harassment" });
    assert.equal(report.status, 200);
    reportId = report.body.id;
  });
  after(cleanup);

  it("no longer lets the moderation team read conversations or messages directly", async () => {
    for (const who of [moderator, boss]) {
      for (const table of ["messages", "conversations"] as const) {
        const { data, error } = await who.client.from(table).select("*").limit(5);
        assert.ifError(error);
        assert.deepEqual(data, [], `${table} must look empty to a moderator, even with a report open`);
      }
    }
  });

  it("leaves members able to read their own conversation", async () => {
    const { data } = await alice.client.from("messages").select("id").eq("conversation_id", conversationId);
    assert.equal(data!.length, 60);
  });

  it("is open only to moderators and admins, and only for message reports", async () => {
    assert.equal((await view(null)).status, 401);
    assert.equal((await view(carol)).status, 403);
    assert.equal((await view(alice)).status, 403, "not even a participant, through this route");
    assert.equal((await view(moderator, "00000000-0000-4000-8000-000000000000")).status, 404);

    const profileReport = await api(carol, "POST", "/reports", { contentType: "profile", contentId: alice.profileId, reason: "fake" });
    assert.equal(profileReport.status, 200);
    assert.equal((await view(moderator, profileReport.body.id)).status, 400, "a profile report gives no access to conversations");
    assert.equal((await viewEntries(profileReport.body.id)).length, 0);
    assert.equal((await viewEntries()).length, 0, "nothing logged for refused requests");
  });

  it("returns a window around the reported message — not the whole history", async () => {
    const res = await view(moderator);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.reportedMessageId, ordered[30].id);
    assert.deepEqual(
      res.body.messages.map((m: { id: string }) => m.id),
      ordered.slice(5, 56).map((m) => m.id),
      "25 before, the reported one, 25 after — in order"
    );
    assert.equal(Object.keys(res.body.participants).length, 2);
    assert.ok(Object.values(res.body.participants).every((n) => typeof n === "string" && n.startsWith("T-")));
    const text = JSON.stringify(res.body);
    for (const private_ of [alice.email, bob.email, alice.userId, bob.userId]) {
      assert.equal(text.includes(private_), false, "no account details");
    }
  });

  it("works at the edges of the conversation, and for an admin too", async () => {
    const edge = await api(alice, "POST", "/reports", { contentType: "message", contentId: ordered[0].id, reason: "spam" });
    const res = await view(boss, edge.body.id);
    assert.equal(res.status, 200);
    assert.equal(res.body.messages.length, 26, "the first message and 25 after it");
    assert.equal(res.body.messages[0].id, ordered[0].id);
  });

  it("records every view in the audit log, without what was read", async () => {
    const before = (await viewEntries()).length;
    assert.ok(before >= 1);
    assert.equal((await view(moderator)).status, 200);
    const entries = await viewEntries();
    assert.equal(entries.length, before + 1, "one entry per view");
    for (const entry of entries) {
      assert.equal(entry.admin_user_id, moderator.userId);
      assert.equal(entry.target_type, "report");
      assert.equal(entry.before, null);
      assert.equal(entry.after, null);
      assert.equal(JSON.stringify(entry).includes("SECRET-LINE"), false);
    }
  });

  it("stops once the report is handled", async () => {
    const entriesBefore = (await viewEntries()).length;
    assert.equal((await api(moderator, "POST", `/admin/reports/${reportId}/resolve`, { status: "dismissed" })).status, 200);
    const res = await view(moderator);
    assert.equal(res.status, 409);
    assert.match(res.body.error, /traité/);
    assert.equal((await viewEntries()).length, entriesBefore, "a refused view is not logged as a view");
  });
});
