import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "~/lib/api-client";

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recipientProfileId, content }: { recipientProfileId: string; content: string }) =>
      apiFetch("/messages", {
        method: "POST",
        body: JSON.stringify({ recipientProfileId, content }),
      }) as Promise<{ conversation_id: string }>,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (data?.conversation_id) {
        queryClient.invalidateQueries({ queryKey: ["messages", data.conversation_id] });
        queryClient.invalidateQueries({ queryKey: ["conversation-with"] });
      }
    },
  });
}
