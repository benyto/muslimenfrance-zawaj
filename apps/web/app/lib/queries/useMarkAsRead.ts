import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, myProfileId }: { conversationId: string; myProfileId: string }) => {
      const { error } = await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .eq("recipient_profile_id", myProfileId)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });
}
