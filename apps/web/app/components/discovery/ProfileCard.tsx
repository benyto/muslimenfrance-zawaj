import { Link } from "react-router";
import { relationshipGoalLabels } from "@rencontre/shared";
import { photoUrl } from "~/lib/queries/usePhotos";

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
  return (
    <Link
      to={`/profile/${id}`}
      className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="aspect-[4/5] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        {primaryPhotoKey ? (
          <img
            src={photoUrl(primaryPhotoKey)}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300 dark:text-neutral-700">
            <span className="text-4xl">?</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-medium">
          {nickname}, {age}
        </p>
        {cityName && <p className="text-sm text-neutral-500 dark:text-neutral-400">{cityName}</p>}
        {relationshipGoal && (
          <span className="mt-1 inline-block rounded-full bg-brand-rose-50 px-2 py-0.5 text-xs text-brand-rose-600 dark:bg-neutral-800 dark:text-brand-rose-400">
            {relationshipGoalLabels[relationshipGoal] ?? relationshipGoal}
          </span>
        )}
      </div>
    </Link>
  );
}
