// The monolith's blocks become *ignores* here: the mutual `user_blocks` table
// was retired in favour of the one-directional profile_ignores (the person who
// blocked is now the one who ignores; see migration 20260808130000_retire_mutual_block).
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
    .from("profile_ignores")
    .insert(
      blocks.map((b) => ({
        id: b.id,
        ignorer_profile_id: b.blocker_profile_id,
        ignored_profile_id: b.blocked_profile_id,
        created_at: b.created_at,
      }))
    )
    .select("id");
  if (error) throw error;
  console.log(`inserted ${data.length} ignores (from the monolith's blocks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
