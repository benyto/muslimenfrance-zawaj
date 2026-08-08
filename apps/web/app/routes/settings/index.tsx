import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useIgnoredProfiles, useUnignoreProfile } from "~/lib/queries/useIgnoreActions";
import {
  useAvailableSubscriptionProduct,
  useMySubscription,
  useStartCheckout,
  useOpenBillingPortal,
} from "~/lib/queries/useSubscription";
import { useExportData, useDeleteAccount } from "~/lib/queries/useGdpr";
import {
  useMyProfile,
  useUpdatePresenceVisibility,
  useUpdateEmailNotificationPrefs,
} from "~/lib/queries/useMyProfile";
import { supabase } from "~/lib/supabase-client";
import { useTheme, type ThemePreference } from "~/lib/theme";
import { Card, Badge, Chip, Skeleton } from "~/components/ui/primitives";
import { Button } from "~/components/ui/button";
import { Checkbox, Field, Select } from "~/components/ui/form";
import { ConfirmDialog } from "~/components/ui/sheet";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-serif text-lg text-ink">{children}</h2>;
}

function IgnoredProfiles() {
  const { data: ignored, isLoading } = useIgnoredProfiles();
  const unignore = useUnignoreProfile();

  return (
    <Card className="p-6">
      <SectionHeading>Profils ignorés</SectionHeading>
      <p className="mb-4 text-sm text-muted">
        Qu&apos;ils aient été ignorés depuis un profil ou bloqués depuis une conversation, ces
        profils n&apos;apparaissent plus dans vos recherches et leurs messages ne vous notifient
        plus — sans qu&apos;ils en soient informés.
      </p>
      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      )}
      {!isLoading && ignored?.length === 0 && (
        <p className="text-sm text-muted">Vous n&apos;ignorez personne.</p>
      )}
      <ul className="flex flex-col gap-2">
        {ignored?.map((i) => (
          <li
            key={i.ignored_profile_id}
            className="flex items-center justify-between rounded-xl border border-line px-4 py-2"
          >
            <span className="text-sm text-ink">{i.nickname}</span>
            <button
              type="button"
              onClick={() => unignore.mutate(i.ignored_profile_id)}
              disabled={unignore.isPending}
              className="text-sm font-medium text-primary hover:underline disabled:opacity-60"
            >
              Ne plus ignorer
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const statusLabels: Record<string, { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  trialing: { label: "Période d'essai", tone: "warning" },
  active: { label: "Actif", tone: "success" },
  past_due: { label: "Paiement en retard", tone: "danger" },
  canceled: { label: "Annulé", tone: "neutral" },
};

function SubscriptionSection() {
  const [searchParams] = useSearchParams();
  const checkoutResult = searchParams.get("checkout");
  const { data: product, isLoading: productLoading } = useAvailableSubscriptionProduct();
  const { data: subscription, isLoading: subLoading } = useMySubscription();
  const startCheckout = useStartCheckout();
  const openPortal = useOpenBillingPortal();

  if (productLoading || subLoading) {
    return (
      <Card className="p-6">
        <SectionHeading>Abonnement</SectionHeading>
        <Skeleton className="h-6 w-40 rounded-full" />
      </Card>
    );
  }

  const isActive = subscription && ["trialing", "active"].includes(subscription.status);
  const status = subscription ? statusLabels[subscription.status] : null;

  return (
    <Card className="p-6">
      <SectionHeading>Abonnement</SectionHeading>

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
          {status && <Badge tone={status.tone}>{status.label}</Badge>}
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
            {((product.price_amount ?? 0) / 100).toFixed(2)} {product.currency.toUpperCase()} /{" "}
            {product.interval === "month" ? "mois" : product.interval}
            {product.trial_period_days > 0 && ` — ${product.trial_period_days} jours d'essai gratuit`}
          </p>
          {startCheckout.isError && (
            <p className="mb-2 text-sm text-danger">{(startCheckout.error as Error).message}</p>
          )}
          <Button onClick={() => startCheckout.mutate()} loading={startCheckout.isPending}>
            {startCheckout.isPending ? "Redirection..." : "S'abonner"}
          </Button>
        </div>
      )}

      {subscription && (
        <Button variant="secondary" className="mt-2" onClick={() => openPortal.mutate()} loading={openPortal.isPending}>
          {openPortal.isPending ? "Redirection..." : "Gérer mon abonnement"}
        </Button>
      )}
    </Card>
  );
}

function PrivacySection() {
  const navigate = useNavigate();
  const exportData = useExportData();
  const deleteAccount = useDeleteAccount();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function handleDelete() {
    deleteAccount.mutate(undefined, {
      onSuccess: async () => {
        await supabase.auth.signOut();
        navigate("/");
      },
    });
  }

  return (
    <Card className="p-6">
      <SectionHeading>Confidentialité et données</SectionHeading>

      <div className="flex flex-col gap-3">
        <div>
          <Button variant="secondary" onClick={() => exportData.mutate()} loading={exportData.isPending}>
            {exportData.isPending ? "Export en cours..." : "Exporter mes données"}
          </Button>
          {exportData.isError && (
            <p className="mt-2 text-sm text-danger">{(exportData.error as Error).message}</p>
          )}
        </div>

        <div>
          <Button
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteAccount.isPending}
          >
            {deleteAccount.isPending ? "Suppression..." : "Supprimer mon compte"}
          </Button>
          {deleteAccount.isError && (
            <p className="mt-2 text-sm text-danger">{(deleteAccount.error as Error).message}</p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Supprimer votre compte ?"
        description="Cette action est irréversible : votre profil, vos photos, vos conversations et toutes vos données seront définitivement supprimés."
        confirmLabel="Supprimer définitivement"
        destructive
        loading={deleteAccount.isPending}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          handleDelete();
        }}
      />
    </Card>
  );
}

