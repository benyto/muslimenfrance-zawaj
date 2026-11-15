import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SPECIAL_CATEGORY_CONSENT_VERSION } from "@rencontre/shared";
import { supabase } from "~/lib/supabase-client";
import { useSession } from "~/lib/auth/useSession";

// For members who agreed to an earlier wording of the special-category consent
// (see ConsentRenewalDialog). The version and date are recorded by the
// database function, not sent from here.
export function useAcceptSpecialCategoryConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("record_special_category_consent", {
        p_version: SPECIAL_CATEGORY_CONSENT_VERSION,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
  });
}

// The alternative to accepting: take the newly-covered data off the profile.
export function useRemoveEthnicity() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Not authenticated");
      const { error } = await supabase.from("profiles").update({ ethnicity: null }).eq("user_id", session.user.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
  });
}
