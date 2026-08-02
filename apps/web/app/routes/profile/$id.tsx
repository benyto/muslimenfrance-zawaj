import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
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
} from "@rencontre/shared";
import { useProfileDetail } from "~/lib/queries/useProfileDetail";
import { useBlockProfile } from "~/lib/queries/useBlockActions";
import { photoUrl } from "~/lib/queries/usePhotos";
import { ReportForm } from "~/components/discovery/ReportForm";

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export default function ProfileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: profile, isLoading, isError, error } = useProfileDetail(id);
  const blockProfile = useBlockProfile();
  const [showReport, setShowReport] = useState(false);

  if (isLoading) return null;

  if (isError || !profile) {
    const notFound = (error as Error)?.message === "PROFILE_NOT_FOUND";
    return (
      <p className="text-sm text-neutral-500">
        {notFound ? "Ce profil n'existe pas ou n'est plus disponible." : (error as Error)?.message}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {profile.photo_keys && profile.photo_keys.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {profile.photo_keys.map((key) => (
            <img key={key} src={photoUrl(key)} alt="" className="aspect-square w-full rounded-xl object-cover" />
          ))}
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-xl bg-neutral-100 text-neutral-300 dark:bg-neutral-800 dark:text-neutral-700">
          Aucune photo
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold">
          {profile.nickname}, {profile.age}
        </h1>
        {profile.relationship_goal && (
          <span className="mt-1 inline-block rounded-full bg-brand-rose-50 px-2 py-0.5 text-xs text-brand-rose-600 dark:bg-neutral-800 dark:text-brand-rose-400">
            {relationshipGoalLabels[profile.relationship_goal] ?? profile.relationship_goal}
          </span>
        )}
      </div>

      {profile.interests && profile.interests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profile.interests.map((interest) => (
            <span key={interest} className="rounded-full bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-800">
              {interest}
            </span>
          ))}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <DetailRow label="Taille" value={profile.height ? `${profile.height} cm` : null} />
        <DetailRow label="Poids" value={profile.weight ? `${profile.weight} kg` : null} />
        <DetailRow label="Couleur des yeux" value={profile.eye_color ? eyeColorLabels[profile.eye_color] : null} />
        <DetailRow label="Couleur des cheveux" value={profile.hair_color ? hairColorLabels[profile.hair_color] : null} />
        <DetailRow label="Type de corps" value={profile.body_type ? bodyTypeLabels[profile.body_type] : null} />
        <DetailRow label="Niveau d'éducation" value={profile.education_level ? educationLevelLabels[profile.education_level] : null} />
        <DetailRow label="Profession" value={profile.occupation} />
        <DetailRow label="Statut professionnel" value={profile.employment_status ? employmentStatusLabels[profile.employment_status] : null} />
        <DetailRow label="Ethnie" value={profile.ethnicity} />
        <DetailRow label="Religion" value={profile.religion ? religionLabels[profile.religion] : null} />
        <DetailRow label="Niveau de pratique" value={profile.religiosity_level ? religiosityLevelLabels[profile.religiosity_level] : null} />
        <DetailRow label="Langues parlées" value={profile.languages_spoken?.join(", ")} />
        <DetailRow label="Fumeur" value={profile.smoker ? smokerLabels[profile.smoker] : null} />
        <DetailRow label="Consommation d'alcool" value={profile.drinker ? drinkerLabels[profile.drinker] : null} />
        <DetailRow label="A des enfants" value={profile.has_children === null ? null : profile.has_children ? "Oui" : "Non"} />
        <DetailRow label="Souhaite des enfants" value={profile.wants_children ? wantsChildrenLabels[profile.wants_children] : null} />
      </dl>

      <div className="flex flex-wrap gap-3">
        <Link
          to={`/messages/${profile.id}`}
          className="rounded-xl bg-gradient-to-r from-brand-rose-500 to-brand-purple-500 px-4 py-2 text-sm font-medium text-white"
        >
          Envoyer un message
        </Link>
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Bloquer ${profile.nickname} ? Vous ne verrez plus son profil.`)) return;
            blockProfile.mutate(profile.id, { onSuccess: () => navigate("/discover") });
          }}
          disabled={blockProfile.isPending}
          className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-800 dark:hover:bg-neutral-800"
        >
          Bloquer
        </button>
        <button
          type="button"
          onClick={() => setShowReport((v) => !v)}
          className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
        >
          Signaler
        </button>
      </div>

      {showReport && <ReportForm profileId={profile.id} onDone={() => setShowReport(false)} />}
    </div>
  );
}
