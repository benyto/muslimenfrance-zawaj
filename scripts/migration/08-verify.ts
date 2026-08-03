// Row-count diffs against the monolith export, plus spot checks that don't
// reduce to a count: message ordering within a conversation, and that no
// row references an id nothing else created (which insert-order alone
// doesn't guarantee — a wrong id typo would still "count" correctly).
import type { Database } from "@rencontre/shared";
import { rencontre } from "./lib/clients.js";
import { readOutput } from "./lib/io.js";

type Export = {
  profiles: { id: string }[];
  photos: { id: string }[];
  conversations: { id: string }[];
  messages: { id: string; conversation_id: string; created_at: string }[];
  blocks: { id: string }[];
};

type MigratedTable = "profiles" | "profile_photos" | "conversations" | "messages" | "user_blocks";

async function count(table: keyof Database["public"]["Tables"] & MigratedTable) {
  const { count, error } = await rencontre.from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const exported = readOutput<Export>("export");
  let ok = true;

  const checks: [MigratedTable, number][] = [
    ["profiles", exported.profiles.length],
    ["profile_photos", exported.photos.length],
    ["conversations", exported.conversations.length],
    ["messages", exported.messages.length],
    ["user_blocks", exported.blocks.length],
  ];

  console.log("--- row count diffs ---");
  for (const [table, expected] of checks) {
    const actual = await count(table);
    const match = actual === expected;
    if (!match) ok = false;
    console.log(`${table}: expected ${expected}, got ${actual} ${match ? "OK" : "MISMATCH"}`);
  }

  console.log("\n--- orphan check: every message's conversation_id exists ---");
  const { data: convoIds } = await rencontre.from("conversations").select("id");
  const convoIdSet = new Set((convoIds ?? []).map((c) => c.id));
  const orphanMessages = exported.messages.filter((m) => !convoIdSet.has(m.conversation_id));
  console.log(orphanMessages.length === 0 ? "OK, no orphans" : `MISMATCH: ${orphanMessages.length} orphaned`);
  if (orphanMessages.length) ok = false;

  console.log("\n--- spot check: message ordering within each conversation matches monolith ---");
  const byConvo = new Map<string, typeof exported.messages>();
  for (const m of exported.messages) {
    if (!byConvo.has(m.conversation_id)) byConvo.set(m.conversation_id, []);
    byConvo.get(m.conversation_id)!.push(m);
  }
  for (const [convoId, msgs] of byConvo) {
    const expectedOrder = [...msgs]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((m) => m.id);
    const { data: actualRows } = await rencontre
      .from("messages")
      .select("id")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });
    const actualOrder = (actualRows ?? []).map((r) => r.id);
    const matches = JSON.stringify(expectedOrder) === JSON.stringify(actualOrder);
    console.log(`conversation ${convoId}: ${msgs.length} messages, order ${matches ? "OK" : "MISMATCH"}`);
    if (!matches) ok = false;
  }

  console.log("\n--- profiles.commune_insee_code coverage ---");
  const { count: withCommune } = await rencontre
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .not("commune_insee_code", "is", null);
  console.log(
    `${withCommune ?? 0}/${exported.profiles.length} profiles have a mapped commune (see 03-migrate-cities.ts output for which cities were unmatched)`
  );

  console.log(`\n${ok ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED — see MISMATCH lines above"}`);
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
