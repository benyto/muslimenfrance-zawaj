import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProfileInput } from "@rencontre/shared";
import { supabase } from "~/lib/supabase-client";
import { useSession } from "~/lib/auth/useSession";

function toRow(input: ProfileInput) {
  return {
    nickname: input.nickname,
    gender: input.gender,
    birthdate: input.birthdate,
    interests: input.interests,
    height: input.height ?? null,
    weight: input.weight ?? null,
    eye_color: input.eyeColor ?? null,
    hair_color: input.hairColor ?? null,
    body_type: input.bodyType ?? null,
    education_level: input.educationLevel ?? null,
    occupation: input.occupation ?? null,
    employment_status: input.employmentStatus ?? null,
    income_range: input.incomeRange ?? null,
    ethnicity: input.ethnicity ?? null,
    religion: input.religion ?? null,
    religiosity_level: input.religiosityLevel ?? null,
    languages_spoken: input.languagesSpoken,
    relationship_goal: input.relationshipGoal ?? null,
    smoker: input.smoker ?? null,
    drinker: input.drinker ?? null,
    has_children: input.hasChildren ?? null,
    wants_children: input.wantsChildren ?? null,
    city_id: input.cityId ?? null,
    special_category_consent: input.specialCategoryConsent,
  };
}

// `isFirstConsent` controls whether special_category_consent_at gets
// (re)stamped: only on the action that actually grants consent for the
// first time, not on every subsequent edit of an already-consenting
// profile — otherwise every save would misrepresent when consent was
// originally given.
export function useUpsertProfile() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ input, isFirstConsent }: { input: ProfileInput; isFirstConsent: boolean }) => {
      if (!session) throw new Error("Not authenticated");

      const row = {
        user_id: session.user.id,
        ...toRow(input),
        ...(isFirstConsent ? { special_category_consent_at: new Date().toISOString() } : {}),
      };

      const { data, error } = await supabase
        .from("profiles")
        .upsert(row, { onConflict: "user_id" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });
}
