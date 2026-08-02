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
    <div>
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-neutral-200 pb-3 dark:border-neutral-800">
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
                    ? "bg-brand-rose-50 text-brand-rose-600 dark:bg-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
                }`
              }
            >
              {item.label}
              {!!badge && (
                <span className="rounded-full bg-brand-rose-500 px-1.5 text-xs text-white">{badge}</span>
              )}
            </NavLink>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
