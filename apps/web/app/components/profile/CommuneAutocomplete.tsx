import { useEffect, useRef, useState } from "react";
import { useCommuneByCode, useCommuneSearch } from "~/lib/queries/useGeography";

const inputClass =
  "w-full rounded-xl border border-line bg-raised px-3 py-2 text-sm outline-none focus:border-primary";

function debounce<T extends (...args: never[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function CommuneAutocomplete({
  value,
  onChange,
  placeholder = "Rechercher une ville...",
}: {
  value: string | null | undefined;
  onChange: (codeInsee: string | null) => void;
  placeholder?: string;
}) {
  const { data: selectedCommune } = useCommuneByCode(value);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedSetRef = useRef(debounce((v: string) => setDebouncedQuery(v), 250));

  const { data: suggestions } = useCommuneSearch(debouncedQuery);

  useEffect(() => {
    if (selectedCommune && !query) {
      setQuery(`${selectedCommune.nom_standard} (${selectedCommune.code_postal})`);
    }
  }, [selectedCommune]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          setOpen(true);
          debouncedSetRef.current(v);
          if (v === "") onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={inputClass}
      />
      {open && suggestions && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-raised py-1 shadow-lg">
          {suggestions.map((commune) => (
            <li key={commune.code_insee}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(commune.code_insee);
                  setQuery(`${commune.nom_standard} (${commune.code_postal})`);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-sunken dark:hover:bg-sunken"
              >
                <span>{commune.nom_standard}</span>
                <span className="text-xs text-muted">
                  {commune.code_postal} · {commune.dep_nom}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
