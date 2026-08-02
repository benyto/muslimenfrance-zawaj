import { useBlockedProfiles, useUnblockProfile } from "~/lib/queries/useBlockActions";

function BlockedUsers() {
  const { data: blocked, isLoading } = useBlockedProfiles();
  const unblock = useUnblockProfile();

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-4 text-base font-semibold">Utilisateurs bloqués</h2>
      {isLoading && <p className="text-sm text-neutral-500">Chargement...</p>}
      {!isLoading && blocked?.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Vous n&apos;avez bloqué personne.</p>
      )}
      <ul className="flex flex-col gap-2">
        {blocked?.map((b) => (
          <li key={b.blocked_profile_id} className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-2 dark:border-neutral-800">
            <span className="text-sm">{b.nickname}</span>
            <button
              type="button"
              onClick={() => unblock.mutate(b.blocked_profile_id)}
              disabled={unblock.isPending}
              className="text-sm text-brand-rose-600 hover:underline disabled:opacity-60"
            >
              Débloquer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Settings() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Réglages</h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Abonnement (Stripe, Phase 6) et confidentialité arrivent bientôt.
        </p>
      </div>
      <BlockedUsers />
    </div>
  );
}
