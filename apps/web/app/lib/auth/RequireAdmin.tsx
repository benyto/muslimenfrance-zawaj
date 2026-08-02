import { Navigate, Outlet } from "react-router";
import { useSession } from "~/lib/auth/useSession";
import { useRoles } from "~/lib/auth/useRoles";

// Client-side gate is UX only — every admin mutation is routed through an
// Edge Function that independently re-derives the caller's role from
// user_roles using a service-role client, so this check can never be the
// only thing standing between a non-admin and a privileged action.
export default function RequireAdmin() {
  const { session, loading: sessionLoading } = useSession();
  const { data: roles, isLoading: rolesLoading } = useRoles();

  if (sessionLoading || (session && rolesLoading)) return null;
  if (!session) return <Navigate to="/auth/login" replace />;
  if (!roles?.some((role) => role === "admin" || role === "moderator")) {
    return <Navigate to="/discover" replace />;
  }

  return <Outlet />;
}
