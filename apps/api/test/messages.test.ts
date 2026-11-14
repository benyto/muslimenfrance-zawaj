import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { admin, api, cleanup, createMember, grantSubscription, sleep, type Member } from "./helpers/world.js";
import { isLocal } from "./helpers/env.js";

describe("POST /messages", () => {
  let alice: Member, bob: Member, pending: Member;

  before(async () => {
    alice = await createMember({ label: "alice" });
    bob = await createMember({ label: "bob" });
    pending = await createMember({ label: "pending", status: "pending" });
    await grantSubscription(alice);
    await grantSubscription(bob);
    await grantSubscription(pending);
  });
  after(cleanup);

  it("needs a session", async () => {
    const res = await api(null, "POST", "/messages", { recipientProfileId: bob.profileId, content: "salam" });
    assert.equal(res.status, 401);
  });

  it("rejects malformed bodies before touching the database", async () => {
    for (const body of [{}, { recipientProfileId: "nope", content: "x" }, { recipientProfileId: bob.profileId, content: "   " }, { recipientProfileId: bob.profileId, content: "x".repeat(1001) }]) {
      const res = await api(alice, "POST", "/messages", body);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80));
    }
  });

  it("creates the conversation on the first message and reuses it afterwards", async () => {
    const first = await api(alice, "POST", "/messages", { recipientProfileId: bob.profileId, content: "salam" });
    assert.equal(first.status, 200);
    assert.equal(first.body.sender_profile_id, alice.profileId);

    // The other direction lands in the same conversation.
    const reply = await api(bob, "POST", "/messages", { recipientProfileId: alice.profileId, content: "wa alaykum salam" });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.conversation_id, first.body.conversation_id);

    const { count } = await admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .in("profile1_id", [alice.profileId, bob.profileId])
      .in("profile2_id", [alice.profileId, bob.profileId]);
    assert.equal(count, 1);
  });

  it("does not let a member write as someone else", async () => {
    // Sender is always the authenticated user; there is no field to override.
    const res = await api(alice, "POST", "/messages", {
      recipientProfileId: bob.profileId,
      content: "spoof",
      senderProfileId: bob.profileId,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.sender_profile_id, alice.profileId);
  });

  it("refuses messaging yourself, unknown profiles, and unapproved senders", async () => {
    assert.equal((await api(alice, "POST", "/messages", { recipientProfileId: alice.profileId, content: "x" })).status, 400);
    assert.equal(
      (await api(alice, "POST", "/messages", { recipientProfileId: "00000000-0000-4000-8000-000000000000", content: "x" })).status,
      404
    );
    assert.equal((await api(pending, "POST", "/messages", { recipientProfileId: bob.profileId, content: "x" })).status, 403);
    // …and an unapproved recipient does not exist as far as senders are concerned.
    assert.equal((await api(alice, "POST", "/messages", { recipientProfileId: pending.profileId, content: "x" })).status, 404);
  });

  it("clients cannot write messages or conversations themselves", async () => {
    const conversation = await admin
      .from("conversations")
      .select("id")
      .or(`profile1_id.eq.${alice.profileId},profile2_id.eq.${alice.profileId}`)
      .limit(1)
      .single();
    const insertMessage = await alice.client.from("messages").insert({
      conversation_id: conversation.data!.id,
      sender_profile_id: alice.profileId,
      recipient_profile_id: bob.profileId,
      content: "direct",
    });
    assert.ok(insertMessage.error, "direct message insert must be refused");

    const insertConversation = await alice.client
      .from("conversations")
      .insert({ profile1_id: alice.profileId, profile2_id: pending.profileId });
    assert.ok(insertConversation.error, "direct conversation insert must be refused");
  });

  it("enforces the paywall when the project has one", { skip: !isLocal && "would enable a paywall on a shared database" }, async () => {
    const carol = await createMember({ label: "carol" }); // no subscription
    // `audience` is unique, so turn the existing row on (or create one) and put it back.
    const { data: existing } = await admin.from("subscription_products").select("id, enabled").eq("audience", "all").maybeSingle();
    const productId = existing
      ? existing.id
      : (await admin.from("subscription_products").insert({ audience: "all", name: "test", enabled: false }).select("id").single()).data!.id;
    assert.ifError((await admin.from("subscription_products").update({ enabled: true }).eq("id", productId)).error);
    try {
      const res = await api(carol, "POST", "/messages", { recipientProfileId: bob.profileId, content: "hello" });
      assert.equal(res.status, 402);
      // Paying members are not affected.
      assert.equal((await api(alice, "POST", "/messages", { recipientProfileId: bob.profileId, content: "still fine" })).status, 200);
    } finally {
      if (existing) await admin.from("subscription_products").update({ enabled: existing.enabled }).eq("id", productId);
      else await admin.from("subscription_products").delete().eq("id", productId);
    }
  });

  it("ignoring someone hides them from the ignorer's inbox only", async () => {
    const dave = await createMember({ label: "dave" });
    const erin = await createMember({ label: "erin" });
    await grantSubscription(dave);
    await grantSubscription(erin);

    const { error } = await erin.client.from("profile_ignores").insert({
      ignorer_profile_id: erin.profileId,
      ignored_profile_id: dave.profileId,
    });
    assert.ifError(error);

    // The ignored party is never told: the send succeeds as normal.
    const sent = await api(dave, "POST", "/messages", { recipientProfileId: erin.profileId, content: "hi erin" });
    assert.equal(sent.status, 200);

    const erinInbox = await erin.client.rpc("get_my_conversations");
    assert.ifError(erinInbox.error);
    assert.equal(erinInbox.data!.some((c: { other_profile_id: string }) => c.other_profile_id === dave.profileId), false);

    const daveInbox = await dave.client.rpc("get_my_conversations");
    assert.ifError(daveInbox.error);
    assert.equal(daveInbox.data!.some((c: { other_profile_id: string }) => c.other_profile_id === erin.profileId), true);
  });
});

