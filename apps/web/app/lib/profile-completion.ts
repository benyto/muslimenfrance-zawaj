import type { Database } from "@rencontre/shared";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// Below this, a nav badge + an on-page nudge invite the member to fill in
// more of their profile — under-filled profiles are harder for other
// members to evaluate and connect with. One named constant rather than a
// magic number scattered across AppShell/me.tsx, so it's a single place to
// tune later.
export const PROFILE_COMPLETION_THRESHOLD = 80;

// nickname/gender/birthdate/special_category_consent are required just to
// have a profile row at all, so they'd always read as "done" and only
// inflate the score without telling anyone anything — left out on purpose.
// Everything here is genuinely optional, so the percentage reflects how
// filled-out the profile actually is, not the bare minimum to save it.
const TEXT_FIELDS: (keyof ProfileRow)[] = [
  "bio",
  "looking_for",
  "height",
  "weight",
  "eye_color",
  "hair_color",
  "body_type",
  "education_level",
  "occupation",
  "employment_status",
  "income_range",
  "ethnicity",
  "religion",
  "religiosity_level",
  "relationship_goal",
  "smoker",
  "drinker",
  "wants_children",
  "commune_insee_code",
  "origin_country_code",
];

// +1 each for interests, languages_spoken, has_children, and having at
// least one photo — none of those are in TEXT_FIELDS' plain "not null/empty"
// check (arrays and a nullable boolean need their own rule).
const EXTRA_CRITERIA_COUNT = 4;

export function computeProfileCompletion(
  profile: Pick<ProfileRow, (typeof TEXT_FIELDS)[number] | "interests" | "languages_spoken" | "has_children"> | null | undefined,
  photoCount: number
): number {
  const total = TEXT_FIELDS.length + EXTRA_CRITERIA_COUNT;
  if (!profile) return 0;

  let filled = 0;
  for (const key of TEXT_FIELDS) {
    const value = profile[key];
    if (value !== null && value !== undefined && value !== "") filled++;
  }
  if (profile.interests.length > 0) filled++;
  if (profile.languages_spoken.length > 0) filled++;
  if (profile.has_children !== null) filled++;
  if (photoCount > 0) filled++;

  return Math.round((filled / total) * 100);
}
