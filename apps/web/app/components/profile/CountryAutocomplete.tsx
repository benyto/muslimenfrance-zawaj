import { useEffect, useMemo, useState } from "react";
import { worldCountries, worldCountryNameByCode } from "@rencontre/shared";

const inputClass =
  "w-full rounded-xl border border-line bg-raised px-3 py-2 text-sm outline-none focus:border-primary";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Unlike CommuneAutocomplete (~35k rows, needs a debounced server search),
// the world country list is 250 static rows — cheap enough to filter
// entirely client-side on every keystroke.
export function CountryAutocomplete({
  value,
  onChange,
  placeholder = "Rechercher un pays...",
}: {
  value: string | null | undefined;
  onChange: (code: string | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (value && !query) {
      setQuery(worldCountryNameByCode[value] ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = normalize(query);
    return worldCountries.filter((c) => normalize(c.name).includes(q)).slice(0, 20);
  }, [query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          setOpen(true);
          if (v === "") onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={inputClass}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-raised py-1 shadow-lg">
          {suggestions.map((country) => (
            <li key={country.code}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(country.code);
                  setQuery(country.name);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-sunken dark:hover:bg-sunken"
              >
                {country.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
