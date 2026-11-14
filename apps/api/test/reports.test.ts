import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { admin, api, cleanup, createMember, grantSubscription, type Member } from "./helpers/world.js";

describe("POST /reports", () => {
  let reporter: Member, target: Member, outsider: Member, moderator: Member;
  let messageId: string;

  before(async () => {
    reporter = await createMember({ label: "reporter" });
    target = await createMember({ label: "target" });
    outsider = await createMember({ label: "outsider" });
    moderator = await createMember({ label: "mod", role: "moderator" });
    await grantSubscription(target);
    const sent = await api(target, "POST", "/messages", { recipientProfileId: reporter.profileId, content: "rude" });
    assert.equal(sent.status, 200);
    messageId = sent.body.id;
  });
  after(cleanup);

  it("needs a session and a valid body", async () => {
    assert.equal((await api(null, "POST", "/reports", {})).status, 401);
    assert.equal((await api(reporter, "POST", "/reports", { contentType: "profile", contentId: "x", reason: "spam" })).status, 400);
    assert.equal(
      (await api(reporter, "POST", "/reports", { contentType: "profile", contentId: target.profileId, reason: "not-a-reason" })).status,
      400
    );
    assert.equal(
      (
        await api(reporter, "POST", "/reports", {
          contentType: "profile",
          contentId: target.profileId,
          reason: "spam",
          description: "x".repeat(1001),
        })
      ).status,
      400
    );
  });

  it("refuses reports about things that do not exist, or about yourself", async () => {
    const nothing = "00000000-0000-4000-8000-000000000000";
    assert.equal((await api(reporter, "POST", "/reports", { contentType: "profile", contentId: nothing, reason: "spam" })).status, 404);
    assert.equal((await api(reporter, "POST", "/reports", { contentType: "message", contentId: nothing, reason: "spam" })).status, 404);
    assert.equal(
      (await api(reporter, "POST", "/reports", { contentType: "profile", contentId: reporter.profileId, reason: "spam" })).status,
      400
    );
  });

  it("only lets the two participants report a message", async () => {
    const res = await api(outsider, "POST", "/reports", { contentType: "message", contentId: messageId, reason: "harassment" });
    assert.equal(res.status, 404);
  });

  it("files a report once, then answers 409 until it has been handled", async () => {
    const body = { contentType: "profile", contentId: target.profileId, reason: "fake", description: "  looks fake  " };
    const first = await api(reporter, "POST", "/reports", body);
    assert.equal(first.status, 200);
    assert.equal(first.body.reporter_id, reporter.userId);
    assert.equal(first.body.description, "looks fake", "trimmed by the schema");

    assert.equal((await api(reporter, "POST", "/reports", body)).status, 409);

    // Once a moderator has dealt with it, the same member may report again.
    const resolved = await api(moderator, "POST", `/admin/reports/${first.body.id}/resolve`, { status: "resolved" });
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
    assert.equal((await api(reporter, "POST", "/reports", body)).status, 200);
  });

  it("a participant can report a message", async () => {
    const res = await api(reporter, "POST", "/reports", { contentType: "message", contentId: messageId, reason: "harassment" });
    assert.equal(res.status, 200);
  });

  it("clients cannot insert reports directly", async () => {
    const { error } = await reporter.client
      .from("reports")
      .insert({ reporter_id: reporter.userId, content_type: "profile", content_id: target.profileId, reason: "spam" });
    assert.ok(error);
    const { count } = await admin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", reporter.userId)
      .eq("reason", "spam");
    assert.equal(count, 0);
  });
});
