// Inserts into the new `profiles` table, preserving the original profile
// id (nothing else references it externally yet, so this is safe and keeps
// conversations/messages/blocks below trivially reusable — no id
// remapping needed for those).
//
// special_category_consent is backfilled `true` for every migrated profile
// — an explicit product decision (the monolith never actually collected
// this consent; see the plan's "Data migration" section for the fuller
// reasoning). special_category_consent_at is stamped with the migration
// run time, not backdated, since that's when consent was actually granted
// (by this decision), not when the row originally existed.
import { rencontre } from "./lib/clients.js";
import { readOutput } from "./lib/io.js";
import type { Database } from "@rencontre/shared";

type MonolithProfile = {
  id: string;
  user_id: string;
  nickname: string;
  gender: string;
  birthdate: string;
  interests: string[] | null;
  city_id: string | null;
  created_at: string;
  updated_at: string;
  height: number | null;
  weight: number | null;
  eye_color: string | null;
  hair_color: string | null;
  body_type: string | null;
  education_level: string | null;
  occupation: string | null;
  employment_status: string | null;
  income_range: string | null;
  ethnicity: string | null;
  religion: string | null;
  religiosity_level: string | null;
  languages_spoken: string[] | null;
  relationship_goal: string | null;
  smoker: string | null;
  drinker: string | null;
  has_children: boolean | null;
  wants_children: string | null;
  status: string;
};

type UserMap = Record<string, { newUserId: string }>;
type CityMap = Record<string, string | null>;

const statusMap: Record<string, Database["public"]["Tables"]["profiles"]["Row"]["moderation_status"]> = {
  published: "approved",
  pending: "pending",
  blocked: "disabled",
  disabled: "disabled",
};

// Empty strings ("" was seen in monolith data, e.g. income_range) become
// null rather than being stored as a falsy-but-present value that the
// SPA's <select>/<input> would render indistinguishably from "unset".
function nullifyEmpty<T>(value: T | null | undefined): T | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

async function main() {
  const { profiles } = readOutput<{ profiles: MonolithProfile[] }>("export");
  const userMap = readOutput<UserMap>("user-map");
  const cityMap = readOutput<CityMap>("city-map");

  const now = new Date().toISOString();
  const rows = profiles.map((p) => ({
    id: p.id,
    user_id: userMap[p.user_id].newUserId,
    nickname: p.nickname,
    gender: p.gender,
    birthdate: p.birthdate,
    interests: p.interests ?? [],
    height: p.height,
    weight: p.weight,
    eye_color: nullifyEmpty(p.eye_color),
    hair_color: nullifyEmpty(p.hair_color),
    body_type: nullifyEmpty(p.body_type),
    education_level: nullifyEmpty(p.education_level),
    occupation: nullifyEmpty(p.occupation),
    employment_status: nullifyEmpty(p.employment_status),
    income_range: nullifyEmpty(p.income_range),
    ethnicity: nullifyEmpty(p.ethnicity),
    religion: nullifyEmpty(p.religion),
    religiosity_level: nullifyEmpty(p.religiosity_level),
    languages_spoken: p.languages_spoken ?? [],
    relationship_goal: nullifyEmpty(p.relationship_goal),
    smoker: nullifyEmpty(p.smoker),
    drinker: nullifyEmpty(p.drinker),
    has_children: p.has_children,
    wants_children: nullifyEmpty(p.wants_children),
    commune_insee_code: p.city_id ? cityMap[p.city_id] : null,
    moderation_status: statusMap[p.status] ?? "pending",
    special_category_consent: true,
    special_category_consent_at: now,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  const { data, error } = await rencontre.from("profiles").insert(rows).select("id, nickname");
  if (error) throw error;

  console.log(`inserted ${data.length} profiles`);
  for (const row of data) console.log(`  - ${row.nickname} (${row.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
