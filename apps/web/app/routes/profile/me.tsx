import { ProfileForm } from "~/components/profile/ProfileForm";
import { PhotoManager } from "~/components/profile/PhotoManager";
import { useMyProfile } from "~/lib/queries/useMyProfile";

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "En cours de vérification", className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  approved: { label: "Profil publié", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  rejected: { label: "Profil refusé", className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400" },
  disabled: { label: "Profil désactivé", className: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" },
};

export default function MyProfile() {
  const { data: profile } = useMyProfile();
  const status = profile ? statusLabels[profile.moderation_status] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Mon profil</h1>
        {status && (
          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        )}
        {!profile && (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
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
