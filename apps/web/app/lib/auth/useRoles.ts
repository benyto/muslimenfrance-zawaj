import { useQuery } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";
import { useSession } from "~/lib/auth/useSession";

// Backed by the get_my_roles() RPC (Phase 1) — a security-definer function
// that re-derives the caller's roles from user_roles server-side. This is a
// UX convenience only: every privileged mutation independently re-checks the
// role server-side (RLS and/or an Edge Function), never trusting this value.
export function useRoles() {
  const { session } = useSession();

  return useQuery({
    queryKey: ["my-roles", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_roles");
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });
}
