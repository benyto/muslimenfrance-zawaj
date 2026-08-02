import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useMyProfile } from "~/lib/queries/useMyProfile";
import { useProfileDetail } from "~/lib/queries/useProfileDetail";
import { useConversationWithProfile } from "~/lib/queries/useConversations";
import { useConversationMessages } from "~/lib/queries/useConversationMessages";
import { useSendMessage } from "~/lib/queries/useSendMessage";
import { useMarkAsRead } from "~/lib/queries/useMarkAsRead";
import { useTypingIndicator } from "~/lib/realtime/useTypingIndicator";
import { photoUrl } from "~/lib/queries/usePhotos";

export default function ChatWithProfile() {
  const { profileId: otherProfileId } = useParams();
  const { data: myProfile } = useMyProfile();
  const { data: otherProfile } = useProfileDetail(otherProfileId);
  const { data: conversationId } = useConversationWithProfile(myProfile?.id, otherProfileId);

  const { data: messages } = useConversationMessages(conversationId);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const { otherIsTyping, notifyTyping } = useTypingIndicator(conversationId, myProfile?.id);

  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

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
    sendMessage.mutate(
      { recipientProfileId: otherProfileId, content },
      { onSuccess: () => setDraft("") }
    );
  }

  const sendError = sendMessage.error as Error | null;
  const subscriptionRequired = sendError?.message?.includes("abonnement");

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col sm:h-[70dvh]">
      <div className="flex items-center gap-3 border-b border-neutral-100 pb-3 dark:border-neutral-800">
        <Link to={`/profile/${otherProfileId}`} className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            {otherProfile?.photo_keys?.[0] && (
              <img src={photoUrl(otherProfile.photo_keys[0])} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div>
            <p className="font-medium">{otherProfile?.nickname}</p>
            {otherIsTyping && <p className="text-xs text-brand-rose-500">est en train d&apos;écrire...</p>}
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="flex flex-col gap-2">
          {messages?.map((m) => {
            const isMine = m.sender_profile_id === myProfile?.id;
            return (
              <div
                key={m.id}
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  isMine
                    ? "self-end bg-gradient-to-r from-brand-rose-500 to-brand-purple-500 text-white"
                    : "self-start bg-neutral-100 dark:bg-neutral-800"
                }`}
              >
                {m.content}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        {conversationId === null && (!messages || messages.length === 0) && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Envoyez le premier message à {otherProfile?.nickname}.
          </p>
        )}
      </div>

      {subscriptionRequired && (
        <p className="mb-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          Un abonnement actif est requis pour envoyer des messages.
        </p>
      )}
      {sendError && !subscriptionRequired && (
        <p className="mb-2 text-sm text-red-600">{sendError.message}</p>
      )}

      <form onSubmit={handleSend} className="flex gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            notifyTyping();
          }}
          placeholder="Votre message..."
          maxLength={1000}
          className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand-rose-500 dark:border-neutral-800 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={sendMessage.isPending || !draft.trim()}
          className="rounded-xl bg-gradient-to-r from-brand-rose-500 to-brand-purple-500 px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
