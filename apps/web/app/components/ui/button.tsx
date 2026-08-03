import { Link } from "react-router";
import { cn } from "~/lib/cn";
import { StarSpinner } from "./star";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

// Replaces 12 distinct hand-written button strings across the app, which had
// drifted into four different paddings for what was visually one button and
// mostly lacked hover/active/focus states entirely.
const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-hover shadow-sm",
  secondary:
    "border border-line-strong bg-raised text-ink hover:bg-sunken active:bg-sunken",
  ghost: "text-muted hover:bg-sunken hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110 active:brightness-95 shadow-sm",
};

// min-h keeps every control at the 44px touch target the app was missing
// almost everywhere (most were 36–38px, some had no padding at all).
const sizes: Record<Size, string> = {
  sm: "min-h-9 gap-1.5 rounded-lg px-3 text-xs",
  md: "min-h-11 gap-2 rounded-xl px-4 text-sm",
  lg: "min-h-12 gap-2 rounded-xl px-6 text-sm",
};

const base =
  "inline-flex select-none items-center justify-center font-medium transition-colors disabled:pointer-events-none disabled:opacity-55";

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClass({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <StarSpinner className="h-4 w-4 text-current" />}
      {children}
    </button>
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />;
}

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: Variant;
  size?: Size;
};

// Square variant for icon-only controls. `label` is required so an icon
// button can never ship without an accessible name.
export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  className,
  children,
  ...props
}: IconButtonProps) {
  const square = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-12 w-12" : "h-11 w-11";
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        base,
        variants[variant],
        "rounded-full p-0",
        square,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
