import { useEffect } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import type { Database } from "@rencontre/shared";
import { supabase } from "~/lib/supabase-client";

type Message = Database["public"]["Tables"]["messages"]["Row"];
// (created_at, id) rather than created_at alone: rows that share a timestamp
// at a page boundary would otherwise be skipped by a strict "<".
type PageParam = { before: string; beforeId: string } | undefined;

const PAGE_SIZE = 30;

// Puts a message at the end of its thread's newest page — the one place a new
// message belongs, however many older pages have been loaded. Used by the
// thread's own realtime subscription and by the send mutation, which can both
// deliver the same message, so it is added once: skipped if any loaded page
// already has it. A thread that isn't in the cache is left alone; it loads
// fresh when opened.
export function appendMessage(queryClient: QueryClient, message: Message) {
  queryClient.setQueryData<InfiniteData<Message[], PageParam>>(["messages", message.conversation_id], (old) => {
    if (!old || old.pages.length === 0) return old;
    if (old.pages.some((page) => page.some((m) => m.id === message.id))) return old;
    const [newestPage, ...olderPages] = old.pages;
    return { ...old, pages: [[...newestPage, message], ...olderPages] };
  });
}

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
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) {
        request = request.or(
          `created_at.lt.${pageParam.before},and(created_at.eq.${pageParam.before},id.lt.${pageParam.beforeId})`
        );
      }
      const { data, error } = await request;
      if (error) throw error;
      return data.reverse();
    },
    getNextPageParam: (lastPage) =>
      lastPage.length < PAGE_SIZE
        ? undefined
        : { before: lastPage[0].created_at, beforeId: lastPage[0].id },
  });

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => appendMessage(queryClient, payload.new as Message)
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
