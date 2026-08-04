import { cn } from "~/lib/cn";
import { StarMark } from "./star";

/* ------------------------------------------------------------------ Card */
// One card recipe, replacing 14 copies that had drifted — some with a
// background, some without (those sat directly on the body gradient), some
// with a shadow, most without.
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-raised shadow-[0_1px_2px_rgb(28_25_23/0.04)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
      <div className="min-w-0">
        <h2 className="font-serif text-lg leading-tight text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------- Badge */
type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger";

// One badge system, replacing four divergent ones (settings, admin/profiles,
// admin/reports and PhotoManager each had their own colour map).
const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-muted",
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- Divider */
// The app had no <hr> anywhere; sections were separated by bare whitespace.
// The star variant carries the motif into structure instead of decoration.
export function Divider({
  label,
  star = false,
  className,
}: {
  label?: string;
  star?: boolean;
  className?: string;
}) {
  if (!label && !star) {
    return <hr className={cn("border-0 border-t border-line", className)} />;
  }
  return (
    <div className={cn("flex items-center gap-3", className)} role="separator">
      <span className="h-px flex-1 bg-line" />
      {star && <StarMark className="h-3 w-3 shrink-0 text-accent" />}
      {label && (
        <span className="shrink-0 text-xs font-medium tracking-wide text-muted">{label}</span>
      )}
      {star && label && <StarMark className="h-3 w-3 shrink-0 text-accent" />}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/* -------------------------------------------------------------- Skeleton */
// Replaces 9 `return null` loading branches (blank screens with layout jump)
// and 8 bare "Chargement..." strings.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-sunken", className)} />;
}

/* ------------------------------------------------------------ EmptyState */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <StarMark className="h-8 w-8 text-line" />
      <p className="mt-4 font-serif text-lg text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- Chip */
// Toggle pill for filters — replaces bare <select>s whose label vanished the
// moment a value was chosen.
export function Chip({
  selected = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-9 select-none items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
        selected
          ? "bg-primary text-on-primary"
          : "border border-line-strong bg-raised text-ink hover:bg-sunken",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------ ProgressBar */
export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label?: React.ReactNode;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={className}>
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
          <span className="text-ink">{label}</span>
          <span className="tabular font-mono text-xs text-muted">{pct}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-sunken"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Avatar */
function initialsOf(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

const avatarSizes = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

// Fallback is the star tile with an initial, replacing an empty grey circle
// in the conversation list and a `?` glyph at ~1.5:1 contrast on cards.
export function Avatar({
  src,
  name,
  size = "md",
  className,
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof avatarSizes;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft",
        avatarSizes[size],
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={`Photo de ${name}`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <StarMark className="absolute h-full w-full text-accent/15" />
          <span className="relative font-serif text-primary">{initialsOf(name)}</span>
        </>
      )}
    </span>
  );
}
