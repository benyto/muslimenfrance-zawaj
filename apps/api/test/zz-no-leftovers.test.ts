import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { admin, EMAIL_DOMAIN } from "./helpers/world.js";

// Runs last (files are alphabetical). If any test forgot to clean up, or a
// cleanup path broke, it shows up here rather than as slowly accumulating junk.
describe("test data", () => {
  it("leaves nothing behind", async () => {
    const leftovers: string[] = [];
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      assert.ifError(error);
      leftovers.push(...data.users.filter((u) => u.email?.startsWith("test-") && u.email.endsWith(`@${EMAIL_DOMAIN}`)).map((u) => u.email!));
      if (data.users.length < 1000) break;
    }
    assert.deepEqual(leftovers, [], "test users still exist");

    const { count: events } = await admin.from("webhook_events").select("id", { count: "exact", head: true }).like("id", "evt_test_%");
    assert.equal(events, 0, "test webhook events still exist");
    const { count: subs } = await admin.from("user_subscriptions").select("id", { count: "exact", head: true }).like("stripe_subscription_id", "sub_test_%");
    assert.equal(subs, 0, "test subscriptions still exist");
    const { data: folders } = await admin.storage.from("profile-photos").list("", { limit: 1000 });
    const { data: profiles } = await admin.from("profiles").select("id");
    const known = new Set(profiles!.map((p) => p.id));
    assert.deepEqual(
      (folders ?? []).map((f) => f.name).filter((name) => !known.has(name)),
      [],
      "stored photos with no owner"
    );
  });
});
