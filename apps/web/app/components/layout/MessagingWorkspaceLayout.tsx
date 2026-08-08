import { useRef } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router";
import { ContactsSidebar } from "~/components/messaging/ContactsSidebar";
import { ProfileDetailPanel } from "~/components/profile/ProfileDetailPanel";
import type { ChatOutletContext } from "~/routes/messages/$profileId";

// Desktop-only 3-column workspace wrapping /discover, /messages,
// /messages/:profileId and /profile/:id: a persistent contacts/favorites
// sidebar (left) and profile preview (right) stay mounted across
// navigation between those routes — only the center Outlet swaps.
//
// ContactsSidebar's Contacts tab (ConversationsList) owns a realtime
// channel keyed by the caller's profile id (see useInboxSubscription) —
// mounting it twice at once (e.g. once here, hidden via CSS, and again
// inside the /messages route for mobile) makes Supabase Realtime throw
// ("cannot add postgres_changes callbacks ... after subscribe()") because
// both instances race to open a channel with the same name. So it is
// mounted in exactly one place, here, and its container is repositioned
// rather than duplicated: full-width in document flow on mobile when the
// bare /messages route is active (replacing what the Outlet would show), a
// persistent sidebar on desktop, hidden entirely on mobile for every other
// route.
//
// The "selected profile" for the right column is derived from the current
// route rather than passed down explicitly: /messages/:profileId's or
// /profile/:id's param directly, or /discover's ?preview= search param
// (set by ProfileCard).
export default function MessagingWorkspaceLayout() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Which conversation partner's messages are both open AND scrolled into
  // view right now, if any — written by the chat route (via Outlet
  // context) and read by useInboxSubscription to decide whether a new
  // message needs a toast. Being on the /messages/:id route alone isn't
  // enough to skip the toast: the reader could be scrolled up through
  // older messages (now that the thread paginates) and never see a
  // message that lands at the bottom. A ref, not state — this only needs
  // to be read inside an async realtime callback, never rendered.
  const pinnedProfileRef = useRef<string | null>(null);

  const messagesMatch = location.pathname.match(/^\/messages\/([^/]+)$/);
  const profileMatch = location.pathname.match(/^\/profile\/([^/]+)$/);
  const isMessagesIndex = location.pathname === "/messages";
  const selectedProfileId = messagesMatch
    ? messagesMatch[1]
    : profileMatch
      ? profileMatch[1]
      : location.pathname === "/discover"
        ? searchParams.get("preview")
        : null;

  function clearPreview() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("preview");
      return next;
    });
  }

  return (
    // Both sidebars cap their internal scroll at var(--pane-h) — the same
    // chrome-corrected height the chat pane uses (see app.css) — rather than
    // their own separate guess. They used to hardcode 100dvh-6rem (96px of
    // chrome), which was 21px short of the real 117px; a sidebar with tall
    // enough content (a full profile card) rendered 21px taller than the
    // viewport actually had room for, leaving dead space below the fold and
    // a second, unnecessary document-level scrollbar to reach it.
    <div className="flex items-start gap-6">
      <aside className={`w-full lg:sticky lg:top-20 lg:w-80 lg:shrink-0 ${isMessagesIndex ? "block" : "hidden lg:block"}`}>
        {isMessagesIndex && <h1 className="mb-4 text-xl font-semibold lg:hidden">Messages</h1>}
        <div className="lg:max-h-[var(--pane-h)] lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-line lg:bg-raised">
          <ContactsSidebar activeProfileId={messagesMatch?.[1]} pinnedProfileRef={pinnedProfileRef} />
        </div>
      </aside>

      <div className={`min-w-0 flex-1 ${isMessagesIndex ? "hidden lg:block" : ""}`}>
        <Outlet context={{ pinnedProfileRef } satisfies ChatOutletContext} />
      </div>

      {/* Fixed width regardless of what's in the center column — the whole
          point of a persistent workspace is that these columns don't resize
          as you move between Découvrir and Messages. Anything a given
          center view wants narrower (the chat thread, for instance) caps
          itself internally instead of resizing this aside. */}
      {/* flex-col + overflow-hidden, not a single padded overflow-y-auto box:
          ProfileDetailPanel's "panel" variant splits itself into a scrolling
          content region and a footer that's a plain sibling outside it, so
          the footer can never be overlapped by content scrolling behind it.
          A fixed h-[var(--pane-h)] (not max-h) on purpose: the panel's own
          h-full > flex-1 > overflow-y-auto chain needs a definite height to
          resolve against — against a max-height alone that's ambiguous, and
          the inner scroll region would silently stop scrolling and just get
          clipped by this box's overflow-hidden instead. */}
      <aside className="sticky top-20 hidden w-[26rem] shrink-0 xl:block">
        <div className="flex h-[var(--pane-h)] flex-col overflow-hidden rounded-2xl border border-line bg-raised">
          {selectedProfileId ? (
            <ProfileDetailPanel
              key={selectedProfileId}
              profileId={selectedProfileId}
              variant="panel"
              onBlocked={clearPreview}
              onClose={location.pathname === "/discover" ? clearPreview : undefined}
            />
          ) : (
            <p className="p-6 text-sm text-muted">
              Sélectionnez une conversation ou un profil pour voir ses détails ici.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
