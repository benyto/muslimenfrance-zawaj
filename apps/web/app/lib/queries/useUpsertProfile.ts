import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SPECIAL_CATEGORY_CONSENT_VERSION, type ProfileInput } from "@rencontre/shared";
import { supabase } from "~/lib/supabase-client";
import { useSession } from "~/lib/auth/useSession";

function toRow(input: ProfileInput) {
  return {
    nickname: input.nickname,
    // bio / looking_for are deliberately not written here: on an approved
    // profile the database refuses direct changes to them, because an edit has
    // to be validated by a moderator first. They go through
    // submit_profile_texts below.
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
    // An emptied field is "no value", not an empty string.
    ethnicity: input.ethnicity?.trim() || null,
    religion: input.religion ?? null,
    religiosity_level: input.religiosityLevel ?? null,
    languages_spoken: input.languagesSpoken,
    relationship_goal: input.relationshipGoal ?? null,
    smoker: input.smoker ?? null,
    drinker: input.drinker ?? null,
    has_children: input.hasChildren ?? null,
    wants_children: input.wantsChildren ?? null,
    commune_insee_code: input.communeInseeCode ?? null,
    origin_country_code: input.originCountryCode ?? null,
    special_category_consent: input.specialCategoryConsent,
  };
}

// `recordConsent` is true when the member has just ticked the consent box
// under the current wording and the profile doesn't already carry that version.
// The date and version are written by the database function below, not sent
// from here — the browser is not trusted to say when, or to what, someone agreed.
export function useUpsertProfile() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ input, recordConsent }: { input: ProfileInput; recordConsent: boolean }) => {
      if (!session) throw new Error("Not authenticated");

      const row = {
        user_id: session.user.id,
        ...toRow(input),
      };

      const { data, error } = await supabase
        .from("profiles")
        .upsert(row, { onConflict: "user_id" })
        .select()
        .single();

      if (error) throw error;

      if (recordConsent) {
        const { error: consentError } = await supabase.rpc("record_special_category_consent", {
          p_version: SPECIAL_CATEGORY_CONSENT_VERSION,
        });
        if (consentError) throw consentError;
      }

      // Saved in a second step so an approved profile's edited text becomes a
      // pending change (the previous text stays visible until a moderator
      // approves it) instead of overwriting the live one.
      const { error: textsError } = await supabase.rpc("submit_profile_texts", {
        p_bio: input.bio ?? "",
        p_looking_for: input.lookingFor ?? "",
      });
      if (textsError) throw textsError;

      // Whether an edit is now waiting for a moderator, so the form can say so.
      const { data: pending, error: pendingError } = await supabase
        .from("profiles")
        .select("bio_pending, looking_for_pending")
        .eq("user_id", session.user.id)
        .single();
      if (pendingError) throw pendingError;
      return {
        ...data,
        textsPending: pending.bio_pending != null || pending.looking_for_pending != null,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });
}
