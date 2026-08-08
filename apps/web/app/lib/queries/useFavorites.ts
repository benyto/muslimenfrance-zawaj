import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@rencontre/shared";
import { supabase } from "~/lib/supabase-client";
import { useMyProfile } from "~/lib/queries/useMyProfile";

export type Favorite = Database["public"]["Functions"]["get_my_favorites"]["Returns"][number];

export function useFavorites() {
  return useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_favorites");
      if (error) throw error;
      return data;
    },
  });
}

// Derived from the already-cached list rather than a dedicated query — the
// list is small (a bookmark set, not a feed) and every place that needs to
// know "is this profile favorited" already has useFavorites() mounted
// nearby (ConversationsList's sibling tab, ProfileDetailPanel's toggle).
export function useIsFavorited(profileId: string | undefined) {
  const { data: favorites } = useFavorites();
  return !!profileId && !!favorites?.some((f) => f.favorited_profile_id === profileId);
}

export function useAddFavorite() {
  const { data: myProfile } = useMyProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (favoritedProfileId: string) => {
      if (!myProfile) throw new Error("No profile");
      const { error } = await supabase
        .from("profile_favorites")
        .insert({ profile_id: myProfile.id, favorited_profile_id: favoritedProfileId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });
}

export function useRemoveFavorite() {
  const { data: myProfile } = useMyProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (favoritedProfileId: string) => {
      if (!myProfile) throw new Error("No profile");
      const { error } = await supabase
        .from("profile_favorites")
        .delete()
        .eq("profile_id", myProfile.id)
        .eq("favorited_profile_id", favoritedProfileId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });
}
