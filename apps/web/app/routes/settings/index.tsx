import { useSearchParams } from "react-router";
import { useBlockedProfiles, useUnblockProfile } from "~/lib/queries/useBlockActions";
import {
  useAvailableSubscriptionProduct,
  useMySubscription,
  useStartCheckout,
  useOpenBillingPortal,
} from "~/lib/queries/useSubscription";

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

const statusLabels: Record<string, { label: string; className: string }> = {
  trialing: { label: "Période d'essai", className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  active: { label: "Actif", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  past_due: { label: "Paiement en retard", className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400" },
  canceled: { label: "Annulé", className: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" },
};

function SubscriptionSection() {
  const [searchParams] = useSearchParams();
  const checkoutResult = searchParams.get("checkout");
  const { data: product, isLoading: productLoading } = useAvailableSubscriptionProduct();
  const { data: subscription, isLoading: subLoading } = useMySubscription();
  const startCheckout = useStartCheckout();
  const openPortal = useOpenBillingPortal();

  if (productLoading || subLoading) return null;

  const isActive = subscription && ["trialing", "active"].includes(subscription.status);
  const status = subscription ? statusLabels[subscription.status] : null;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-4 text-base font-semibold">Abonnement</h2>

      {checkoutResult === "success" && (
        <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          Merci ! Votre abonnement est en cours d&apos;activation.
        </p>
      )}
      {checkoutResult === "cancelled" && (
        <p className="mb-4 rounded-xl bg-neutral-100 p-3 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          Abonnement annulé.
        </p>
      )}

      {subscription && (
        <div className="mb-4 flex items-center gap-3">
          {status && <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>}
          {subscription.current_period_end && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {subscription.cancel_at_period_end ? "Se termine le " : "Renouvellement le "}
              {new Date(subscription.current_period_end).toLocaleDateString("fr-FR")}
            </span>
          )}
        </div>
      )}

      {!subscription && !product && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          L&apos;application est actuellement gratuite — aucun abonnement n&apos;est requis.
        </p>
      )}

      {!isActive && product && (
        <div>
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            {((product.price_amount ?? 0) / 100).toFixed(2)} {product.currency.toUpperCase()} / {product.interval === "month" ? "mois" : product.interval}
            {product.trial_period_days > 0 && ` — ${product.trial_period_days} jours d'essai gratuit`}
          </p>
          {startCheckout.isError && <p className="mb-2 text-sm text-red-600">{(startCheckout.error as Error).message}</p>}
          <button
            type="button"
            onClick={() => startCheckout.mutate()}
            disabled={startCheckout.isPending}
            className="rounded-xl bg-gradient-to-r from-brand-rose-500 to-brand-purple-500 px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {startCheckout.isPending ? "Redirection..." : "S'abonner"}
          </button>
        </div>
      )}

      {subscription && (
        <button
          type="button"
          onClick={() => openPortal.mutate()}
          disabled={openPortal.isPending}
          className="mt-2 rounded-xl border border-neutral-200 px-5 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-800 dark:hover:bg-neutral-800"
        >
          {openPortal.isPending ? "Redirection..." : "Gérer mon abonnement"}
        </button>
      )}
    </div>
  );
}

export default function Settings() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Réglages</h1>
      </div>
      <SubscriptionSection />
      <BlockedUsers />
    </div>
  );
}
