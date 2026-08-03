import { useNavigate, useSearchParams } from "react-router";
import { useBlockedProfiles, useUnblockProfile } from "~/lib/queries/useBlockActions";
import {
  useAvailableSubscriptionProduct,
  useMySubscription,
  useStartCheckout,
  useOpenBillingPortal,
} from "~/lib/queries/useSubscription";
import { useExportData, useDeleteAccount } from "~/lib/queries/useGdpr";
import { supabase } from "~/lib/supabase-client";
import { useTheme, type ThemePreference } from "~/lib/theme";
import { Card } from "~/components/ui/primitives";
import { Chip } from "~/components/ui/primitives";

function BlockedUsers() {
  const { data: blocked, isLoading } = useBlockedProfiles();
  const unblock = useUnblockProfile();

  return (
    <div className="rounded-2xl border border-line bg-raised p-6">
      <h2 className="mb-4 text-base font-semibold">Utilisateurs bloqués</h2>
      {isLoading && <p className="text-sm text-muted">Chargement...</p>}
      {!isLoading && blocked?.length === 0 && (
        <p className="text-sm text-muted">Vous n&apos;avez bloqué personne.</p>
      )}
      <ul className="flex flex-col gap-2">
        {blocked?.map((b) => (
          <li key={b.blocked_profile_id} className="flex items-center justify-between rounded-xl border border-line px-4 py-2">
            <span className="text-sm">{b.nickname}</span>
            <button
              type="button"
              onClick={() => unblock.mutate(b.blocked_profile_id)}
              disabled={unblock.isPending}
              className="text-sm text-primary hover:underline disabled:opacity-60"
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
  trialing: { label: "Période d'essai", className: "bg-warning-soft text-warning" },
  active: { label: "Actif", className: "bg-success-soft text-success" },
  past_due: { label: "Paiement en retard", className: "bg-danger-soft text-danger" },
  canceled: { label: "Annulé", className: "bg-sunken text-muted" },
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
    <div className="rounded-2xl border border-line bg-raised p-6">
      <h2 className="mb-4 text-base font-semibold">Abonnement</h2>

      {checkoutResult === "success" && (
        <p className="mb-4 rounded-xl bg-success-soft p-3 text-sm text-success">
          Merci ! Votre abonnement est en cours d&apos;activation.
        </p>
      )}
      {checkoutResult === "cancelled" && (
        <p className="mb-4 rounded-xl bg-sunken p-3 text-sm text-muted">
          Abonnement annulé.
        </p>
      )}

      {subscription && (
        <div className="mb-4 flex items-center gap-3">
          {status && <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>}
          {subscription.current_period_end && (
            <span className="text-sm text-muted">
              {subscription.cancel_at_period_end ? "Se termine le " : "Renouvellement le "}
              {new Date(subscription.current_period_end).toLocaleDateString("fr-FR")}
            </span>
          )}
        </div>
      )}

      {!subscription && !product && (
        <p className="text-sm text-muted">
          L&apos;application est actuellement gratuite — aucun abonnement n&apos;est requis.
        </p>
      )}

      {!isActive && product && (
        <div>
          <p className="mb-3 text-sm text-muted">
            {((product.price_amount ?? 0) / 100).toFixed(2)} {product.currency.toUpperCase()} / {product.interval === "month" ? "mois" : product.interval}
            {product.trial_period_days > 0 && ` — ${product.trial_period_days} jours d'essai gratuit`}
          </p>
          {startCheckout.isError && <p className="mb-2 text-sm text-danger">{(startCheckout.error as Error).message}</p>}
          <button
            type="button"
            onClick={() => startCheckout.mutate()}
            disabled={startCheckout.isPending}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
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
          className="mt-2 rounded-xl border border-line px-5 py-2 text-sm font-medium hover:bg-sunken disabled:opacity-60 dark:hover:bg-sunken"
        >
          {openPortal.isPending ? "Redirection..." : "Gérer mon abonnement"}
        </button>
      )}
    </div>
  );
}

function PrivacySection() {
  const navigate = useNavigate();
  const exportData = useExportData();
  const deleteAccount = useDeleteAccount();

  async function handleDelete() {
    if (!confirm("Supprimer définitivement votre compte et toutes vos données ? Cette action est irréversible.")) {
      return;
    }
    deleteAccount.mutate(undefined, {
      onSuccess: async () => {
        await supabase.auth.signOut();
        navigate("/");
      },
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-raised p-6">
      <h2 className="mb-4 text-base font-semibold">Confidentialité et données</h2>

      <div className="flex flex-col gap-3">
        <div>
          <button
            type="button"
            onClick={() => exportData.mutate()}
            disabled={exportData.isPending}
            className="rounded-xl border border-line px-5 py-2 text-sm font-medium hover:bg-sunken disabled:opacity-60 dark:hover:bg-sunken"
          >
            {exportData.isPending ? "Export en cours..." : "Exporter mes données"}
          </button>
          {exportData.isError && (
            <p className="mt-2 text-sm text-danger">{(exportData.error as Error).message}</p>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteAccount.isPending}
            className="rounded-xl border border-danger px-5 py-2 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60 dark:border-red-900 dark:hover:bg-danger-soft"
          >
            {deleteAccount.isPending ? "Suppression..." : "Supprimer mon compte"}
          </button>
          {deleteAccount.isError && (
            <p className="mt-2 text-sm text-danger">{(deleteAccount.error as Error).message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
  { value: "system", label: "Système" },
];

function AppearanceSection() {
  const { preference, setPreference } = useTheme();

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-serif text-lg text-ink">Apparence</h2>
      <p className="mb-4 text-sm text-muted">
        « Système » suit le réglage de votre appareil.
      </p>
      <div className="flex flex-wrap gap-2">
        {themeOptions.map((option) => (
          <Chip
            key={option.value}
            selected={preference === option.value}
            onClick={() => setPreference(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
    </Card>
  );
}

export default function Settings() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Réglages</h1>
      </div>
      <AppearanceSection />
      <SubscriptionSection />
      <BlockedUsers />
      <PrivacySection />
    </div>
  );
}