function PresenceSection() {
  const { data: profile, isLoading } = useMyProfile();
  const updateVisibility = useUpdatePresenceVisibility();

  if (isLoading) {
    return (
      <Card className="p-6">
        <SectionHeading>Statut en ligne</SectionHeading>
        <Skeleton className="h-5 w-64" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <SectionHeading>Statut en ligne</SectionHeading>
      <Checkbox
        label="Afficher mon statut en ligne"
        checked={profile?.show_online_status ?? true}
        onChange={(e) => updateVisibility.mutate(e.target.checked)}
        disabled={updateVisibility.isPending}
      />
      <p className="mt-2 text-sm text-muted">
        Comme sur WhatsApp : si vous désactivez cette option, les autres membres ne verront plus quand
        vous êtes en ligne — mais vous ne verrez plus non plus leur statut à eux.
      </p>
      {updateVisibility.isError && (
        <p className="mt-2 text-sm text-danger">{(updateVisibility.error as Error).message}</p>
      )}
    </Card>
  );
}

const cooldownOptions = [
  { value: 0, label: "Immédiat (à chaque message)" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 heure" },
  { value: 180, label: "3 heures" },
  { value: 1440, label: "24 heures" },
];

function EmailNotificationsSection() {
  const { data: profile, isLoading } = useMyProfile();
  const updatePrefs = useUpdateEmailNotificationPrefs();

  if (isLoading) {
    return (
      <Card className="p-6">
        <SectionHeading>Notifications par email</SectionHeading>
        <Skeleton className="h-5 w-64" />
      </Card>
    );
  }

  const enabled = profile?.email_new_message_notifications ?? true;
  const cooldownMinutes = profile?.email_new_message_cooldown_minutes ?? 15;

  return (
    <Card className="p-6">
      <SectionHeading>Notifications par email</SectionHeading>
      <Checkbox
        label="Recevoir un email pour les nouveaux messages"
        checked={enabled}
        onChange={(e) => updatePrefs.mutate({ enabled: e.target.checked, cooldownMinutes })}
        disabled={updatePrefs.isPending}
      />
      {enabled && (
        <div className="mt-4">
          <Field label="Délai minimum entre deux emails, par conversation" full>
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={cooldownMinutes}
                onChange={(e) => updatePrefs.mutate({ enabled, cooldownMinutes: Number(e.target.value) })}
                disabled={updatePrefs.isPending}
              >
                {cooldownOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      )}
      <p className="mt-2 text-sm text-muted">
        Pour éviter de recevoir un email par message, l&apos;envoi est espacé d&apos;au moins ce délai
        pour chaque conversation.
      </p>
      {updatePrefs.isError && (
        <p className="mt-2 text-sm text-danger">{(updatePrefs.error as Error).message}</p>
      )}
    </Card>
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
      <SectionHeading>Apparence</SectionHeading>
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
      <PresenceSection />
      <EmailNotificationsSection />
      <SubscriptionSection />
      <IgnoredProfiles />
      <PrivacySection />
    </div>
  );
}
