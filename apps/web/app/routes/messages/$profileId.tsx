import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Check, CheckCheck, SendHorizontal } from "lucide-react";
import { useMyProfile } from "~/lib/queries/useMyProfile";
import { useProfileDetail } from "~/lib/queries/useProfileDetail";
import { useConversationWithProfile } from "~/lib/queries/useConversations";
import { useConversationMessages } from "~/lib/queries/useConversationMessages";
import { useSendMessage } from "~/lib/queries/useSendMessage";
import { useMarkAsRead } from "~/lib/queries/useMarkAsRead";
import { useTypingIndicator } from "~/lib/realtime/useTypingIndicator";
import { photoUrl } from "~/lib/queries/usePhotos";
import { cn } from "~/lib/cn";
import { Avatar, Divider, EmptyState, Skeleton } from "~/components/ui/primitives";

import { StarSpinner } from "~/components/ui/star";

const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFormatter = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Aujourd'hui";
  if (sameDay(date, yesterday)) return "Hier";
  return dayFormatter.format(date);
}

export default function ChatWithProfile() {
  const { profileId: otherProfileId } = useParams();
  const { data: myProfile } = useMyProfile();
  const { data: otherProfile } = useProfileDetail(otherProfileId);
  const { data: conversationId, isLoading: conversationLoading } = useConversationWithProfile(
    myProfile?.id,
    otherProfileId
  );

  const { data: messages, isLoading: messagesLoading } = useConversationMessages(conversationId);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const { otherIsTyping, notifyTyping } = useTypingIndicator(conversationId, myProfile?.id);

  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  // Only auto-scroll when the reader is already at the bottom, so arriving
  // messages never yank someone who has scrolled up to read history.
  function handleScroll() {
    const el = threadRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  useEffect(() => {
    if (!pinnedRef.current) return;
    // `block: "nearest"` keeps this inside the thread's own scroller — the
    // previous default of "start" also scrolled the document, dragging the
    // composer and header around on every new message.
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages?.length, otherIsTyping]);

  useEffect(() => {
    if (conversationId && myProfile?.id) {
      markAsRead.mutate({ conversationId, myProfileId: myProfile.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, myProfile?.id, messages?.length]);

  function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !otherProfileId) return;
    pinnedRef.current = true;
    sendMessage.mutate({ recipientProfileId: otherProfileId, content }, { onSuccess: () => setDraft("") });
  }

  const sendError = sendMessage.error as Error | null;
  const subscriptionRequired = sendError?.message?.includes("abonnement");
  const loading = conversationLoading || messagesLoading;

  return (
    // One bounded pane at every size: the thread scrolls inside it and the
    // composer sits on its bottom edge, so the composer is pinned even in a
    // near-empty conversation. --pane-h is viewport minus the app chrome, and
    // AppShell hides the mobile tab bar on this route so the composer owns
    // the bottom. The old `h-[calc(100dvh-8rem)]` guessed chrome at 128px
    // when it was really 172px, leaving the document taller than the viewport
    // — which is exactly why the composer used to scroll away.
    // Deliberately no width cap on the pane itself — a fixed max-width here
    // just left a permanently dead void between the thread and the profile
    // panel on wide screens (not fluid: it didn't shrink or grow with
    // anything, it just sat there empty). Header and composer fill
    // whatever width the workspace's center column gives them, same as any
    // chat app; the bubbles below already cap themselves at 80% so reading
    // width stays sane regardless of pane width.
    <div className="flex h-[var(--pane-h)] flex-col">
      <header className="flex items-center gap-3 border-b border-line pb-3">
        {/* Mobile needed a way back — the only route out of a conversation
            used to be the tab bar, which this route now hides. */}
        <Link
          to="/messages"
          aria-label="Retour aux conversations"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>

        <Link
          to={`/profile/${otherProfileId}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl"
        >
          <Avatar
            src={otherProfile?.photo_keys?.[0] ? photoUrl(otherProfile.photo_keys[0]) : null}
            name={otherProfile?.nickname ?? "?"}
            size="md"
          />
          {otherProfile?.nickname ? (
            <span className="block min-w-0 truncate font-serif text-xl text-ink">
              {otherProfile.nickname}
            </span>
          ) : (
            <Skeleton className="h-5 w-28" />
          )}
        </Link>
      </header>

      <div
        ref={threadRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-4 lg:min-h-0"
      >
        {loading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-40 self-start rounded-2xl" />
            <Skeleton className="h-9 w-52 self-end rounded-2xl" />
            <Skeleton className="h-9 w-32 self-start rounded-2xl" />
          </div>
        )}

        {!loading && (!messages || messages.length === 0) && (
          <EmptyState
            title={`Dites bonjour à ${otherProfile?.nickname ?? "ce membre"}`}
            description="Un premier message simple et sincère fonctionne toujours mieux qu'une formule toute faite."
          />
        )}

        <div className="flex flex-col gap-1">
          {messages?.map((m, index) => {
            const isMine = m.sender_profile_id === myProfile?.id;
            const previous = index > 0 ? messages[index - 1] : null;
            const next = index < messages.length - 1 ? messages[index + 1] : null;

            const newDay =
              !previous ||
              new Date(previous.created_at).toDateString() !==
                new Date(m.created_at).toDateString();
            // Group runs from the same sender: only the last bubble in a run
            // gets a squared corner and shows its timestamp.
            const sameAsNext =
              next && next.sender_profile_id === m.sender_profile_id && !newDay;
            const startsRun = !previous || previous.sender_profile_id !== m.sender_profile_id || newDay;

            return (
              <div key={m.id} className="contents">
                {newDay && (
                  <Divider label={dayLabel(m.created_at)} star className="my-4" />
                )}
                <div
                  className={cn(
                    "flex max-w-[80%] flex-col gap-0.5",
                    isMine ? "items-end self-end" : "items-start self-start",
                    startsRun ? "mt-2" : "mt-0"
                  )}
                >
                  <div
                    className={cn(
                      // whitespace-pre-wrap + break-words: long URLs and
                      // multi-line messages previously broke the layout.
                      "whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm",
                      isMine
                        ? "bg-primary text-on-primary"
                        : "border border-line bg-raised text-ink",
                      isMine
                        ? sameAsNext
                          ? "rounded-br-md"
                          : "rounded-br-sm"
                        : sameAsNext
                          ? "rounded-bl-md"
                          : "rounded-bl-sm"
                    )}
                  >
                    {m.content}
                  </div>
                  {!sameAsNext && (
                    <span className="tabular flex items-center gap-1 px-1 font-mono text-[10px] text-muted">
                      {timeFormatter.format(new Date(m.created_at))}
                      {isMine &&
                        (m.is_read ? (
                          <CheckCheck className="h-3 w-3 text-primary" aria-label="Lu" />
                        ) : (
                          <Check className="h-3 w-3" aria-label="Envoyé" />
                        ))}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {otherIsTyping && (
            <div
              aria-live="polite"
              className="mt-2 flex w-fit items-center gap-1 self-start rounded-2xl border border-line bg-raised px-4 py-3"
            >
              <span className="sr-only">{otherProfile?.nickname} est en train d'écrire</span>
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
                  style={{ animationDelay: `${delay}ms` }}
                  aria-hidden="true"
                />
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {subscriptionRequired && (
        <p className="mb-2 rounded-xl bg-warning-soft p-3 text-sm text-warning">
          Un abonnement actif est requis pour envoyer des messages.
        </p>
      )}
      {sendError && !subscriptionRequired && (
        <p className="mb-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          Votre message n'a pas pu être envoyé. Réessayez.
        </p>
      )}

      {/* sticky bottom-0 is what actually pins the composer. The old layout
          guessed a height (100dvh-8rem) that left the document ~44px taller
          than the viewport, so the composer simply scrolled away. */}
      <form
        onSubmit={handleSend}
        className="sticky bottom-0 flex gap-2 border-t border-line bg-surface/95 pt-3 backdrop-blur"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <label htmlFor="chat-composer" className="sr-only">
          Votre message
        </label>
        <input
          id="chat-composer"
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            notifyTyping();
          }}
          placeholder="Votre message…"
          maxLength={1000}
          autoComplete="off"
          enterKeyHint="send"
          className="min-h-11 flex-1 rounded-xl border border-line-strong bg-raised px-4 text-sm text-ink placeholder:text-muted/70"
        />
        <button
          type="submit"
          disabled={sendMessage.isPending || !draft.trim()}
          aria-label="Envoyer le message"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-55"
        >
          {sendMessage.isPending ? (
            <StarSpinner className="h-4 w-4 text-current" />
          ) : (
            <SendHorizontal className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </form>
    </div>
  );
}
