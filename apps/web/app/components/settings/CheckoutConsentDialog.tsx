import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/form";

// The two explicit choices a consumer must make before paying (see
// checkoutConsentSchema in packages/shared, which the API enforces — this
// dialog is only how a member makes them). Both start unticked and nothing
// proceeds until both are ticked. If this wording changes, bump
// CHECKOUT_WORDING_VERSION in packages/shared and update the notice the API
// sends to Stripe (CHECKOUT_NOTICE in apps/api/src/routes/stripe.ts).
export function CheckoutConsentDialog({
  open,
  onOpenChange,
  priceSummary,
  loading,
  errorMessage,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceSummary: string;
  loading: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
}) {
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [waiveWithdrawal, setWaiveWithdrawal] = useState(false);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        // Always come back unticked: consent is given each time, not remembered.
        if (!next) {
          setAcceptTerms(false);
          setWaiveWithdrawal(false);
        }
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="anim-fade fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content className="anim-rise fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-raised p-6 shadow-2xl">
          <Dialog.Title className="font-serif text-lg text-ink">Avant de vous abonner</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted">
            {priceSummary}. Résiliable à tout moment depuis « Réglages » ; l&apos;abonnement se renouvelle
            automatiquement jusqu&apos;à sa résiliation.
          </Dialog.Description>

          <div className="mt-5 flex flex-col gap-4">
            <Checkbox
              checked={acceptTerms}
              onChange={(event) => setAcceptTerms(event.target.checked)}
              label={
                <>
                  J&apos;ai lu et j&apos;accepte les{" "}
                  <Link to="/cgu" target="_blank" className="underline underline-offset-2">
                    conditions d&apos;utilisation
                  </Link>{" "}
                  et la{" "}
                  <Link to="/confidentialite" target="_blank" className="underline underline-offset-2">
                    politique de confidentialité
                  </Link>
                  .
                </>
              }
            />
            <Checkbox
              checked={waiveWithdrawal}
              onChange={(event) => setWaiveWithdrawal(event.target.checked)}
              label="Je demande expressément que mon abonnement commence immédiatement, avant la fin du délai de rétractation de 14 jours. Je reconnais que, si je me rétracte, je devrai payer le service déjà fourni jusqu’à ma demande."
            />
          </div>

          {errorMessage && <p className="mt-4 text-sm text-danger">{errorMessage}</p>}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button variant="secondary">Annuler</Button>
            </Dialog.Close>
            <Button disabled={!acceptTerms || !waiveWithdrawal} loading={loading} onClick={onConfirm}>
              {loading ? "Redirection..." : "Continuer vers le paiement"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
