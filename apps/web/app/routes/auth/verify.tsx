import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { supabase } from "~/lib/supabase-client";

export default function Verify() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"pending" | "done" | "error">("pending");

  useEffect(() => {
    // detectSessionInUrl (set on the client) already exchanges the magic-link
    // code for a session on load; this just waits for that to settle.
    supabase.auth.getSession().then(({ data, error }) => {
      setStatus(error || !data.session ? "error" : "done");
    });
  }, []);

  if (status === "done") {
    return <Navigate to={searchParams.get("redirect") ?? "/discover"} replace />;
  }

  if (status === "error") {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-muted">Connexion en cours...</p>
    </div>
  );
}
