import { useEffect, useState } from "react";
import { Select } from "./form";

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

type Parts = { day: string; month: string; year: string };
const EMPTY: Parts = { day: "", month: "", year: "" };

const pad = (n: number | string) => String(n).padStart(2, "0");
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

function parse(value: string | null | undefined): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  return match ? { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) } : EMPTY;
}

function compose({ day, month, year }: Parts): string {
  return day && month && year ? `${year}-${pad(month)}-${pad(day)}` : "";
}

/**
 * Day / month / year selects for a birth date. A calendar popup is the wrong
 * tool for a date decades back — you'd page through hundreds of months —
 * and the native <input type="date"> looks different in every browser. Native
 * selects keep the phone's own picker, and the app's Select styling keeps
 * them consistent with every other field.
 *
 * Value is an ISO "YYYY-MM-DD" string, or "" until all three parts are
 * chosen — a half-picked date is never reported as a value.
 */
export function BirthDateInput({
  value,
  onChange,
  minAge = 18,
  maxAge = 100,
  ...ariaProps
}: {
  value: string | null | undefined;
  onChange: (value: string) => void;
  minAge?: number;
  maxAge?: number;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [parts, setParts] = useState<Parts>(() => parse(value));

  // Follow outside changes (form reset after save / fresh load) without
  // wiping a half-finished selection: an empty value only clears the parts
  // once they were complete.
  useEffect(() => {
    if (value) {
      setParts((current) => (compose(current) === value ? current : parse(value)));
    } else {
      setParts((current) => (compose(current) ? EMPTY : current));
    }
  }, [value]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: maxAge - minAge + 1 }, (_, i) => currentYear - minAge - i);
  const maxDay = parts.year && parts.month ? daysInMonth(Number(parts.year), Number(parts.month)) : 31;

  function update(patch: Partial<Parts>) {
    const next = { ...parts, ...patch };
    // Feb 31 and friends: shrink the day instead of leaving an invalid date.
    if (next.day && next.year && next.month && Number(next.day) > daysInMonth(Number(next.year), Number(next.month))) {
      next.day = String(daysInMonth(Number(next.year), Number(next.month)));
    }
    setParts(next);
    onChange(compose(next));
  }

  return (
    <div role="group" aria-label="Date de naissance" className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)_minmax(0,1.2fr)] gap-2">
      {/* The label's htmlFor targets `id`, so it lives on the first control. */}
      <Select {...ariaProps} aria-label="Jour" value={parts.day} onChange={(e) => update({ day: e.target.value })}>
        <option value="">Jour</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Mois"
        aria-invalid={ariaProps["aria-invalid"]}
        value={parts.month}
        onChange={(e) => update({ month: e.target.value })}
      >
        <option value="">Mois</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Année"
        aria-invalid={ariaProps["aria-invalid"]}
        value={parts.year}
        onChange={(e) => update({ year: e.target.value })}
      >
        <option value="">Année</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  );
}
