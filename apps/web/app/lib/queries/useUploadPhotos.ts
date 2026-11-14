import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "~/lib/api-client";

// Photos go to the API as multipart rather than straight to storage: the API
// is what checks the file is really an image, shrinks it and strips its
// metadata, and enforces the photo limit. One request per file, in order, so
// a failure on one (too large, not an image) doesn't lose the others and each
// is counted against the limit as it lands.
export function useUploadPhotos(profileId: string | undefined) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["profile-photos", profileId] });

  return useMutation({
    mutationFn: async (files: File[]) => {
      const errors: string[] = [];
      let uploaded = 0;
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        try {
          await apiFetch("/photos", { method: "POST", body });
          uploaded++;
          // Show each photo as soon as it's stored.
          await refresh();
        } catch (error) {
          errors.push(`${file.name} : ${(error as Error).message}`);
        }
      }
      return { uploaded, errors };
    },
    onSettled: refresh,
  });
}
