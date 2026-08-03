// Pulls every row this migration touches from the monolith into a single
// JSON snapshot, including each profile owner's auth.users row (or null,
// for the placeholder-seeded demo profiles that have no real account —
// see the plan's "Data migration" section for why those are handled
// differently). Read-only against the monolith; every later script reads
// from this snapshot instead of hitting the monolith again, so a partial
// failure downstream never risks re-querying a monolith that may have
// moved on by then.
import { mono } from "./lib/clients.js";
import { writeOutput } from "./lib/io.js";

async function main() {
  const { data: profiles, error: profilesError } = await mono.from("profile_dating").select("*");
  if (profilesError) throw profilesError;

  const { data: photos, error: photosError } = await mono.from("profile_dating_photos").select("*");
  if (photosError) throw photosError;

  const { data: conversations, error: conversationsError } = await mono.from("dating_conversations").select("*");
  if (conversationsError) throw conversationsError;

  const { data: messages, error: messagesError } = await mono.from("dating_messages").select("*");
  if (messagesError) throw messagesError;

  const { data: blocks, error: blocksError } = await mono.from("user_blocks").select("*");
  if (blocksError) throw blocksError;

  const cityIds = [...new Set(profiles.map((p) => p.city_id).filter(Boolean))];
  const { data: cities, error: citiesError } = await mono.from("cities").select("*").in("id", cityIds);
  if (citiesError) throw citiesError;

  const { data: authUsers, error: authError } = await mono.auth.admin.listUsers({ perPage: 1000 });
  if (authError) throw authError;
  const usersById = new Map(authUsers.users.map((u) => [u.id, u]));

  const profileOwners = profiles.map((p) => {
    const user = usersById.get(p.user_id);
    return {
      profileId: p.id,
      oldUserId: p.user_id,
      email: user?.email ?? null,
      isRealAccount: !!user,
    };
  });

  const real = profileOwners.filter((o) => o.isRealAccount).length;
  console.log(`profiles: ${profiles.length} (${real} with a real auth account, ${profiles.length - real} placeholder/seed)`);
  console.log(`photos: ${photos.length}, conversations: ${conversations.length}, messages: ${messages.length}, blocks: ${blocks.length}, cities referenced: ${cities.length}`);

  writeOutput("export", { profiles, photos, conversations, messages, blocks, cities, profileOwners });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
