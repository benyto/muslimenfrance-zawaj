import { useState } from "react";
import { DiscoveryFilters } from "~/components/discovery/DiscoveryFilters";
import { ProfileCard } from "~/components/discovery/ProfileCard";
import { useDiscoverProfiles, type DiscoverFilters } from "~/lib/queries/useDiscoverProfiles";

export default function Discover() {
  const [filters, setFilters] = useState<DiscoverFilters>({});

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDiscoverProfiles(filters);

  const profiles = data?.pages.flat() ?? [];
  const notApproved = isError && (error as Error).message === "PROFILE_NOT_APPROVED";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Découvrir</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Parcourez les profils vérifiés de la communauté.
        </p>
      </div>

      <DiscoveryFilters filters={filters} onChange={setFilters} />

      {notApproved && (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          Votre profil doit être vérifié avant de pouvoir découvrir d&apos;autres membres. Complétez-le depuis{" "}
          <a href="/profile/me" className="underline">
            votre page profil
          </a>
          .
        </p>
      )}

      {isError && !notApproved && (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      )}

      {isLoading && <p className="text-sm text-neutral-500">Chargement...</p>}

      {!isLoading && !isError && profiles.length === 0 && (
        <p className="text-sm text-neutral-500">Aucun profil ne correspond à ces critères pour le moment.</p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {profiles.map((p) => (
          <ProfileCard
            key={p.id}
            id={p.id}
            nickname={p.nickname}
            age={p.age}
            cityName={p.commune_nom ?? undefined}
            relationshipGoal={p.relationship_goal}
            primaryPhotoKey={p.primary_photo_key}
          />
        ))}
      </div>

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="self-center rounded-xl border border-neutral-200 px-6 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-800 dark:hover:bg-neutral-800"
        >
          {isFetchingNextPage ? "Chargement..." : "Voir plus"}
        </button>
      )}
    </div>
  );
}
