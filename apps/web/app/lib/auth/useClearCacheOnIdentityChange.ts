import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
 *
 * The auth client is imported inside the effect, not at the top of the file:
 * this hook lives in the root route, which is rendered once at build time to
 * produce the SPA fallback page, and supabase-client throws at import when the
 * VITE_SUPABASE_* variables are absent (as in CI). Importing it lazily keeps
 * the build independent of runtime configuration — an effect only ever runs
 * in the browser.
 */
export function useClearCacheOnIdentityChange() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // undefined = no auth event seen yet; the first one only establishes who
    // is signed in, it isn't a change.
    let currentUserId: string | null | undefined;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void import("~/lib/supabase-client").then(({ supabase }) => {
      if (cancelled) return;
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
      unsubscribe = () => data.subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient]);
}
