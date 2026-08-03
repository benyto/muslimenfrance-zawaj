import { ProfileForm } from "~/components/profile/ProfileForm";
import { PhotoManager } from "~/components/profile/PhotoManager";
import { useMyProfile } from "~/lib/queries/useMyProfile";

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "En cours de vérification", className: "bg-warning-soft text-warning" },
  approved: { label: "Profil publié", className: "bg-success-soft text-success" },
  rejected: { label: "Profil refusé", className: "bg-danger-soft text-danger" },
  disabled: { label: "Profil désactivé", className: "bg-sunken text-muted" },
};

export default function MyProfile() {
  const { data: profile } = useMyProfile();
  const status = profile ? statusLabels[profile.moderation_status] : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Mon profil</h1>
        {status && (
          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        )}
        {!profile && (
          <p className="mt-2 text-sm text-muted">
            Complétez votre profil pour commencer — il sera vérifié par notre équipe avant d&apos;être visible par
            les autres membres.
          </p>
        )}
      </div>
      {profile && <PhotoManager profileId={profile.id} />}
      <ProfileForm />
    </div>
  );
}
