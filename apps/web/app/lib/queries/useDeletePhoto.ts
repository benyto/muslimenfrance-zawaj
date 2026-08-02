import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "~/lib/api-client";

export function useDeletePhoto(profileId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (photoId: string) => apiFetch(`/photos/${photoId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-photos", profileId] });
    },
  });
}
