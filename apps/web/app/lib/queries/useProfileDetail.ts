import { useQuery } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";

export function useProfileDetail(profileId: string | undefined) {
  return useQuery({
    queryKey: ["profile-detail", profileId],
    enabled: !!profileId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profile_detail", { p_profile_id: profileId! }).single();
      if (error) throw error;
      return data;
    },
  });
}
