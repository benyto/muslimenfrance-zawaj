import { Navigate, Outlet } from "react-router";
import { useMyProfile } from "~/lib/queries/useMyProfile";

// Gates the member workspace (discover, messages, other profiles) behind an
// approved profile. Everything a not-yet-approved member legitimately needs
// stays outside this guard: /profile/me (to finish the profile), /settings
// (data export and account deletion are rights, not features) and
// /verification (the explanation page they're sent to). UX only — the same
// rule is enforced by the RPCs and the API, which is what actually matters.
export default function RequireApproved() {
  // isPending, not isLoading: while the session is still resolving the query
  // is disabled, which isLoading reports as false — and a "no profile yet"
  // redirect would fire on every page load.
  const { data: profile, isPending, isError } = useMyProfile();

  if (isPending) return null;

  if (isError) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        Impossible de vérifier votre profil pour le moment. Rechargez la page.
      </p>
    );
  }

  if (!profile) return <Navigate to="/profile/me" replace />;
  if (profile.moderation_status !== "approved") return <Navigate to="/verification" replace />;

  return <Outlet />;
}
