import { useState } from "react";
import { cn } from "~/lib/cn";
import { ConversationsList } from "./ConversationsList";
import { FavoritesList } from "./FavoritesList";

// Tabbed wrapper around the two sidebar lists. ConversationsList stays
// mounted regardless of which tab is active — it owns the inbox realtime
// subscription, which must only ever be mounted once (two live instances
// race on the same channel name), so switching tabs hides it with CSS
// rather than unmounting it, which would tear the channel down and rebuild
// it on every switch.
export function ContactsSidebar({ activeProfileId }: { activeProfileId?: string }) {
  const [tab, setTab] = useState<"contacts" | "favorites">("contacts");

  return (
    <div className="flex flex-col">
      <div className="flex border-b border-line" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "contacts"}
          onClick={() => setTab("contacts")}
          className={cn(
            "min-h-11 flex-1 border-b-2 px-4 text-sm font-medium transition-colors",
            tab === "contacts"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-ink"
          )}
        >
          Contacts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "favorites"}
          onClick={() => setTab("favorites")}
          className={cn(
            "min-h-11 flex-1 border-b-2 px-4 text-sm font-medium transition-colors",
            tab === "favorites"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-ink"
          )}
        >
          Favoris
        </button>
      </div>

      <div className={tab === "contacts" ? "" : "hidden"}>
        <ConversationsList activeProfileId={activeProfileId} />
      </div>
      <div className={tab === "favorites" ? "" : "hidden"}>
        <FavoritesList activeProfileId={activeProfileId} />
      </div>
    </div>
  );
}
