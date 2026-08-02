import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@rencontre/shared";
import { supabase } from "~/lib/supabase-client";

type Message = Database["public"]["Tables"]["messages"]["Row"];

export function useConversationMessages(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["messages", conversationId];

  const query = useQuery({
    queryKey,
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = payload.new as Message;
          queryClient.setQueryData<Message[]>(queryKey, (old) => {
            if (!old) return [incoming];
            if (old.some((m) => m.id === incoming.id)) return old;
            return [...old, incoming];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, queryClient]);

  return query;
}
