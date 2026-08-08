import { useEffect, useRef, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Database } from "@rencontre/shared";
import { supabase } from "~/lib/supabase-client";
import { useToast } from "~/components/ui/toast";
import { useIgnoredProfileIds } from "~/lib/queries/useIgnoreActions";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type ConversationSummary = Database["public"]["Functions"]["get_my_conversations"]["Returns"][number];

// Global "new message landed in one of my conversations" signal, separate
// from the per-conversation channel in useConversationMessages — Realtime
// postgres_changes filters don't support OR across columns, so this can't
// be combined with a profile1_id/profile2_id filter. Only needs to watch
// incoming messages: outgoing ones already refresh the list via the
// send-message mutation's onSuccess.
//
// pinnedProfileRef holds the conversation partner whose thread is both open
// AND scrolled to the bottom right now, if any — written by the chat route.
// Being *on* /messages/:id isn't enough to skip the toast: the thread now
// paginates, so the reader could be scrolled up through older messages and
// never see one that lands at the bottom. Read as a ref (not a prop) so
// this hook doesn't need to re-subscribe every time the reader scrolls.
export function useInboxSubscription(
  myProfileId: string | undefined,
  pinnedProfileRef: RefObject<string | null>
) {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Ignoring someone doesn't stop their messages from being written (unlike
  // a block, which the DB itself refuses) — get_my_conversations() already
  // drops them from the list server-side, but this realtime handler fires
  // straight off the INSERT and has to independently know not to react. A
  // ref (not a dependency) so the channel doesn't need to resubscribe every
  // time the ignored list changes.
  const ignoredIds = useIgnoredProfileIds();
  const ignoredIdsRef = useRef(ignoredIds);
  useEffect(() => {
    ignoredIdsRef.current = ignoredIds;
  }, [ignoredIds]);

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
          if (ignoredIdsRef.current.has(message.sender_profile_id)) return;

          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          queryClient.invalidateQueries({ queryKey: ["messages"] });

          if (message.sender_profile_id === pinnedProfileRef.current) return;

          void notifyNewMessage(message, queryClient, toast);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myProfileId, queryClient, toast]);
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
