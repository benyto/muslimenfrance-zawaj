import { useState } from "react";
import { Link } from "react-router";
import { Heart } from "lucide-react";
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
import { useProfileDetail } from "~/lib/queries/useProfileDetail";
import { useMyProfile } from "~/lib/queries/useMyProfile";
import { useIgnoreProfile, useIsIgnored, useUnignoreProfile } from "~/lib/queries/useIgnoreActions";
import { useAddFavorite, useIsFavorited, useRemoveFavorite } from "~/lib/queries/useFavorites";
import { usePresenceStatus } from "~/lib/realtime/usePresence";
import { photoUrl } from "~/lib/queries/usePhotos";
import { ReportForm } from "~/components/discovery/ReportForm";
import { cn } from "~/lib/cn";
import { PhotoLightbox } from "~/components/ui/lightbox";

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

// Shared between the standalone /profile/:id route (mobile / direct
// navigation), the mobile /discover drill-in — both plain document flow,
// variant="flow" — and the desktop workspace's persistent right column,
// variant="panel". The two need genuinely different layouts, not just
// different classes: "flow" scrolls with the page and pins its actions bar
// with position:sticky; "panel" lives inside a height-bounded card and
// splits into a scrolling content region plus a footer that's a true
// sibling outside that scroll region, never overlapping it. An earlier
// version tried to make one sticky-in-flow footer work for both by nesting
// it inside the panel's own max-height + overflow-y-auto box — sticky's
// offset there is relative to that box's *padding* edge, and profile
// content scrolling past could still show through at the seam. Splitting
// scroll region from footer at the layout level removes the ambiguity
// entirely rather than chasing it with z-index and shadows.
export function ProfileDetailPanel({
  profileId,
  onClose,
  variant = "flow",
  hideActions = false,
}: {
  profileId: string;
  onClose?: () => void;
  variant?: "flow" | "panel";
  // For contexts that already supply their own chrome around the content —
  // e.g. the own-profile preview Sheet, opened from the edit form itself,
  // where Contacter/Ignorer/Signaler/"Modifier mon profil" are all either
  // impossible (you can't message or ignore yourself) or redundant (you're
  // already on the edit form).
  hideActions?: boolean;
}) {
  const { data: profile, isLoading, isError, error } = useProfileDetail(profileId);
  const { data: myProfile } = useMyProfile();
  const isOwnProfile = !!myProfile && myProfile.id === profileId;
  const presence = usePresenceStatus(profile?.last_seen_at);
  const isIgnored = useIsIgnored(profileId);
  const ignoreProfile = useIgnoreProfile();
  const unignoreProfile = useUnignoreProfile();
  const isFavorited = useIsFavorited(profileId);
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();
  const [showReport, setShowReport] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (isLoading) return null;

  if (isError || !profile) {
    const notFound = (error as Error)?.message === "PROFILE_NOT_FOUND";
    return (
      <p className={cn("text-sm text-muted", variant === "panel" && "p-6")}>
        {notFound ? "Ce profil n'existe pas ou n'est plus disponible." : (error as Error)?.message}
      </p>
    );
  }

  const content = (
    <div className="flex flex-col gap-6">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-xl pr-3 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          ← Retour
        </button>
      )}

      {isOwnProfile && (
        <div className="rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-primary">
          Aperçu : voici comment votre profil apparaît aux autres membres.
        </div>
      )}

      {profile.photo_keys && profile.photo_keys.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {profile.photo_keys.map((key, i) => (
            <button
              key={key}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="aspect-square overflow-hidden rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <img
                src={photoUrl(key)}
                alt={`Photo ${i + 1} de ${profile.nickname}`}
                className="h-full w-full object-cover transition-transform hover:scale-105"
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-xl bg-sunken text-muted">
          Aucune photo
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            {profile.nickname}, {profile.age}
            {presence === "online" && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-success"
                aria-label="En ligne"
                title="En ligne"
              />
            )}
          </h1>
          {presence && (
            <p className="text-xs text-muted">{presence === "online" ? "En ligne" : "Hors ligne"}</p>
          )}
          {profile.commune_nom && (
            <p className="mt-0.5 text-sm text-muted">
              {profile.commune_nom}
              {profile.department_name ? `, ${profile.department_name}` : ""}
            </p>
          )}
          {profile.relationship_goal && (
            <span className="mt-1 inline-block rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
              {relationshipGoalLabels[profile.relationship_goal] ?? profile.relationship_goal}
            </span>
          )}
        </div>
        {!isOwnProfile && (
          <button
            type="button"
            onClick={() =>
              isFavorited ? removeFavorite.mutate(profile.id) : addFavorite.mutate(profile.id)
            }
            disabled={addFavorite.isPending || removeFavorite.isPending}
            aria-pressed={isFavorited}
            aria-label={isFavorited ? "Retirer des favoris" : "Ajouter aux favoris"}
            className={cn(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-50",
              isFavorited
                ? "border-romantic/40 bg-romantic-soft text-romantic"
                : "border-line text-muted hover:border-romantic/40 hover:bg-romantic-soft hover:text-romantic"
            )}
          >
            <Heart className="h-5 w-5" fill={isFavorited ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        )}
      </div>

      {profile.bio && (
        <div>
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">À propos</h2>
          <p className="whitespace-pre-wrap break-words text-sm text-ink">{profile.bio}</p>
        </div>
      )}

      {profile.looking_for && (
        <div>
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Recherche</h2>
          <p className="whitespace-pre-wrap break-words text-sm text-ink">{profile.looking_for}</p>
        </div>
      )}

      {profile.interests && profile.interests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profile.interests.map((interest) => (
            <span key={interest} className="rounded-full bg-sunken px-3 py-1 text-sm">
              {interest}
            </span>
          ))}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-line bg-raised p-6">
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
        <DetailRow label="Fumeur" value={profile.smoker ? smokerLabels[profile.smoker] : null} />
        <DetailRow label="Consommation d'alcool" value={profile.drinker ? drinkerLabels[profile.drinker] : null} />
        <DetailRow label="A des enfants" value={profile.has_children === null ? null : profile.has_children ? "Oui" : "Non"} />
        <DetailRow label="Souhaite des enfants" value={profile.wants_children ? wantsChildrenLabels[profile.wants_children] : null} />
      </dl>

      {showReport && <ReportForm profileId={profile.id} onDone={() => setShowReport(false)} />}
    </div>
  );

  const actionButtons = isOwnProfile ? (
    <Link
      to="/profile/me"
      className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary"
    >
      Modifier mon profil
    </Link>
  ) : (
    <>
      <Link
        to={`/messages/${profile.id}`}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary"
      >
        Contacter
      </Link>
      <button
        type="button"
        onClick={() =>
          isIgnored ? unignoreProfile.mutate(profile.id) : ignoreProfile.mutate(profile.id)
        }
        disabled={ignoreProfile.isPending || unignoreProfile.isPending}
        aria-pressed={isIgnored}
        className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-sunken disabled:opacity-60 dark:hover:bg-sunken"
      >
        {isIgnored ? "Ne plus ignorer" : "Ignorer"}
      </button>
      <button
        type="button"
        onClick={() => setShowReport((v) => !v)}
        className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-sunken dark:hover:bg-sunken"
      >
        Signaler
      </button>
    </>
  );

  const photoLightbox = profile.photo_keys && profile.photo_keys.length > 0 && (
    <PhotoLightbox
      photos={profile.photo_keys.map((key) => photoUrl(key))}
      index={lightboxIndex ?? 0}
      onIndexChange={setLightboxIndex}
      open={lightboxIndex !== null}
      onOpenChange={(open) => !open && setLightboxIndex(null)}
    />
  );

  if (variant === "panel") {
    // The footer sits outside the scrolling region entirely — a plain flex
    // sibling, not position:sticky — so there's no scrollport/padding edge
    // ambiguity left for content to bleed through at.
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{content}</div>
        {!hideActions && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line bg-raised px-6 py-4">
            {actionButtons}
          </div>
        )}
        {photoLightbox}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {content}
      {/* bottom-16 clears the mobile tab bar, which only renders below sm;
          at sm and up it's hidden so bottom-0 is correct. This variant has
          no wrapping scrollport with its own padding (the page itself
          scrolls), so sticky-in-flow is unambiguous here. */}
      {!hideActions && (
        <div className="sticky bottom-16 z-10 flex flex-wrap items-center gap-3 border-t border-line bg-raised py-4 shadow-[0_-8px_12px_-8px_rgb(0_0_0_/_0.12)] sm:bottom-0">
          {actionButtons}
        </div>
      )}
      {photoLightbox}
    </div>
  );
}
