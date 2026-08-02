import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";
import { useMyProfile } from "~/lib/queries/useMyProfile";

export function useBlockedProfiles() {
  return useQuery({
    queryKey: ["blocked-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_blocked_profiles");
      if (error) throw error;
      return data;
    },
  });
}

export function useBlockProfile() {
  const { data: myProfile } = useMyProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockedProfileId: string) => {
      if (!myProfile) throw new Error("No profile");
      const { error } = await supabase
        .from("user_blocks")
        .insert({ blocker_profile_id: myProfile.id, blocked_profile_id: blockedProfileId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["discover"] });
    },
  });
}

export function useUnblockProfile() {
  const { data: myProfile } = useMyProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockedProfileId: string) => {
      if (!myProfile) throw new Error("No profile");
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_profile_id", myProfile.id)
        .eq("blocked_profile_id", blockedProfileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["discover"] });
    },
  });
}
