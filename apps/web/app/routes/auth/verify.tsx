import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { supabase } from "~/lib/supabase-client";
import { StarSpinner } from "~/components/ui/star";
import { safeRedirect } from "~/lib/auth/safe-redirect";

export default function Verify() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"pending" | "done" | "error">("pending");

  useEffect(() => {
    // detectSessionInUrl (set on the client) already exchanges the magic-link
    // code for a session on load; this just waits for that to settle.
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        setStatus(error || !data.session ? "error" : "done");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "done") {
    return <Navigate to={safeRedirect(searchParams.get("redirect"))} replace />;
  }

  // No session after the magic link was processed: it was expired, already
  // used (mail scanners often open links first), or malformed. Back to the
  // login form, which explains why and keeps the intended destination.
  if (status === "error") {
    const params = new URLSearchParams({ error: "link_expired" });
    const redirect = searchParams.get("redirect");
    if (redirect) params.set("redirect", redirect);
    return <Navigate to={`/auth/login?${params}`} replace />;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
      <StarSpinner className="h-8 w-8 text-accent" label="Connexion en cours" />
      <p className="text-sm text-muted">Connexion en cours...</p>
    </div>
  );
}
