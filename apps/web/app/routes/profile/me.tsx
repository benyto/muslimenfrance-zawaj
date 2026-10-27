import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { CircleCheck, X } from "lucide-react";
import { ProfileForm } from "~/components/profile/ProfileForm";
import { PhotoManager } from "~/components/profile/PhotoManager";
import { PhotoAccessManager } from "~/components/profile/PhotoAccessManager";
import { ProfileDetailPanel } from "~/components/profile/ProfileDetailPanel";
import { useMyProfile } from "~/lib/queries/useMyProfile";
import { usePhotos } from "~/lib/queries/usePhotos";
import { computeProfileCompletion, PROFILE_COMPLETION_THRESHOLD } from "~/lib/profile-completion";
import { Card } from "~/components/ui/primitives";
import { Sheet } from "~/components/ui/sheet";

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
  const [showPreview, setShowPreview] = useState(false);

  // First save of a brand-new profile: the photo manager only exists once the
  // profile does, and it renders at the top — but the save button is at the
  // bottom of a very long form, so the page used to stay down there with the
  // new section out of sight. Bring them up to it, with a pointer to the
  // next step. Only on that first creation: later saves keep their scroll
  // position (a toast confirms them).
  const profileState = profile === undefined ? "loading" : profile ? "exists" : "none";
  const previousProfileState = useRef(profileState);
  const [justCreated, setJustCreated] = useState(false);
  useEffect(() => {
    if (previousProfileState.current === "none" && profileState === "exists") {
      setJustCreated(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    previousProfileState.current = profileState;
  }, [profileState]);
  const showPhotosPrompt = justCreated && photos?.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Mon profil</h1>
          {profile?.moderation_status === "approved" && (
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="text-sm font-medium text-primary hover:underline"
            >
              Voir mon profil →
            </button>
          )}
        </div>
        {status && (
          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        )}
        {profile && profile.moderation_status !== "approved" && (
          <Link to="/verification" className="mt-2 block text-sm font-medium text-primary hover:underline">
            Voir l&apos;état de ma vérification →
          </Link>
        )}
        {!profile && (
          <p className="mt-2 text-sm text-muted">
            Complétez votre profil pour commencer — il sera vérifié par notre équipe avant d&apos;être visible par
            les autres membres.
          </p>
        )}
      </div>
      {profile && showPhotosPrompt && (
        <Card className="flex items-start gap-3 border-success/40 bg-success-soft p-4">
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <div className="text-sm text-success">
            <p className="font-medium">Profil enregistré !</p>
            <p className="mt-0.5">
              Dernière étape : ajoutez vos photos ci-dessous. Notre équipe vérifiera ensuite votre profil et
              vous préviendra par email.
            </p>
          </div>
        </Card>
      )}
      {profile && isIncomplete && !bannerDismissed && !showPhotosPrompt && (
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
      {profile && <PhotoAccessManager />}
      <ProfileForm completion={completion} />

      {/* Same Sheet primitive as the discovery filters — a right-hand panel
          rather than a navigation away from the form, so in-progress edits
          are never at risk of being lost just to check how the profile
          reads to other members. */}
      {profile && (
        <Sheet open={showPreview} onOpenChange={setShowPreview} title="Aperçu de mon profil">
          {/* Mounted only while open, not just hidden — no reason to fire the
              get_profile_detail fetch on every visit to this page. */}
          {showPreview && <ProfileDetailPanel profileId={profile.id} hideActions />}
        </Sheet>
      )}
    </div>
  );
}
