import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";
import { useMyProfile } from "~/lib/queries/useMyProfile";

export function useIgnoredProfiles() {
  return useQuery({
    queryKey: ["ignored-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_ignored_profiles");
      if (error) throw error;
      return data;
    },
  });
}

// Set form for cheap membership checks (useInboxSubscription's toast
// suppression) without re-scanning the list.
export function useIgnoredProfileIds(): Set<string> {
  const { data } = useIgnoredProfiles();
  return new Set(data?.map((r) => r.ignored_profile_id) ?? []);
}

export function useIsIgnored(profileId: string | undefined) {
  const { data: ignored } = useIgnoredProfiles();
  return !!profileId && !!ignored?.some((r) => r.ignored_profile_id === profileId);
}

export function useIgnoreProfile() {
  const { data: myProfile } = useMyProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ignoredProfileId: string) => {
      if (!myProfile) throw new Error("No profile");
      const { error } = await supabase
        .from("profile_ignores")
        .insert({ ignorer_profile_id: myProfile.id, ignored_profile_id: ignoredProfileId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ignored-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["discover"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useUnignoreProfile() {
  const { data: myProfile } = useMyProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ignoredProfileId: string) => {
      if (!myProfile) throw new Error("No profile");
      const { error } = await supabase
        .from("profile_ignores")
        .delete()
        .eq("ignorer_profile_id", myProfile.id)
        .eq("ignored_profile_id", ignoredProfileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ignored-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["discover"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
