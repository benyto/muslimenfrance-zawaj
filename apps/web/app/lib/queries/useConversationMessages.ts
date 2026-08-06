import { useEffect } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import type { Database } from "@rencontre/shared";
import { supabase } from "~/lib/supabase-client";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type PageParam = { before: string } | undefined;

const PAGE_SIZE = 30;

// Paginated rather than one unbounded fetch of the whole conversation — the
// old version had no limit at all, fine for the ~15-message migrated
// threads but not something that scales to a real long-running
// conversation. Fetches newest-first, PAGE_SIZE at a time, then reverses
// each page to ascending before storing it — so page[0] holds the most
// recent PAGE_SIZE messages (ascending), page[1] the next-older PAGE_SIZE,
// and so on. Realtime inserts always belong at the end of page[0], the
// newest page, regardless of how many older pages have since been loaded.
export function useConversationMessages(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["messages", conversationId];

  const query = useInfiniteQuery({
    queryKey,
    enabled: !!conversationId,
    initialPageParam: undefined as PageParam,
    queryFn: async ({ pageParam }) => {
      let request = supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) request = request.lt("created_at", pageParam.before);
      const { data, error } = await request;
      if (error) throw error;
      return data.reverse();
    },
    getNextPageParam: (lastPage) =>
      lastPage.length < PAGE_SIZE ? undefined : { before: lastPage[0].created_at },
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
          queryClient.setQueryData<InfiniteData<Message[], PageParam>>(queryKey, (old) => {
            if (!old || old.pages.length === 0) return old;
            const [newestPage, ...olderPages] = old.pages;
            if (newestPage.some((m) => m.id === incoming.id)) return old;
            return { ...old, pages: [[...newestPage, incoming], ...olderPages] };
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

// pages is [newest, ..., oldest] internally (see above) but the thread
// needs to render oldest-to-newest, top-to-bottom.
export function flattenMessagePages(pages: Message[][] | undefined): Message[] {
  if (!pages) return [];
  return [...pages].reverse().flat();
}
