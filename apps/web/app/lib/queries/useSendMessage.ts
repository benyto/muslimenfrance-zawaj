import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@rencontre/shared";
import { apiFetch } from "~/lib/api-client";
import { appendMessage } from "~/lib/queries/useConversationMessages";

type Message = Database["public"]["Tables"]["messages"]["Row"];

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recipientProfileId, content }: { recipientProfileId: string; content: string }) =>
      apiFetch("/messages", {
        method: "POST",
        body: JSON.stringify({ recipientProfileId, content }),
      }) as Promise<Message>,
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (message?.conversation_id) {
        // The server returned the message: show it now rather than re-reading
        // every page of the thread to find it. (The thread's realtime
        // subscription delivers the same row; appendMessage adds it once.)
        appendMessage(queryClient, message);
        queryClient.invalidateQueries({ queryKey: ["conversation-with"] });
      }
    },
  });
}
