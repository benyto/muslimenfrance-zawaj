import { useState } from "react";
import { useAdminProfiles, useModerateProfile, type AdminProfileRow } from "~/lib/queries/useAdmin";

const statusFilters = [
  { value: "pending", label: "En attente" },
  { value: "approved", label: "Approuvés" },
  { value: "rejected", label: "Rejetés" },
  { value: "disabled", label: "Désactivés" },
  { value: "all", label: "Tous" },
] as const;

const statusStyles: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-neutral-800 dark:text-amber-400",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-neutral-800 dark:text-emerald-400",
  rejected: "bg-red-50 text-red-700 dark:bg-neutral-800 dark:text-red-400",
  disabled: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

export default function AdminProfiles() {
  const [status, setStatus] = useState<(typeof statusFilters)[number]["value"]>("pending");
  const { data: profiles, isLoading } = useAdminProfiles(status);

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === f.value
                ? "bg-brand-rose-500 text-white"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading && <p className="text-sm text-neutral-500">Chargement…</p>}
        {profiles?.length === 0 && <p className="text-sm text-neutral-500">Aucun profil.</p>}
        {profiles?.map((profile) => <ProfileRow key={profile.id} profile={profile} />)}
      </div>
    </div>
  );
}

function ProfileRow({ profile }: { profile: AdminProfileRow }) {
  const [notes, setNotes] = useState("");
  const moderate = useModerateProfile();

  const age = Math.floor(
    (Date.now() - new Date(profile.birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );

  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {profile.nickname}, {age} ans
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {profile.gender === "male" ? "Homme" : "Femme"} · créé le{" "}
            {new Date(profile.created_at).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusStyles[profile.moderation_status]}`}>
          {profile.moderation_status}
        </span>
      </div>

      {profile.moderation_status === "pending" && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Motif (si rejet)"
            className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
          />
          <div className="flex gap-2">
            <button
              onClick={() => moderate.mutate({ id: profile.id, status: "approved" })}
              disabled={moderate.isPending}
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Approuver
            </button>
            <button
              onClick={() => moderate.mutate({ id: profile.id, status: "rejected", notes })}
              disabled={moderate.isPending}
              className="rounded-xl bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Rejeter
            </button>
          </div>
        </div>
      )}

      {profile.moderation_status === "approved" && (
        <button
          onClick={() => moderate.mutate({ id: profile.id, status: "disabled" })}
          disabled={moderate.isPending}
          className="mt-3 rounded-xl bg-neutral-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-700"
        >
          Désactiver
        </button>
      )}

      {moderate.isError && <p className="mt-2 text-sm text-red-600">{(moderate.error as Error).message}</p>}
    </div>
  );
}
