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
  pending: "bg-warning-soft text-warning",
  approved: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-danger",
  disabled: "bg-sunken text-muted",
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
                ? "bg-primary text-on-primary"
                : "bg-sunken text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading && <p className="text-sm text-muted">Chargement…</p>}
        {profiles?.length === 0 && <p className="text-sm text-muted">Aucun profil.</p>}
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
    <div className="rounded-2xl border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {profile.nickname}, {age} ans
          </p>
          <p className="text-xs text-muted">
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
            className="rounded-xl border border-line bg-raised px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => moderate.mutate({ id: profile.id, status: "approved" })}
              disabled={moderate.isPending}
              className="rounded-xl bg-success px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Approuver
            </button>
            <button
              onClick={() => moderate.mutate({ id: profile.id, status: "rejected", notes })}
              disabled={moderate.isPending}
              className="rounded-xl bg-danger px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
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
          className="mt-3 rounded-xl bg-ink px-3 py-1.5 text-sm font-medium text-surface disabled:opacity-60"
        >
          Désactiver
        </button>
      )}

      {moderate.isError && <p className="mt-2 text-sm text-danger">{(moderate.error as Error).message}</p>}
    </div>
  );
}
