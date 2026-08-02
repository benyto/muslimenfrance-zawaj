import { Navigate, Outlet, useLocation } from "react-router";
import { useSession } from "~/lib/auth/useSession";

export default function RequireAuth() {
  const { session, loading } = useSession();
  const location = useLocation();

  if (loading) return null;

  if (!session) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
}
