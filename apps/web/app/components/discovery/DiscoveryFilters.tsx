import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import {
  genderOptions,
  genderLabels,
  relationshipGoalOptions,
  relationshipGoalLabels,
  worldCountryNameByCode,
} from "@rencontre/shared";
import { useDepartments, useRegions } from "~/lib/queries/useGeography";
import { CommuneAutocomplete } from "~/components/profile/CommuneAutocomplete";
import { CountryAutocomplete } from "~/components/profile/CountryAutocomplete";
import type { DiscoverFilters } from "~/lib/queries/useDiscoverProfiles";
import { Button } from "~/components/ui/button";
import { Chip } from "~/components/ui/primitives";
import { Field, Input, Select } from "~/components/ui/form";
import { Sheet } from "~/components/ui/sheet";

/**
 * Previously seven bare controls sat directly on the page, wrapping into five
 * rows (222px) and pushing the first profile card to y=399px — on a 375x667
 * screen not one complete card fitted above the fold.
 *
 * Now: a single trigger row plus removable chips for what's actually active,
 * with the controls themselves in a sheet. The label problem is fixed too —
 * each field's name used to live in its blank first <option>, so it vanished
 * the moment a value was picked.
 */

export function activeFilterCount(filters: DiscoverFilters) {
  return Object.values(filters).filter((v) => v !== undefined && v !== "").length;
}

export function DiscoveryFilters({
  filters,
  onChange,
  resultCount,
}: {
  filters: DiscoverFilters;
  onChange: (next: DiscoverFilters) => void;
  resultCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const { data: regions } = useRegions();
  const { data: departments } = useDepartments();

  const departmentOptions = filters.regionCode
    ? departments?.filter((d) => d.region_code === filters.regionCode)
    : departments;

  const count = activeFilterCount(filters);

  function set<K extends keyof DiscoverFilters>(key: K, value: DiscoverFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  // Human-readable summary of what's on, so a member can see and drop
  // individual filters without reopening the sheet.
  const chips: { key: keyof DiscoverFilters; label: string }[] = [];
  if (filters.gender) chips.push({ key: "gender", label: genderLabels[filters.gender] });
  if (filters.relationshipGoal)
    chips.push({
      key: "relationshipGoal",
      label: relationshipGoalLabels[filters.relationshipGoal] ?? filters.relationshipGoal,
    });
  if (filters.regionCode) {
    const region = regions?.find((r) => r.code === filters.regionCode);
    if (region) chips.push({ key: "regionCode", label: region.name });
  }
  if (filters.departmentCode) {
    const department = departments?.find((d) => d.code === filters.departmentCode);
    if (department) chips.push({ key: "departmentCode", label: department.name });
  }
  if (filters.communeInseeCode) chips.push({ key: "communeInseeCode", label: "Ville choisie" });
  if (filters.originCountryCode)
    chips.push({
      key: "originCountryCode",
      label: worldCountryNameByCode[filters.originCountryCode] ?? filters.originCountryCode,
    });
  if (filters.minAge) chips.push({ key: "minAge", label: `${filters.minAge} ans et +` });
  if (filters.maxAge) chips.push({ key: "maxAge", label: `${filters.maxAge} ans et −` });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filtres
          {count > 0 && (
            <span className="tabular ml-0.5 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-on-primary">
              {count}
            </span>
          )}
        </Button>

        {resultCount !== undefined && (
          <p className="text-sm text-muted">
            <span className="tabular font-medium text-ink">{resultCount}</span>{" "}
            {resultCount === 1 ? "profil" : "profils"}
          </p>
        )}

        {count > 0 && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="ml-auto text-sm font-medium text-accent-ink hover:underline"
          >
            Tout effacer
          </button>
        )}
      </div>

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => set(chip.key, undefined)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary-soft px-3 text-xs font-medium text-primary hover:bg-sunken"
              >
                {chip.label}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">Retirer ce filtre</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Affiner la recherche"
        description="Trouvez les profils qui vous correspondent."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => onChange({})}>
              Tout effacer
            </Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>
              {resultCount !== undefined
                ? `Voir ${resultCount} ${resultCount === 1 ? "profil" : "profils"}`
                : "Voir les résultats"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Genre</legend>
            <div className="flex flex-wrap gap-2">
              {genderOptions.map((g) => (
                <Chip
                  key={g}
                  selected={filters.gender === g}
                  onClick={() => set("gender", filters.gender === g ? undefined : g)}
                >
                  {genderLabels[g]}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Objectif relationnel</legend>
            <div className="flex flex-wrap gap-2">
              {relationshipGoalOptions.map((g) => (
                <Chip
                  key={g}
                  selected={filters.relationshipGoal === g}
                  onClick={() =>
                    set("relationshipGoal", filters.relationshipGoal === g ? undefined : g)
                  }
                >
                  {relationshipGoalLabels[g]}
                </Chip>
              ))}
            </div>
          </fieldset>

          <Field label="Ville">
            {() => (
              <CommuneAutocomplete
                value={filters.communeInseeCode}
                onChange={(code) => set("communeInseeCode", code ?? undefined)}
                placeholder="Rechercher une ville…"
              />
            )}
          </Field>

          <Field label="Pays d'origine">
            {() => (
              <CountryAutocomplete
                value={filters.originCountryCode}
                onChange={(code) => set("originCountryCode", code ?? undefined)}
              />
            )}
          </Field>

          <Field label="Région">
            {(props) => (
              <Select
                {...props}
                value={filters.regionCode ?? ""}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    regionCode: e.target.value || undefined,
                    departmentCode: undefined,
                  })
                }
              >
                <option value="">Toutes les régions</option>
                {regions?.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Département">
            {(props) => (
              <Select
                {...props}
                value={filters.departmentCode ?? ""}
                onChange={(e) => set("departmentCode", e.target.value || undefined)}
              >
                <option value="">Tous les départements</option>
                {departmentOptions?.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Âge minimum">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min={18}
                  max={120}
                  placeholder="18"
                  value={filters.minAge ?? ""}
                  onChange={(e) =>
                    set("minAge", e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              )}
            </Field>
            <Field label="Âge maximum">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min={18}
                  max={120}
                  placeholder="99"
                  value={filters.maxAge ?? ""}
                  onChange={(e) =>
                    set("maxAge", e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              )}
            </Field>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
