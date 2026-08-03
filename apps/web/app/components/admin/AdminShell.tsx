import { NavLink, Outlet } from "react-router";
import { useAdminCounts } from "~/lib/queries/useAdmin";

const navItems = [
  { to: "/admin", label: "Vue d'ensemble", end: true },
  { to: "/admin/profiles", label: "Profils" },
  { to: "/admin/photos", label: "Photos" },
  { to: "/admin/reports", label: "Signalements" },
  { to: "/admin/subscriptions", label: "Abonnements" },
  { to: "/admin/audit-log", label: "Journal" },
] as const;

export default function AdminShell() {
  const { data: counts } = useAdminCounts();

  const badges: Record<string, number | undefined> = {
    "/admin/profiles": counts?.pendingProfiles,
    "/admin/photos": counts?.pendingPhotos,
    "/admin/reports": counts?.pendingReports,
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-line pb-3">
        {navItems.map((item) => {
          const badge = badges[item.to];
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : false}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isActive
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:bg-sunken dark:hover:bg-raised"
                }`
              }
            >
              {item.label}
              {!!badge && (
                <span className="rounded-full bg-primary px-1.5 text-xs text-on-primary">{badge}</span>
              )}
            </NavLink>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
