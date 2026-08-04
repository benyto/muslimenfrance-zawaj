import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Database } from "@rencontre/shared";
import { supabase } from "~/lib/supabase-client";
import { useToast } from "~/components/ui/toast";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type ConversationSummary = Database["public"]["Functions"]["get_my_conversations"]["Returns"][number];

// Global "new message landed in one of my conversations" signal, separate
// from the per-conversation channel in useConversationMessages — Realtime
// postgres_changes filters don't support OR across columns, so this can't
// be combined with a profile1_id/profile2_id filter. Only needs to watch
// incoming messages: outgoing ones already refresh the list via the
// send-message mutation's onSuccess.
//
// activeProfileId is the conversation currently open on screen, if any —
// its messages already render live in the open thread, so toasting them
// too would just be noise.
export function useInboxSubscription(myProfileId: string | undefined, activeProfileId?: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

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
        (payload) => {
          const message = payload.new as Message;
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          queryClient.invalidateQueries({ queryKey: ["messages"] });

          if (message.sender_profile_id === activeProfileId) return;

          void notifyNewMessage(message, queryClient, toast);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myProfileId, activeProfileId, queryClient, toast]);
}

async function notifyNewMessage(
  message: Message,
  queryClient: ReturnType<typeof useQueryClient>,
  toast: ReturnType<typeof useToast>
) {
  // Cheapest path first: the sender is very likely already in the cached
  // conversation list (this is rarely someone's very first message). Direct
  // reads of another member's profiles row are blocked by RLS (owner-only
  // select), so the fallback for a genuinely new conversation has to go
  // through get_profile_detail — the same security-definer RPC the rest of
  // the app uses to look at another member's profile — rather than a
  // table select that RLS would just silently deny.
  const cached = queryClient.getQueryData<ConversationSummary[]>(["conversations"]);
  let senderName = cached?.find((c) => c.other_profile_id === message.sender_profile_id)?.other_nickname;

  if (!senderName) {
    try {
      const { data } = await supabase
        .rpc("get_profile_detail", { p_profile_id: message.sender_profile_id })
        .single();
      senderName = data?.nickname ?? undefined;
    } catch {
      // Fall through with no name — still worth notifying.
    }
  }

  toast({
    tone: "info",
    title: senderName ? `Nouveau message de ${senderName}` : "Nouveau message",
    description: message.content.length > 80 ? `${message.content.slice(0, 80)}…` : message.content,
  });
}
