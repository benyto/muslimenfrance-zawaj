import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/cn";

// Shared control surface. `border-line-strong` (3.33:1 on ivory) rather than
// the old decorative border, which was 1.29:1 — below WCAG 1.4.11 for a
// control boundary. Focus comes from the global :focus-visible ring in
// app.css, so no control strips its outline any more.
const controlBase =
  "w-full min-h-11 rounded-xl border border-line-strong bg-raised px-3.5 text-sm text-ink transition-colors placeholder:text-muted/70 hover:border-primary/50 disabled:opacity-55";

/**
 * Wires label → control → error/hint via id + aria-describedby.
 * Previously not one of the app's 24 form fields had htmlFor/id pairing, so
 * no label was programmatically associated with its input.
 */
export function Field({
  label,
  error,
  hint,
  required,
  full,
  children,
}: {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  full?: boolean;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children({
        id,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, "py-2.5", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlBase, "py-2.5", className)} {...props} />;
}

// Native <select> keeps mobile's native picker (genuinely better on touch
// than any custom listbox), but the default chevron is replaced so it matches
// the rest of the system across browsers.
export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(controlBase, "appearance-none py-2.5 pr-10", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
      {/* h-5 w-5 rather than the old h-4 w-4 — a 16px GDPR consent checkbox
          was the smallest target in the app. */}
      <input
        type="checkbox"
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0 rounded border-line-strong text-primary accent-[var(--primary)]",
          className
        )}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
