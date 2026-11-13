import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";

/**
 * The query cache is shared by everything in the tab, and most private keys
 * ("conversations", "favorites", "subscription"...) don't contain a user id.
 * Without this, A signing out and B signing in within the same tab would
 * briefly read A's cached results — and A's still-running requests could
 * land in B's cache. So whenever the signed-in identity actually changes
 * (sign-out, or a different user), in-flight requests are cancelled and the
 * whole cache is dropped.
 *
 * Token refreshes and the initial session lookup keep the same user id and
 * leave the cache alone. Mount once, inside QueryClientProvider.
 */
export function useClearCacheOnIdentityChange() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // undefined = no auth event seen yet; the first one only establishes who
    // is signed in, it isn't a change.
    let currentUserId: string | null | undefined;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (currentUserId !== undefined && currentUserId !== nextUserId) {
        // Cancel before clearing, and don't await: nothing may fetch for the
        // new identity in between and then get wiped.
        void queryClient.cancelQueries();
        queryClient.clear();
      }
      currentUserId = nextUserId;
    });

    return () => data.subscription.unsubscribe();
  }, [queryClient]);
}
