import { useState } from "react";

export function TagInput({
  label,
  placeholder,
  value,
  onChange,
  max,
}: {
  label: string;
  placeholder: string;
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
}) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const trimmed = draft.trim();
    if (!trimmed || value.includes(trimmed) || value.length >= max) return;
    onChange([...value, trimmed]);
    setDraft("");
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</label>
      <div className="mb-2 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-rose-500 dark:border-neutral-800 dark:bg-neutral-900"
        />
        <button
          type="button"
          onClick={addTag}
          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
        >
          Ajouter
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-800"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="text-neutral-400 hover:text-red-600"
              aria-label={`Retirer ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
