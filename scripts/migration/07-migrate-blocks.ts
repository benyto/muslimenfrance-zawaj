import { rencontre } from "./lib/clients.js";
import { readOutput } from "./lib/io.js";

type MonolithBlock = {
  id: string;
  blocker_profile_id: string;
  blocked_profile_id: string;
  reason: string | null;
  created_at: string;
};

async function main() {
  const { blocks } = readOutput<{ blocks: MonolithBlock[] }>("export");
  if (blocks.length === 0) {
    console.log("no blocks to migrate");
    return;
  }

  const { data, error } = await rencontre
    .from("user_blocks")
    .insert(
      blocks.map((b) => ({
        id: b.id,
        blocker_profile_id: b.blocker_profile_id,
        blocked_profile_id: b.blocked_profile_id,
        reason: b.reason,
        created_at: b.created_at,
      }))
    )
    .select("id");
  if (error) throw error;
  console.log(`inserted ${data.length} blocks`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
