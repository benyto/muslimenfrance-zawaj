import { cn } from "~/lib/cn";

// The rub el hizb (khatim) — two superimposed squares forming a true
// 8-point octagram, the app's one signature motif. Geometry is exact:
// inner/outer radius ratio is cos(45°)/cos(22.5°) = 0.7654, not eyeballed.
//
// It is deliberately load-bearing rather than decorative — it answers four
// separate gaps at once: the avatar/photo fallback (which was a `?` at
// 1.5:1 contrast), section and date dividers (the app had no <hr> at all),
// the loading indicator (which was `return null`), and empty states.
const STAR_PATH =
  "M 50 3 L 63.77 16.77 L 83.23 16.77 L 83.23 36.23 L 97 50 L 83.23 63.77 L 83.23 83.23 L 63.77 83.23 L 50 97 L 36.23 83.23 L 16.77 83.23 L 16.77 63.77 L 3 50 L 16.77 36.23 L 16.77 16.77 L 36.23 16.77 Z";

export function StarMark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4", className)}
      {...props}
    >
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
  );
}

export function StarOutlineMark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4", className)}
      {...props}
    >
      <path d={STAR_PATH} fill="none" stroke="currentColor" strokeWidth={5} strokeLinejoin="round" />
    </svg>
  );
}

// 8-fold symmetry means a slow rotation reads as continuous motion rather
// than a spinning shape — quieter than a conventional spinner.
export function StarSpinner({
  className,
  label = "Chargement",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <StarMark
        className={cn("h-5 w-5 animate-spin text-accent [animation-duration:1.8s]", className)}
      />
    </span>
  );
}
