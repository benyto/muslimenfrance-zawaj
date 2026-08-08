import { useNavigate, useParams } from "react-router";
import { ProfileDetailPanel } from "~/components/profile/ProfileDetailPanel";

// Real content lives in MessagingWorkspaceLayout's right-hand panel on
// desktop — same treatment as /messages/:profileId and /discover's
// ?preview= — so this route only needs the mobile full-screen drill-in,
// matching /discover's pattern. Breakpoint must match the panel's in
// MessagingWorkspaceLayout.
export default function ProfileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <>
      <div className="xl:hidden">
        <ProfileDetailPanel profileId={id} onClose={() => navigate(-1)} />
      </div>
      <div className="hidden min-h-[50vh] items-center justify-center xl:flex">
        <p className="text-sm text-muted">Ce profil s&apos;affiche dans le panneau de droite.</p>
      </div>
    </>
  );
}
