import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Users,
  Image as ImageIcon,
  Flag,
  CreditCard,
  ScrollText,
  LogOut,
  ArrowLeft,
  Menu,
} from "lucide-react";
import { supabase } from "~/lib/supabase-client";
import { useAdminCounts } from "~/lib/queries/useAdmin";
import { cn } from "~/lib/cn";
import { StarMark } from "~/components/ui/star";
import { IconButton } from "~/components/ui/button";
import { Sheet } from "~/components/ui/sheet";

const navItems = [
  { to: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard, end: true, badgeKey: undefined },
  { to: "/admin/profiles", label: "Profils", icon: Users, end: false, badgeKey: "pendingProfiles" },
  { to: "/admin/photos", label: "Photos", icon: ImageIcon, end: false, badgeKey: "pendingPhotos" },
  { to: "/admin/reports", label: "Signalements", icon: Flag, end: false, badgeKey: "pendingReports" },
  { to: "/admin/subscriptions", label: "Abonnements", icon: CreditCard, end: false, badgeKey: undefined },
  { to: "/admin/audit-log", label: "Journal", icon: ScrollText, end: false, badgeKey: undefined },
] as const;

// A dedicated dashboard shell rather than reusing AppShell — deliberately
// white/flat rather than the member app's ivory-and-gradient surface, so a
// moderator always has an unambiguous visual cue for which app they're in.
// Left sidebar on desktop; a Sheet-based drawer on mobile rather than
// trying to cram six nav items into a bottom tab bar.
export default function AdminShell() {
  const navigate = useNavigate();
  const { data: counts } = useAdminCounts();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const badges: Record<string, number | undefined> = {
    pendingProfiles: counts?.pendingProfiles,
    pendingPhotos: counts?.pendingPhotos,
    pendingReports: counts?.pendingReports,
  };

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  const navList = (onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {navItems.map(({ to, label, icon: Icon, end, badgeKey }) => {
        const badge = badgeKey ? badges[badgeKey] : undefined;
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                isActive ? "bg-primary-soft text-primary" : "text-muted hover:bg-sunken hover:text-ink"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {!!badge && (
              <span className="tabular rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-on-primary">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    // h-dvh + overflow-hidden on the shell, not min-h-dvh: with min-h-dvh
    // the page itself was the scrolling element, which drags the sidebar
    // away with the content on anything longer than one screen (the audit
    // log table, a long profiles list). Only <main> scrolls; the sidebar
    // stays put, which is the whole point of a persistent dashboard nav.
    <div className="flex h-dvh overflow-hidden bg-raised">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-line lg:flex">
        <div className="flex items-center gap-2 border-b border-line px-4 py-4">
          <StarMark className="h-5 w-5 text-accent" />
          <span className="font-serif text-lg text-ink">Rencontre</span>
          <span className="ml-auto rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-muted">
            Admin
          </span>
        </div>
        {navList()}
        <div className="flex flex-col gap-1 border-t border-line p-3">
          <NavLink
            to="/discover"
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            Retour à l&apos;app
          </NavLink>
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 lg:hidden">
          <IconButton label="Menu" size="sm" onClick={() => setMobileNavOpen(true)}>
            <Menu className="h-4 w-4" />
          </IconButton>
          <StarMark className="h-5 w-5 text-accent" />
          <span className="font-serif text-base text-ink">Rencontre Admin</span>
        </header>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen} title="Rencontre Admin">
          <div className="flex flex-col gap-1">
            {navItems.map(({ to, label, icon: Icon, end, badgeKey }) => {
              const badge = badgeKey ? badges[badgeKey] : undefined;
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                      isActive ? "bg-primary-soft text-primary" : "text-muted hover:bg-sunken hover:text-ink"
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {!!badge && (
                    <span className="tabular rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-on-primary">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
            <hr className="my-2 border-line" />
            <NavLink
              to="/discover"
              onClick={() => setMobileNavOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted hover:bg-sunken hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              Retour à l&apos;app
            </NavLink>
            <button
              type="button"
              onClick={signOut}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted hover:bg-sunken hover:text-ink"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              Déconnexion
            </button>
          </div>
        </Sheet>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
