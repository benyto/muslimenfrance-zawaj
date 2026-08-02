import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "~/lib/supabase-client";

export type SessionState = {
  session: Session | null;
  loading: boolean;
};

// Single source of truth for the current auth session — mirrors it into
// React state via onAuthStateChange so every consumer re-renders on
// sign-in/sign-out/token-refresh without polling.
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setState({ session: data.session, loading: false });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) setState({ session, loading: false });
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
