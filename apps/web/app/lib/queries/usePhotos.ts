import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";

// UploadThing app id — same value as apps/api's UPLOADTHING_TOKEN's app,
// needed client-side only to build the public <app-id>.ufs.sh URL while
// files are public-read. Once private mode lands, this goes away in favor
// of signed URLs returned from the API.
const UPLOADTHING_APP_ID = import.meta.env.VITE_UPLOADTHING_APP_ID;

export function photoUrl(key: string) {
  return `https://${UPLOADTHING_APP_ID}.ufs.sh/f/${key}`;
}

export function usePhotos(profileId: string | undefined) {
  return useQuery({
    queryKey: ["profile-photos", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_photos")
        .select("*")
        .eq("profile_id", profileId!)
        .order("position");
      if (error) throw error;
      return data;
    },
  });
}

export function useInvalidatePhotos() {
  const queryClient = useQueryClient();
  return (profileId: string) => queryClient.invalidateQueries({ queryKey: ["profile-photos", profileId] });
}
