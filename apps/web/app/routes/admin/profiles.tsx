import { useEffect, useState } from "react";
import { Eye, Search, ChevronLeft, ChevronRight, Ban, RotateCcw } from "lucide-react";
import {
  useAdminProfilesSearch,
  useModerateProfile,
  PROFILES_PAGE_SIZE,
  type AdminProfileSearchRow,
} from "~/lib/queries/useAdmin";
import { photoUrl } from "~/lib/queries/usePhotos";
import { AdminProfileDetailSheet } from "~/components/admin/AdminProfileDetailSheet";
import { Avatar, Badge, Chip, Skeleton, EmptyState } from "~/components/ui/primitives";
import { Input, Select } from "~/components/ui/form";
import { IconButton } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/sheet";

const statusFilters = [
  { value: "pending", label: "En attente" },
  { value: "approved", label: "Approuvés" },
  { value: "rejected", label: "Rejetés" },
  { value: "disabled", label: "Désactivés" },
  { value: "all", label: "Tous" },
] as const;

const statusTone: Record<string, "warning" | "success" | "danger" | "neutral"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  disabled: "neutral",
};

// Free-launch mode means this is "none" for nearly everyone today — the
// filter and column exist now so they're not a scramble to add the day
// subscriptions actually turn on.
const subscriptionStatusFilters = [
  { value: "all", label: "Tous les abonnements" },
  { value: "none", label: "Aucun abonnement" },
  { value: "trialing", label: "Période d'essai" },
  { value: "active", label: "Actif" },
  { value: "past_due", label: "Paiement en retard" },
  { value: "canceled", label: "Annulé" },
  { value: "incomplete", label: "Incomplet" },
  { value: "incomplete_expired", label: "Incomplet expiré" },
  { value: "unpaid", label: "Impayé" },
] as const;

const subscriptionStatusLabels: Record<string, string> = Object.fromEntries(
  subscriptionStatusFilters.map((f) => [f.value, f.label])
);

const subscriptionTone: Record<string, "warning" | "success" | "danger" | "neutral"> = {
  trialing: "warning",
  active: "success",
  past_due: "danger",
  canceled: "neutral",
  incomplete: "neutral",
  incomplete_expired: "neutral",
  unpaid: "danger",
};

export default function AdminProfiles() {
  const [status, setStatus] = useState<(typeof statusFilters)[number]["value"]>("pending");
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<(typeof subscriptionStatusFilters)[number]["value"]>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [disableTarget, setDisableTarget] = useState<AdminProfileSearchRow | null>(null);

  // Debounced rather than searching on every keystroke — this goes through
  // a security-definer RPC (email search can't go through a plain client
  // select, auth.users isn't reachable that way), so it's a real round trip
  // each time, not a free client-side filter.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [status, subscriptionStatus, search]);

  const { data, isLoading } = useAdminProfilesSearch(status, subscriptionStatus, search, page);
  const profiles = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PROFILES_PAGE_SIZE));
  const moderate = useModerateProfile();

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink">Profils</h1>
      <p className="mt-1 text-sm text-muted">
        Cliquez sur un profil pour voir ses photos et l&apos;ensemble de ses informations avant de décider.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {statusFilters.map((f) => (
          <Chip key={f.value} selected={status === f.value} onClick={() => setStatus(f.value)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Pseudo ou email..."
            className="pl-9"
            aria-label="Rechercher par pseudo ou email"
          />
        </div>
        <Select
          value={subscriptionStatus}
          onChange={(e) => setSubscriptionStatus(e.target.value as typeof subscriptionStatus)}
          aria-label="Filtrer par statut d'abonnement"
          className="sm:w-56"
        >
          {subscriptionStatusFilters.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line">
        {isLoading && (
          <div className="flex flex-col divide-y divide-line">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && profiles.length === 0 && (
          <EmptyState
            title="Aucun profil"
            description={search ? "Aucun résultat pour cette recherche." : "Rien à afficher pour ce filtre."}
          />
        )}
        {!isLoading && profiles.length > 0 && (
          <ul className="flex flex-col divide-y divide-line">
            {profiles.map((profile) => (
              <ProfileListRow
                key={profile.id}
                profile={profile}
                onOpen={() => setSelectedId(profile.id)}
                onDisable={() => setDisableTarget(profile)}
                onReactivate={() => moderate.mutate({ id: profile.id, status: "approved" })}
                reactivatePending={moderate.isPending}
              />
            ))}
          </ul>
        )}
      </div>

      {!isLoading && total > PROFILES_PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            {page * PROFILES_PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PROFILES_PAGE_SIZE)} sur {total}
          </span>
          <div className="flex items-center gap-2">
            <IconButton
              label="Page précédente"
              size="sm"
              variant="secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <span className="tabular">
              Page {page + 1} / {totalPages}
            </span>
            <IconButton
              label="Page suivante"
              size="sm"
              variant="secondary"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      )}

      <AdminProfileDetailSheet profileId={selectedId} onOpenChange={(open) => !open && setSelectedId(null)} />

      <ConfirmDialog
        open={disableTarget !== null}
        onOpenChange={(open) => !open && setDisableTarget(null)}
        title="Désactiver ce compte ?"
        description={
          disableTarget
            ? `${disableTarget.nickname} ne sera plus visible par les autres membres tant que le profil reste désactivé.`
            : ""
        }
        confirmLabel="Désactiver"
        destructive
        loading={moderate.isPending}
        onConfirm={() => {
          if (!disableTarget) return;
          moderate.mutate(
            { id: disableTarget.id, status: "disabled" },
            { onSuccess: () => setDisableTarget(null) }
          );
        }}
      />
    </div>
  );
}

function ProfileListRow({
  profile,
  onOpen,
  onDisable,
  onReactivate,
  reactivatePending,
}: {
  profile: AdminProfileSearchRow;
  onOpen: () => void;
  onDisable: () => void;
  onReactivate: () => void;
  reactivatePending: boolean;
}) {
  const age = Math.floor(
    (Date.now() - new Date(profile.birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar
          src={profile.primary_photo_key ? photoUrl(profile.primary_photo_key) : null}
          name={profile.nickname}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {profile.nickname}, {age} ans
          </p>
          <p className="truncate text-xs text-muted">{profile.email}</p>
        </div>
      </button>
      <Badge tone={statusTone[profile.moderation_status]} className="hidden shrink-0 sm:inline-flex">
        {profile.moderation_status}
      </Badge>
      <Badge tone={subscriptionTone[profile.subscription_status ?? "none"] ?? "neutral"} className="shrink-0">
        {subscriptionStatusLabels[profile.subscription_status ?? "none"] ?? profile.subscription_status}
      </Badge>
      {profile.moderation_status === "approved" && (
        <IconButton label="Désactiver le compte" size="sm" variant="ghost" onClick={onDisable}>
          <Ban className="h-4 w-4 text-danger" />
        </IconButton>
      )}
      {profile.moderation_status === "disabled" && (
        <IconButton
          label="Réactiver le compte"
          size="sm"
          variant="ghost"
          disabled={reactivatePending}
          onClick={onReactivate}
        >
          <RotateCcw className="h-4 w-4 text-success" />
        </IconButton>
      )}
      <IconButton label="Voir le profil" size="sm" variant="ghost" onClick={onOpen}>
        <Eye className="h-4 w-4" />
      </IconButton>
    </li>
  );
}
