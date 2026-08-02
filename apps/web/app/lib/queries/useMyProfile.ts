import { useQuery } from "@tanstack/react-query";
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
