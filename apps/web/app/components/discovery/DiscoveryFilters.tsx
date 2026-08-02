import {
  genderOptions,
  genderLabels,
  relationshipGoalOptions,
  relationshipGoalLabels,
} from "@rencontre/shared";
import { useCities } from "~/lib/queries/useCities";
import type { DiscoverFilters } from "~/lib/queries/useDiscoverProfiles";

const selectClass =
  "rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-rose-500 dark:border-neutral-800 dark:bg-neutral-900";

export function DiscoveryFilters({
  filters,
  onChange,
}: {
  filters: DiscoverFilters;
  onChange: (next: DiscoverFilters) => void;
}) {
  const { data: cities } = useCities();

  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={filters.gender ?? ""}
        onChange={(e) => onChange({ ...filters, gender: (e.target.value || undefined) as DiscoverFilters["gender"] })}
        className={selectClass}
      >
        <option value="">Genre</option>
        {genderOptions.map((g) => (
          <option key={g} value={g}>
            {genderLabels[g]}
          </option>
        ))}
      </select>

      <select
        value={filters.cityId ?? ""}
        onChange={(e) => onChange({ ...filters, cityId: e.target.value || undefined })}
        className={selectClass}
      >
        <option value="">Ville</option>
        {cities?.map((city) => (
          <option key={city.id} value={city.id}>
            {city.name}
          </option>
        ))}
      </select>

      <select
        value={filters.relationshipGoal ?? ""}
        onChange={(e) => onChange({ ...filters, relationshipGoal: e.target.value || undefined })}
        className={selectClass}
      >
        <option value="">Objectif</option>
        {relationshipGoalOptions.map((g) => (
          <option key={g} value={g}>
            {relationshipGoalLabels[g]}
          </option>
        ))}
      </select>

      <input
        type="number"
        placeholder="Âge min"
        value={filters.minAge ?? ""}
        onChange={(e) => onChange({ ...filters, minAge: e.target.value ? Number(e.target.value) : undefined })}
        className={`${selectClass} w-24`}
        min={18}
      />
      <input
        type="number"
        placeholder="Âge max"
        value={filters.maxAge ?? ""}
        onChange={(e) => onChange({ ...filters, maxAge: e.target.value ? Number(e.target.value) : undefined })}
        className={`${selectClass} w-24`}
        min={18}
      />
    </div>
  );
}
