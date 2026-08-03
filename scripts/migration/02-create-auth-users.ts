// Real accounts (benyto2@hotmail.fr, salias3@hotmail.com,
// b_youssef2@hotmail.com — the developer's own test accounts, per Phase 10's
// finding that the monolith's dating feature has no other real end users
// yet) are created under the SAME email so magic-link login keeps working,
// or reused if that email already has an account in this project.
//
// Placeholder/seed profiles (user_id 00000000-0000-0000-0000-00000000000N)
// have no real account to preserve — they were explicitly chosen to be
// migrated anyway (to populate the new app for demo/QA), so each gets a
// synthetic account on a `.invalid` address. IANA reserves `.invalid`
// specifically for addresses that must never resolve, so this can never
// accidentally deliver mail to a real person even if something later tried
// to email it. Nobody is meant to ever log into these.
import { mono, rencontre } from "./lib/clients.js";
import { readOutput, writeOutput } from "./lib/io.js";

type Export = {
  profileOwners: { profileId: string; oldUserId: string; email: string | null; isRealAccount: boolean }[];
  profiles: { id: string; nickname: string }[];
};

async function findExistingByEmail(email: string) {
  // supabase-js has no getUserByEmail; the project has few enough users
  // that listing is fine at this scale (single-page default is 1000).
  const { data, error } = await rencontre.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function main() {
  const { profileOwners, profiles } = readOutput<Export>("export");
  const nicknameByProfileId = new Map(profiles.map((p) => [p.id, p.nickname]));

  const userMap: Record<string, { newUserId: string; email: string; isRealAccount: boolean }> = {};

  for (const owner of profileOwners) {
    if (userMap[owner.oldUserId]) continue; // one profile per user_id here, but guard anyway

    if (owner.isRealAccount && owner.email) {
      const existing = await findExistingByEmail(owner.email);
      if (existing) {
        console.log(`reuse existing account for ${owner.email} -> ${existing.id}`);
        userMap[owner.oldUserId] = { newUserId: existing.id, email: owner.email, isRealAccount: true };
        continue;
      }
      const { data, error } = await rencontre.auth.admin.createUser({ email: owner.email, email_confirm: true });
      if (error) throw error;
      console.log(`created real account for ${owner.email} -> ${data.user.id}`);
      userMap[owner.oldUserId] = { newUserId: data.user.id, email: owner.email, isRealAccount: true };
    } else {
      const nickname = nicknameByProfileId.get(owner.profileId) ?? "seed";
      const slug = nickname
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .toLowerCase();
      const shortId = owner.oldUserId.slice(-4);
      const email = `seed-${slug}-${shortId}@rencontre.invalid`;
      const { data, error } = await rencontre.auth.admin.createUser({ email, email_confirm: true });
      if (error) throw error;
      console.log(`created seed account for ${email} -> ${data.user.id}`);
      userMap[owner.oldUserId] = { newUserId: data.user.id, email, isRealAccount: false };
    }
  }

  writeOutput("user-map", userMap);
  console.log(`\n${Object.keys(userMap).length} accounts mapped (${Object.values(userMap).filter((u) => u.isRealAccount).length} real, ${Object.values(userMap).filter((u) => !u.isRealAccount).length} seed).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
