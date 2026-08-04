import { useState } from "react";
import { X } from "lucide-react";
import { ProfileForm } from "~/components/profile/ProfileForm";
import { PhotoManager } from "~/components/profile/PhotoManager";
import { useMyProfile } from "~/lib/queries/useMyProfile";
import { usePhotos } from "~/lib/queries/usePhotos";
import { computeProfileCompletion, PROFILE_COMPLETION_THRESHOLD } from "~/lib/profile-completion";
import { Card } from "~/components/ui/primitives";

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "En cours de vérification", className: "bg-warning-soft text-warning" },
  approved: { label: "Profil publié", className: "bg-success-soft text-success" },
  rejected: { label: "Profil refusé", className: "bg-danger-soft text-danger" },
  disabled: { label: "Profil désactivé", className: "bg-sunken text-muted" },
};

export default function MyProfile() {
  const { data: profile } = useMyProfile();
  const { data: photos } = usePhotos(profile?.id);
  const status = profile ? statusLabels[profile.moderation_status] : null;
  const completion = computeProfileCompletion(profile, photos?.length ?? 0);
  const isIncomplete = completion < PROFILE_COMPLETION_THRESHOLD;

  // Dismiss is per-visit, not persisted — the point is to get it out of the
  // way while you're actively editing, not to hide it forever after one
  // click. It comes back next time the page loads if the profile is still
  // under the threshold.
  const [bannerDismissed, setBannerDismissed] = useState(false);

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
      {profile && isIncomplete && !bannerDismissed && (
        <Card className="relative border-warning/40 bg-warning-soft p-4 pr-12">
          <p className="text-sm text-warning">
            Un profil plus complet augmente vos chances d&apos;être remarqué·e par les membres qui vous recherchent.
            Ajoutez quelques informations de plus ci-dessous pour vous démarquer.
          </p>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Fermer"
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-warning hover:bg-warning/10"
          >
            <X className="h-4 w-4" />
          </button>
        </Card>
      )}
      {profile && <PhotoManager profileId={profile.id} />}
      <ProfileForm completion={completion} />
    </div>
  );
}
