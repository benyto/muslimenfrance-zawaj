import { Link } from "react-router";
import { formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import { useConversations } from "~/lib/queries/useConversations";
import { useMyProfile } from "~/lib/queries/useMyProfile";
import { useInboxSubscription } from "~/lib/realtime/useInboxSubscription";
import { photoUrl } from "~/lib/queries/usePhotos";
import { cn } from "~/lib/cn";
import { Avatar, EmptyState, Skeleton } from "~/components/ui/primitives";
import { ButtonLink } from "~/components/ui/button";

// Shared between the mobile full-page list and the persistent desktop
// sidebar. Mounted in exactly one place (MessagingWorkspaceLayout) because
// useInboxSubscription opens a realtime channel keyed by profile id, and two
// live instances race on the same channel name.
export function ConversationsList({ activeProfileId }: { activeProfileId?: string }) {
  const { data: myProfile } = useMyProfile();
  useInboxSubscription(myProfile?.id, activeProfileId);
  const { data: conversations, isLoading } = useConversations();

  if (isLoading) {
    return (
      <ul className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <EmptyState
        title="Aucune conversation"
        description="Vos échanges apparaîtront ici. Commencez par découvrir des profils."
        action={
          <ButtonLink to="/discover" variant="secondary" size="sm">
            Découvrir des profils
          </ButtonLink>
        }
      />
    );
  }

  const totalUnread = conversations.reduce((sum, c) => sum + Number(c.unread_count ?? 0), 0);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="text-sm text-muted">
          {conversations.length} {conversations.length === 1 ? "conversation" : "conversations"}
        </span>
        {totalUnread > 0 && (
          <span className="tabular shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold leading-none text-ink">
            {totalUnread > 9 ? "9+" : totalUnread} non lu{totalUnread > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {conversations.map((c) => {
          const isActive = c.other_profile_id === activeProfileId;
          const unread = Number(c.unread_count ?? 0);
          // last_message_at and last_message_sender_profile_id were already
          // being fetched by the RPC and thrown away — both are used now.
          const sentByMe = c.last_message_sender_profile_id === myProfile?.id;

          return (
            <li key={c.conversation_id} className="relative">
              {isActive && (
                <span
                  className="absolute inset-y-0 left-0 w-0.5 bg-accent"
                  aria-hidden="true"
                />
              )}
              <Link
                to={`/messages/${c.other_profile_id}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-4 py-4 transition-colors",
                  isActive ? "bg-primary-soft" : "hover:bg-sunken"
                )}
              >
                <Avatar
                  src={c.other_photo_key ? photoUrl(c.other_photo_key) : null}
                  name={c.other_nickname ?? "?"}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-base",
                        unread > 0 ? "font-semibold text-ink" : "font-medium text-ink"
                      )}
                    >
                      {c.other_nickname}
                    </p>
                    {c.last_message_at && (
                      <time
                        dateTime={c.last_message_at}
                        className="tabular shrink-0 font-mono text-xs text-muted"
                      >
                        {formatDistanceToNowStrict(new Date(c.last_message_at), {
                          locale: fr,
                          addSuffix: false,
                        })}
                      </time>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-sm",
                        unread > 0 ? "text-ink" : "text-muted"
                      )}
                    >
                      {sentByMe && <span className="text-muted">Vous : </span>}
                      {c.last_message_content}
                    </p>
                    {unread > 0 && (
                      <span className="tabular shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold leading-none text-ink">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
