import { Link } from "react-router";
import { Heart } from "lucide-react";
import { useFavorites, useRemoveFavorite, type Favorite } from "~/lib/queries/useFavorites";
import { usePresenceStatus } from "~/lib/realtime/usePresence";
import { photoUrl } from "~/lib/queries/usePhotos";
import { cn } from "~/lib/cn";
import { Avatar, EmptyState, Skeleton } from "~/components/ui/primitives";
import { ButtonLink } from "~/components/ui/button";

// Sibling to ConversationsList in the sidebar's Favoris tab — same row
// recipe (avatar/name/city, active-row accent bar) but without unread
// state, which doesn't apply to a bookmark list, plus a one-click remove.
export function FavoritesList({ activeProfileId }: { activeProfileId?: string }) {
  const { data: favorites, isLoading } = useFavorites();
  const removeFavorite = useRemoveFavorite();

  if (isLoading) {
    return (
      <ul className="flex flex-col">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3.5 w-1/3" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (!favorites || favorites.length === 0) {
    return (
      <EmptyState
        title="Aucun favori"
        description="Ajoutez des profils en favoris depuis leur fiche pour les retrouver ici rapidement."
        action={
          <ButtonLink to="/discover" variant="secondary" size="sm">
            Découvrir des profils
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-line px-4 py-3">
        <span className="text-sm text-muted">
          {favorites.length} {favorites.length === 1 ? "favori" : "favoris"}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {favorites.map((f) => (
          <FavoriteRow
            key={f.favorited_profile_id}
            favorite={f}
            isActive={f.favorited_profile_id === activeProfileId}
            onRemove={() => removeFavorite.mutate(f.favorited_profile_id)}
            removePending={removeFavorite.isPending}
          />
        ))}
      </ul>
    </div>
  );
}

// Own component so usePresenceStatus (a hook) gets one call site per row.
function FavoriteRow({
  favorite: f,
  isActive,
  onRemove,
  removePending,
}: {
  favorite: Favorite;
  isActive: boolean;
  onRemove: () => void;
  removePending: boolean;
}) {
  const presence = usePresenceStatus(f.last_seen_at);

  return (
    <li className="relative">
      {isActive && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" aria-hidden="true" />}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-4 transition-colors",
          isActive ? "bg-primary-soft" : "hover:bg-sunken"
        )}
      >
        <Link
          to={`/messages/${f.favorited_profile_id}`}
          aria-current={isActive ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <Avatar
            src={f.photo_key ? photoUrl(f.photo_key) : null}
            name={f.nickname ?? "?"}
            size="lg"
            presence={presence}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium text-ink">{f.nickname}</p>
            {f.commune_nom && <p className="truncate text-sm text-muted">{f.commune_nom}</p>}
          </div>
        </Link>
        <button
          type="button"
          onClick={onRemove}
          disabled={removePending}
          aria-label={`Retirer ${f.nickname} des favoris`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-romantic transition-colors hover:bg-romantic-soft disabled:opacity-50"
        >
          <Heart className="h-4 w-4" fill="currentColor" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
