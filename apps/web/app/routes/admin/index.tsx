import { Link } from "react-router";
import { Users, Image as ImageIcon, Flag, UsersRound } from "lucide-react";
import { useAdminCounts } from "~/lib/queries/useAdmin";
import { Skeleton } from "~/components/ui/primitives";

const cards = [
  { key: "pendingProfiles", label: "Profils en attente", to: "/admin/profiles", icon: Users, tone: "warning" },
  { key: "pendingPhotos", label: "Photos en attente", to: "/admin/photos", icon: ImageIcon, tone: "warning" },
  { key: "pendingReports", label: "Signalements en attente", to: "/admin/reports", icon: Flag, tone: "danger" },
  { key: "totalProfiles", label: "Profils au total", to: "/admin/profiles", icon: UsersRound, tone: "neutral" },
] as const;

const toneClasses: Record<string, string> = {
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-sunken text-muted",
};

export default function AdminHome() {
  const { data: counts, isLoading } = useAdminCounts();

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink">Vue d&apos;ensemble</h1>
      <p className="mt-1 text-sm text-muted">
        Modération, signalements et configuration des abonnements.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(({ key, label, to, icon: Icon, tone }) => (
          <Link
            key={key}
            to={to}
            className="rounded-2xl border border-line bg-raised p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${toneClasses[tone]}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            {isLoading ? (
              <Skeleton className="mt-3 h-8 w-12" />
            ) : (
              <p className="tabular mt-3 text-2xl font-semibold text-ink">{counts?.[key]}</p>
            )}
            <p className="mt-1 text-sm text-muted">{label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
