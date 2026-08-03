import { Link } from "react-router";
import { useAdminCounts } from "~/lib/queries/useAdmin";

const cards = [
  { key: "pendingProfiles", label: "Profils en attente", to: "/admin/profiles" },
  { key: "pendingPhotos", label: "Photos en attente", to: "/admin/photos" },
  { key: "pendingReports", label: "Signalements en attente", to: "/admin/reports" },
  { key: "totalProfiles", label: "Profils au total", to: "/admin/profiles" },
] as const;

export default function AdminHome() {
  const { data: counts, isLoading } = useAdminCounts();

  return (
    <div>
      <h1 className="text-xl font-semibold">Administration</h1>
      <p className="mt-1 text-sm text-muted">
        Modération, signalements et configuration des abonnements.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.key}
            to={card.to}
            className="rounded-2xl border border-line bg-raised p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-2xl font-semibold">{isLoading ? "…" : counts?.[card.key]}</p>
            <p className="mt-1 text-sm text-muted">{card.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
