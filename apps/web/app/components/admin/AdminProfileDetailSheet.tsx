import { useState } from "react";
import {
  eyeColorLabels,
  hairColorLabels,
  bodyTypeLabels,
  educationLevelLabels,
  employmentStatusLabels,
  religionLabels,
  religiosityLevelLabels,
  relationshipGoalLabels,
  smokerLabels,
  drinkerLabels,
  wantsChildrenLabels,
  worldCountryNameByCode,
} from "@rencontre/shared";
import {
  useAdminProfile,
  useAdminProfilePhotos,
  useModerateProfile,
  useModeratePhoto,
  useReviewProfileTexts,
} from "~/lib/queries/useAdmin";
import { PhotoImg, usePhotoUrls } from "~/lib/photo-urls";
import { Sheet, ConfirmDialog } from "~/components/ui/sheet";
import { PhotoLightbox } from "~/components/ui/lightbox";
import { Badge, Skeleton } from "~/components/ui/primitives";
import { Button } from "~/components/ui/button";
import { Field, Textarea } from "~/components/ui/form";
import { cn } from "~/lib/cn";

// The text a member wants to put live, next to the text that is live now.
function PendingText({ label, current, proposed }: { label: string; current: string | null; proposed: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <div className="rounded-lg bg-raised p-3">
        <p className="text-xs text-muted">Actuel</p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted">{current || "— vide —"}</p>
      </div>
      <div className="rounded-lg bg-raised p-3 ring-1 ring-warning/50">
        <p className="text-xs text-muted">Proposé</p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink">{proposed}</p>
      </div>
    </div>
  );
}

const statusTone: Record<string, "warning" | "success" | "danger" | "neutral"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  disabled: "neutral",
};

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

