import { useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { DiscoveryFilters } from "~/components/discovery/DiscoveryFilters";
import { ProfileCard } from "~/components/discovery/ProfileCard";
import { ProfileDetailPanel } from "~/components/profile/ProfileDetailPanel";
import { useDiscoverProfiles, type DiscoverFilters } from "~/lib/queries/useDiscoverProfiles";
import { Button } from "~/components/ui/button";
import { Card, EmptyState, Skeleton } from "~/components/ui/primitives";

// Filters now live in the URL rather than component state, so a filtered view
// can be refreshed, bookmarked and shared — previously only `preview` was in
// the URL and every filter was lost on reload.
const FILTER_KEYS = [
  "gender",
  "communeInseeCode",
  "departmentCode",
  "regionCode",
  "relationshipGoal",
  "originCountryCode",
  "minAge",
  "maxAge",
] as const;

function parseFilters(params: URLSearchParams): DiscoverFilters {
  const get = (k: string) => params.get(k) || undefined;
  const num = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
  return {
    gender: get("gender") as DiscoverFilters["gender"],
    communeInseeCode: get("communeInseeCode"),
    departmentCode: get("departmentCode"),
    regionCode: get("regionCode"),
    relationshipGoal: get("relationshipGoal"),
    originCountryCode: get("originCountryCode"),
    minAge: num("minAge"),
    maxAge: num("maxAge"),
  };
}

export default function Discover() {
  const [searchParams, setSearchParams] = useSearchParams();
  const previewId = searchParams.get("preview");

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const setFilters = useCallback(
    (next: DiscoverFilters) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          for (const key of FILTER_KEYS) {
            const value = next[key];
            if (value === undefined || value === "") params.delete(key);
            else params.set(key, String(value));
          }
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const clearPreview = useCallback(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete("preview");
      return params;
    });
  }, [setSearchParams]);

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDiscoverProfiles(filters);

  const profiles = data?.pages.flat() ?? [];
  const notApproved = isError && (error as Error).message === "PROFILE_NOT_APPROVED";

  return (
    <>
      {/* Mobile drill-in. On desktop the workspace's right column shows the
          same profile from the same ?preview= param, so this never paints.
          Breakpoint must match the panel's in MessagingWorkspaceLayout. */}
      {previewId && (
        <div className="xl:hidden">
          <ProfileDetailPanel profileId={previewId} onClose={clearPreview} onBlocked={clearPreview} />
        </div>
      )}

      <div className={`flex flex-col gap-5 ${previewId ? "hidden xl:flex" : ""}`}>
        <div>
          <h1 className="font-serif text-2xl text-ink">Découvrir</h1>
          <p className="mt-1 text-sm text-muted">
            Parcourez les profils vérifiés de la communauté.
          </p>
        </div>

        <DiscoveryFilters
          filters={filters}
          onChange={setFilters}
          resultCount={isLoading ? undefined : profiles.length}
        />

        {notApproved && (
          <Card className="border-warning/40 bg-warning-soft p-4">
            <p className="text-sm text-warning">
              Votre profil doit être vérifié avant de découvrir d&apos;autres membres.{" "}
              <Link to="/profile/me" className="font-medium underline">
                Compléter mon profil
              </Link>
            </p>
          </Card>
        )}

        {isError && !notApproved && (
          <Card className="border-danger/40 bg-danger-soft p-4">
            <p className="text-sm text-danger">
              Impossible de charger les profils pour le moment. Réessayez dans un instant.
            </p>
          </Card>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-line bg-raised">
                <Skeleton className="aspect-[4/5] w-full rounded-none" />
                <div className="flex flex-col gap-2 p-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !isError && profiles.length === 0 && (
          <Card>
            <EmptyState
              title="Aucun profil ne correspond"
              description="Essayez d'élargir vos critères — une région plus large ou une tranche d'âge plus souple."
              action={
                <Button variant="secondary" onClick={() => setFilters({})}>
                  Réinitialiser les filtres
                </Button>
              }
            />
          </Card>
        )}

        {profiles.length > 0 && (
          // Breakpoints account for the two workspace sidebars (320px + 416px
          // + gaps) that mount at lg — the old md:grid-cols-4 collapsed cards
          // to ~56px wide between 1024px and 1279px.
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
        )}

        {hasNextPage && (
          <Button
            variant="secondary"
            className="self-center"
            onClick={() => fetchNextPage()}
            loading={isFetchingNextPage}
          >
            Voir plus de profils
          </Button>
        )}
      </div>
    </>
  );
}
