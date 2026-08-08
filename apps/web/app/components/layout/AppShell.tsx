import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Compass, LogOut, MessagesSquare, Settings, UserRound } from "lucide-react";
import { supabase } from "~/lib/supabase-client";
import { useConversations } from "~/lib/queries/useConversations";
import { useMyProfile } from "~/lib/queries/useMyProfile";
import { usePhotos } from "~/lib/queries/usePhotos";
import { computeProfileCompletion, PROFILE_COMPLETION_THRESHOLD } from "~/lib/profile-completion";
import { useLastSeenHeartbeat } from "~/lib/realtime/usePresence";
import { cn } from "~/lib/cn";
import { StarMark } from "~/components/ui/star";
import { IconButton } from "~/components/ui/button";

const navItems = [
  { to: "/discover", label: "Découvrir", icon: Compass },
  { to: "/messages", label: "Messages", icon: MessagesSquare },
  { to: "/profile/me", label: "Profil", icon: UserRound },
  { to: "/settings", label: "Réglages", icon: Settings },
] as const;

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: conversations } = useConversations();

  // Query only — the realtime channel is owned solely by ConversationsList
  // (mounting useInboxSubscription twice throws in Supabase Realtime).
  // React Query dedupes this against the list's own use of the same key.
  const unread = (conversations ?? []).reduce(
    (total, c) => total + Number(c.unread_count ?? 0),
    0
  );

  const { data: profile } = useMyProfile();
  const { data: photos } = usePhotos(profile?.id);
  const isProfileIncomplete =
    computeProfileCompletion(profile, photos?.length ?? 0) < PROFILE_COMPLETION_THRESHOLD;

  // Mounted once, here — one heartbeat interval per session is enough;
  // mounting it per-component would just multiply writes for no benefit.
  useLastSeenHeartbeat(profile?.id, profile?.show_online_status ?? true);

  // An open conversation is a focused mode: the composer needs the bottom
  // edge, so the tab bar steps aside rather than competing with it.
  const isChatOpen = /^\/messages\/[^/]+$/.test(location.pathname);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-raised shadow-sm">
        <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/discover" className="flex items-center gap-2">
            <StarMark className="h-5 w-5 text-accent" />
            <span className="font-serif text-xl leading-none text-ink">Rencontre</span>
          </NavLink>

          <nav className="hidden items-center gap-1 sm:flex">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "relative inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-soft text-primary"
                      : "text-muted hover:bg-sunken hover:text-ink"
                  )
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
                {to === "/messages" && unread > 0 && (
                  <span className="tabular ml-0.5 min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-ink">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
                {to === "/profile/me" && isProfileIncomplete && (
                  <>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    <span className="sr-only">Profil incomplet</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <IconButton label="Se déconnecter" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      {/* No max-width here — the messaging workspace needs the full width for
          its 3-column desktop layout. Narrower pages (profile, settings,
          admin) apply their own max-w-3xl, since a child cannot escape a
          parent's max-width once it is set. */}
      <main
        className={cn(
          "mx-auto w-full max-w-[1920px] flex-1 px-4 py-6",
          isChatOpen ? "pb-6" : "pb-24 sm:pb-6"
        )}
      >
        <Outlet />
      </main>

      {!isChatOpen && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur sm:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  // min-h-14 gets these over the 44px target the old text-only
                  // tab bar (40px) missed.
                  "min-h-14",
                  isActive ? "text-primary" : "text-muted"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {to === "/messages" && unread > 0 && (
                      <span className="tabular absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-ink">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                    {to === "/profile/me" && isProfileIncomplete && (
                      <>
                        <span
                          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent"
                          aria-hidden="true"
                        />
                        <span className="sr-only">Profil incomplet</span>
                      </>
                    )}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
