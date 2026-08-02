import { NavLink, Outlet } from "react-router";
import { supabase } from "~/lib/supabase-client";

const navItems = [
  { to: "/discover", label: "Découvrir" },
  { to: "/messages", label: "Messages" },
  { to: "/profile/me", label: "Profil" },
  { to: "/settings", label: "Réglages" },
];

export default function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/80 backdrop-blur dark:border-neutral-800/80 dark:bg-neutral-950/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="bg-gradient-to-r from-brand-rose-500 to-brand-purple-500 bg-clip-text text-lg font-semibold text-transparent">
            Rencontre
          </span>
          <nav className="hidden gap-1 sm:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "bg-brand-rose-50 text-brand-rose-600 dark:bg-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-neutral-200 bg-white/95 backdrop-blur sm:hidden dark:border-neutral-800 dark:bg-neutral-950/95">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-xs font-medium ${
                isActive ? "text-brand-rose-600" : "text-neutral-500"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
