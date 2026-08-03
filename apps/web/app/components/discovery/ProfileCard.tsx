import { Link, useSearchParams } from "react-router";
import { MapPin } from "lucide-react";
import { relationshipGoalLabels } from "@rencontre/shared";
import { photoUrl } from "~/lib/queries/usePhotos";
import { StarMark } from "~/components/ui/star";

export function ProfileCard({
  id,
  nickname,
  age,
  cityName,
  relationshipGoal,
  primaryPhotoKey,
}: {
  id: string;
  nickname: string;
  age: number;
  cityName: string | undefined;
  relationshipGoal: string | null;
  primaryPhotoKey: string | null;
}) {
  // Preserve the current filters when opening a preview — the old link built
  // `/discover?preview=x` from scratch and dropped every other search param.
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.set("preview", id);

  return (
    <Link
      to={`/discover?${next}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-raised transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-primary-soft">
        {primaryPhotoKey ? (
          <img
            src={photoUrl(primaryPhotoKey)}
            alt={`Photo de ${nickname}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          // Replaces a `?` glyph that sat at ~1.5:1 contrast and read as broken.
          <span className="flex h-full w-full items-center justify-center">
            <StarMark className="h-12 w-12 text-accent/25" />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="font-serif text-base leading-tight text-ink">
          {nickname}
          <span className="tabular text-muted">, {age}</span>
        </p>
        {cityName && (
          <p className="flex items-center gap-1 text-xs text-muted">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{cityName}</span>
          </p>
        )}
        {relationshipGoal && (
          <span className="mt-auto inline-flex w-fit rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink">
            {relationshipGoalLabels[relationshipGoal] ?? relationshipGoal}
          </span>
        )}
      </div>
    </Link>
  );
}
