import { Link } from "react-router";
import { useConversations } from "~/lib/queries/useConversations";
import { useMyProfile } from "~/lib/queries/useMyProfile";
import { useInboxSubscription } from "~/lib/realtime/useInboxSubscription";
import { photoUrl } from "~/lib/queries/usePhotos";

export default function Messages() {
  const { data: myProfile } = useMyProfile();
  useInboxSubscription(myProfile?.id);
  const { data: conversations, isLoading } = useConversations();

  if (isLoading) return null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Messages</h1>

      {(!conversations || conversations.length === 0) && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Aucune conversation pour l&apos;instant. Démarrez une discussion depuis un profil dans{" "}
          <Link to="/discover" className="underline">
            Découvrir
          </Link>
          .
        </p>
      )}

      <ul className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
        {conversations?.map((c) => (
          <li key={c.conversation_id}>
            <Link to={`/messages/${c.other_profile_id}`} className="flex items-center gap-3 py-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                {c.other_photo_key && (
                  <img src={photoUrl(c.other_photo_key)} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{c.other_nickname}</p>
                  {c.unread_count > 0 && (
                    <span className="shrink-0 rounded-full bg-brand-rose-500 px-2 py-0.5 text-xs text-white">
                      {c.unread_count}
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">{c.last_message_content}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
