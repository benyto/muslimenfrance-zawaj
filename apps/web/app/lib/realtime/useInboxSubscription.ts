import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";

// Global "new message landed in one of my conversations" signal, separate
// from the per-conversation channel in useConversationMessages — Realtime
// postgres_changes filters don't support OR across columns, so this can't
// be combined with a profile1_id/profile2_id filter. Only needs to watch
// incoming messages: outgoing ones already refresh the list via the
// send-message mutation's onSuccess.
export function useInboxSubscription(myProfileId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!myProfileId) return;

    const channel = supabase
      .channel(`inbox:${myProfileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_profile_id=eq.${myProfileId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          queryClient.invalidateQueries({ queryKey: ["messages"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myProfileId, queryClient]);
}