describe("message history cursor", () => {
  let a: Member, b: Member;
  const ids: string[] = [];
  let conversationId: string;

  before(async () => {
    a = await createMember({ label: "hist-a" });
    b = await createMember({ label: "hist-b" });
    await grantSubscription(a);
    const first = await api(a, "POST", "/messages", { recipientProfileId: b.profileId, content: "m0" });
    assert.equal(first.status, 200);
    ids.push(first.body.id);
    // Seven more rows sharing ONE timestamp — the case a created_at-only
    // cursor loses rows on.
    const at = new Date().toISOString();
    const rows = Array.from({ length: 7 }, (_, i) => ({
      conversation_id: first.body.conversation_id as string,
      sender_profile_id: a.profileId,
      recipient_profile_id: b.profileId,
      content: `tie-${i}`,
      created_at: at,
    }));
    const { data, error } = await admin.from("messages").insert(rows).select("id");
    assert.ifError(error);
    ids.push(...data!.map((r) => r.id));
    conversationId = first.body.conversation_id;
  });
  after(cleanup);

  it("walks the thread newest-first without skipping or repeating rows", async () => {
    // Same query shape as the web app's useConversationMessages, with a
    // page size that forces a boundary inside the tied timestamps.
    const PAGE = 3;
    const seen: string[] = [];
    let cursor: { before: string; beforeId: string } | undefined;
    for (let guard = 0; guard < 10; guard++) {
      let query = a.client
        .from("messages")
        .select("id, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE);
      if (cursor) {
        query = query.or(`created_at.lt.${cursor.before},and(created_at.eq.${cursor.before},id.lt.${cursor.beforeId})`);
      }
      const { data, error } = await query;
      assert.ifError(error);
      if (!data!.length) break;
      seen.push(...data!.map((r) => r.id));
      const last = data![data!.length - 1];
      cursor = { before: last.created_at, beforeId: last.id };
      if (data!.length < PAGE) break;
    }
    assert.equal(seen.length, ids.length);
    assert.equal(new Set(seen).size, ids.length, "no row repeated");
    assert.deepEqual([...seen].sort(), [...ids].sort(), "no row skipped");
  });
});

describe("new-message email slot", () => {
  let a: Member, b: Member;
  let conversationId: string;

  before(async () => {
    a = await createMember({ label: "mail-a" });
    b = await createMember({ label: "mail-b", emailNotifications: false });
    await grantSubscription(a);
    const res = await api(a, "POST", "/messages", { recipientProfileId: b.profileId, content: "hello" });
    conversationId = res.body.conversation_id;
    await sleep(500); // let any background work from the send settle
  });
  after(cleanup);

  it("goes to exactly one of several simultaneous claimers, and can be given back", async () => {
    await admin.from("message_email_claims").delete().eq("conversation_id", conversationId);
    const claim = () =>
      admin.rpc("claim_message_email_slot", {
        p_conversation_id: conversationId,
        p_recipient_profile_id: b.profileId,
        p_cooldown_minutes: 60,
      });
    const results = await Promise.all(Array.from({ length: 8 }, claim));
    assert.equal(results.filter((r) => r.data === true).length, 1);
    assert.equal((await claim()).data, false, "inside the window");

    await admin.rpc("release_message_email_slot", { p_conversation_id: conversationId, p_recipient_profile_id: b.profileId });
    assert.equal((await claim()).data, true, "released slot can be taken again");
  });

  it("is a server-only function", async () => {
    const res = await a.client.rpc("claim_message_email_slot", {
      p_conversation_id: conversationId,
      p_recipient_profile_id: b.profileId,
      p_cooldown_minutes: 0,
    });
    assert.ok(res.error);
  });
});
