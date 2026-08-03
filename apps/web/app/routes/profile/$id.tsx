import { useNavigate, useParams } from "react-router";
import { ProfileDetailPanel } from "~/components/profile/ProfileDetailPanel";

export default function ProfileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ProfileDetailPanel profileId={id} onBlocked={() => navigate("/discover")} />
    </div>
  );
}