// The one thing the old profiles list couldn't do: actually see the
// profile — photos included — before deciding to approve or reject it.
// Reused from /admin/profiles (row click) and /admin/reports (a report
// whose content_type is "profile" links straight here instead of leaving
// the moderator to go find it themselves).
export function AdminProfileDetailSheet({
  profileId,
  onOpenChange,
}: {
  profileId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: profile, isLoading } = useAdminProfile(profileId ?? undefined);
  const { data: photos } = useAdminProfilePhotos(profileId ?? undefined);
  const moderateProfile = useModerateProfile();
  const moderatePhoto = useModeratePhoto();
  const reviewTexts = useReviewProfileTexts();
  const [notes, setNotes] = useState("");
  const [textNotes, setTextNotes] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  const age = profile
    ? Math.floor((Date.now() - new Date(profile.birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  // Admins can sign every photo (can_read_photo_object), pending and private
  // ones included. Full size only once the lightbox is open.
  const photoKeys = photos?.map((p) => p.storage_key) ?? [];
  const thumbUrls = usePhotoUrls(photoKeys, "thumb");
  const displayUrls = usePhotoUrls(photoKeys, "display", lightboxIndex !== null);
  const photoUrls = photoKeys.map((_, i) => displayUrls[i] ?? thumbUrls[i] ?? "");

  return (
    <>
      <Sheet
        open={profileId !== null}
        onOpenChange={onOpenChange}
        title={profile ? `${profile.nickname}, ${age} ans` : "Profil"}
        description={profile ? (profile.gender === "male" ? "Homme" : "Femme") : undefined}
      >
        {isLoading || !profile ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">Photos</span>
                <Badge tone={statusTone[profile.moderation_status]}>{profile.moderation_status}</Badge>
              </div>
              {photos && photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo, i) => (
                    <div key={photo.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(i)}
                        className="aspect-square w-full overflow-hidden rounded-lg"
                      >
                        <PhotoImg
                          photoKey={photo.storage_key}
                          variant="thumb"
                          alt={`Photo ${i + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                      <span
                        className={cn(
                          "absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          photo.moderation_status === "approved" && "bg-success-soft text-success",
                          photo.moderation_status === "pending" && "bg-warning-soft text-warning",
                          photo.moderation_status === "rejected" && "bg-danger-soft text-danger"
                        )}
                      >
                        {photo.moderation_status}
                      </span>
                      {photo.moderation_status === "pending" && (
                        <div className="absolute right-1 top-1 flex gap-1">
                          <button
                            type="button"
                            onClick={() => moderatePhoto.mutate({ id: photo.id, status: "approved" })}
                            disabled={moderatePhoto.isPending}
                            aria-label="Approuver la photo"
                            className="rounded-full bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white disabled:opacity-60"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => moderatePhoto.mutate({ id: photo.id, status: "rejected" })}
                            disabled={moderatePhoto.isPending}
                            aria-label="Rejeter la photo"
                            className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white disabled:opacity-60"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Aucune photo.</p>
              )}
            </div>

            {(profile.bio_pending != null || profile.looking_for_pending != null) && (
              <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Modification du texte à valider</h3>
                  <p className="mt-0.5 text-xs text-muted">
                    Le profil reste en ligne avec le texte actuel tant que vous n&apos;avez pas décidé.
                  </p>
                </div>
                {profile.bio_pending != null && (
                  <PendingText label="À propos" current={profile.bio} proposed={profile.bio_pending} />
                )}
                {profile.looking_for_pending != null && (
                  <PendingText label="Recherche" current={profile.looking_for} proposed={profile.looking_for_pending} />
                )}
                <Field label="Motif (si rejet)">
                  {(props) => (
                    <Textarea {...props} value={textNotes} onChange={(e) => setTextNotes(e.target.value)} rows={2} />
                  )}
                </Field>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    className="flex-1"
                    loading={reviewTexts.isPending}
                    onClick={() =>
                      reviewTexts.mutate(
                        { id: profile.id, decision: "approved", version: profile.text_review_version },
                        { onSuccess: () => setTextNotes("") }
                      )
                    }
                  >
                    Approuver
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    disabled={reviewTexts.isPending}
                    onClick={() =>
                      reviewTexts.mutate(
                        {
                          id: profile.id,
                          decision: "rejected",
                          version: profile.text_review_version,
                          notes: textNotes || undefined,
                        },
                        { onSuccess: () => setTextNotes("") }
                      )
                    }
                  >
                    Rejeter
                  </Button>
                </div>
                {reviewTexts.isError && (
                  <p className="text-sm text-danger">{(reviewTexts.error as Error).message}</p>
                )}
              </div>
            )}

            {profile.bio && (
              <div>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">À propos</h3>
                <p className="whitespace-pre-wrap break-words text-sm text-ink">{profile.bio}</p>
              </div>
            )}
            {profile.looking_for && (
              <div>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Recherche</h3>
                <p className="whitespace-pre-wrap break-words text-sm text-ink">{profile.looking_for}</p>
              </div>
            )}

            <dl className="grid grid-cols-2 gap-4 rounded-xl border border-line p-4">
              <DetailRow label="Créé le" value={new Date(profile.created_at).toLocaleDateString("fr-FR")} />
              <DetailRow label="Taille" value={profile.height ? `${profile.height} cm` : null} />
              <DetailRow label="Poids" value={profile.weight ? `${profile.weight} kg` : null} />
              <DetailRow label="Couleur des yeux" value={profile.eye_color ? eyeColorLabels[profile.eye_color] : null} />
              <DetailRow label="Couleur des cheveux" value={profile.hair_color ? hairColorLabels[profile.hair_color] : null} />
              <DetailRow label="Type de corps" value={profile.body_type ? bodyTypeLabels[profile.body_type] : null} />
              <DetailRow label="Niveau d'éducation" value={profile.education_level ? educationLevelLabels[profile.education_level] : null} />
              <DetailRow label="Profession" value={profile.occupation} />
              <DetailRow label="Statut professionnel" value={profile.employment_status ? employmentStatusLabels[profile.employment_status] : null} />
              <DetailRow
                label="Pays d'origine"
                value={profile.origin_country_code ? worldCountryNameByCode[profile.origin_country_code] : null}
              />
              <DetailRow label="Ethnie" value={profile.ethnicity} />
              <DetailRow label="Religion" value={profile.religion ? religionLabels[profile.religion] : null} />
              <DetailRow label="Niveau de pratique" value={profile.religiosity_level ? religiosityLevelLabels[profile.religiosity_level] : null} />
              <DetailRow label="Langues parlées" value={profile.languages_spoken?.join(", ")} />
              <DetailRow label="Objectif relationnel" value={profile.relationship_goal ? relationshipGoalLabels[profile.relationship_goal] : null} />
              <DetailRow label="Fumeur" value={profile.smoker ? smokerLabels[profile.smoker] : null} />
              <DetailRow label="Consommation d'alcool" value={profile.drinker ? drinkerLabels[profile.drinker] : null} />
              <DetailRow label="Souhaite des enfants" value={profile.wants_children ? wantsChildrenLabels[profile.wants_children] : null} />
              <DetailRow label="Centres d'intérêt" value={profile.interests?.join(", ")} />
            </dl>

            {profile.moderation_notes && (
              <div className="rounded-xl bg-sunken p-3">
                <p className="text-xs font-medium text-muted">Notes de modération précédentes</p>
                <p className="mt-1 text-sm text-ink">{profile.moderation_notes}</p>
              </div>
            )}

            {profile.moderation_status === "pending" && (
              <div className="flex flex-col gap-3">
                <Field label="Motif (si rejet)">
                  {(props) => (
                    <Textarea {...props} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                  )}
                </Field>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    className="flex-1"
                    loading={moderateProfile.isPending}
                    onClick={() => moderateProfile.mutate({ id: profile.id, status: "approved" })}
                  >
                    Approuver
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    disabled={moderateProfile.isPending}
                    onClick={() => setShowRejectConfirm(true)}
                  >
                    Rejeter
                  </Button>
                </div>
              </div>
            )}

            {profile.moderation_status === "approved" && (
              <Button variant="secondary" disabled={moderateProfile.isPending} onClick={() => setShowDisableConfirm(true)}>
                Désactiver ce profil
              </Button>
            )}

            {moderateProfile.isError && (
              <p className="text-sm text-danger">{(moderateProfile.error as Error).message}</p>
            )}
          </div>
        )}
      </Sheet>

      {profile && (
        <PhotoLightbox
          photos={photoUrls}
          index={lightboxIndex ?? 0}
          onIndexChange={setLightboxIndex}
          open={lightboxIndex !== null}
          onOpenChange={(open) => !open && setLightboxIndex(null)}
        />
      )}

      {profile && (
        <ConfirmDialog
          open={showRejectConfirm}
          onOpenChange={setShowRejectConfirm}
          title="Rejeter ce profil ?"
          description={
            notes
              ? `Motif communiqué : « ${notes} »`
              : "Aucun motif renseigné — le profil sera rejeté sans explication transmise."
          }
          confirmLabel="Rejeter"
          destructive
          loading={moderateProfile.isPending}
          onConfirm={() => {
            moderateProfile.mutate(
              { id: profile.id, status: "rejected", notes },
              { onSuccess: () => setShowRejectConfirm(false) }
            );
          }}
        />
      )}

      {profile && (
        <ConfirmDialog
          open={showDisableConfirm}
          onOpenChange={setShowDisableConfirm}
          title="Désactiver ce profil ?"
          description={`${profile.nickname} ne sera plus visible par les autres membres tant que le profil reste désactivé.`}
          confirmLabel="Désactiver"
          destructive
          loading={moderateProfile.isPending}
          onConfirm={() => {
            moderateProfile.mutate(
              { id: profile.id, status: "disabled" },
              { onSuccess: () => setShowDisableConfirm(false) }
            );
          }}
        />
      )}
    </>
  );
}
