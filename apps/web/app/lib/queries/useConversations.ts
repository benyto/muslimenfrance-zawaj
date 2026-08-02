import { useQuery } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_conversations");
      if (error) throw error;
      return data;
    },
    refetchInterval: 15_000,
  });
}

export function useConversationWithProfile(myProfileId: string | undefined, otherProfileId: string | undefined) {
  return useQuery({
    queryKey: ["conversation-with", myProfileId, otherProfileId],
    enabled: !!myProfileId && !!otherProfileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(profile1_id.eq.${myProfileId},profile2_id.eq.${otherProfileId}),and(profile1_id.eq.${otherProfileId},profile2_id.eq.${myProfileId})`
        )
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });
}
