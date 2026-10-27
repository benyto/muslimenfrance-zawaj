import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";

// The owner's side of private photos: open requests + current grants (see
// get_my_photo_access). refetchInterval so a new request shows up in the
// nav badge without needing a realtime channel for something this rare.
export function useMyPhotoAccess() {
  return useQuery({
    queryKey: ["photo-access"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_photo_access");
      if (error) throw error;
      return data;
    },
  });
}

export function usePendingPhotoAccessCount() {
  const { data } = useMyPhotoAccess();
  return data?.filter((r) => r.status === "pending").length ?? 0;
}

export function useHasPhotoAccessGrant(viewerProfileId: string | undefined) {
  const { data } = useMyPhotoAccess();
  return !!viewerProfileId && !!data?.some((r) => r.viewer_profile_id === viewerProfileId && r.status === "granted");
}

// Viewer asks an owner for access. The profile-detail query is what carries
// photo_access_status back, so that's what needs refreshing.
export function useRequestPhotoAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ownerProfileId: string) => {
      const { error } = await supabase.rpc("request_photo_access", { p_owner_profile_id: ownerProfileId });
      if (error) throw error;
    },
    onSuccess: (_data, ownerProfileId) => {
      queryClient.invalidateQueries({ queryKey: ["profile-detail", ownerProfileId] });
    },
  });
}

// Owner grants (also usable without a prior request) or withdraws access
// for one member.
export function useSetPhotoAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ viewerProfileId, grant }: { viewerProfileId: string; grant: boolean }) => {
      const { error } = await supabase.rpc("set_photo_access", {
        p_viewer_profile_id: viewerProfileId,
        p_grant: grant,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photo-access"] });
    },
  });
}
