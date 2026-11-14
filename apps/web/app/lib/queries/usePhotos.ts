import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";

export function usePhotos(profileId: string | undefined) {
  return useQuery({
    queryKey: ["profile-photos", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_photos")
        .select("*")
        .eq("profile_id", profileId!)
        .order("position");
      if (error) throw error;
      return data;
    },
  });
}

// Direct update, like reordering would be: `visibility` is the one column
// besides `position` the owner's column-level UPDATE grant covers.
export function useSetPhotoVisibility(profileId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, visibility }: { photoId: string; visibility: "public" | "private" }) => {
      const { error } = await supabase.from("profile_photos").update({ visibility }).eq("id", photoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-photos", profileId] });
    },
  });
}

export function useInvalidatePhotos() {
  const queryClient = useQueryClient();
  return (profileId: string) => queryClient.invalidateQueries({ queryKey: ["profile-photos", profileId] });
}
