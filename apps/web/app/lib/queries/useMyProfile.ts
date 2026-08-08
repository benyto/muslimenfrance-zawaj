import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";
import { useSession } from "~/lib/auth/useSession";

export function useMyProfile() {
  const { session } = useSession();

  return useQuery({
    queryKey: ["my-profile", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// Deliberately its own mutation rather than folded into the big profile
// form save — this is a privacy toggle in Settings, not a profile field,
// and shouldn't require touching the rest of the profile to change.
export function useUpdatePresenceVisibility() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (showOnlineStatus: boolean) => {
      if (!session) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ show_online_status: showOnlineStatus })
        .eq("user_id", session.user.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
  });
}
