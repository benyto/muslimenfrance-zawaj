import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "react-router";
import { SPECIAL_CATEGORY_CONSENT_TEXT, needsSpecialCategoryReconsent } from "@rencontre/shared";
import { useMyProfile } from "~/lib/queries/useMyProfile";
import { useAcceptSpecialCategoryConsent, useRemoveEthnicity } from "~/lib/queries/useConsent";
import { Button } from "~/components/ui/button";

// Shown once to members who agreed to an earlier consent wording and hold data
// it newly covers — their ethnicity. Until they choose, that field is simply
// not shown to other members (nothing is deleted). "Plus tard" closes it for
// this visit; it comes back next time.
export function ConsentRenewalDialog() {
  const { data: profile } = useMyProfile();
  const accept = useAcceptSpecialCategoryConsent();
  const remove = useRemoveEthnicity();
  const [later, setLater] = useState(false);

  const open = !!profile && !later && needsSpecialCategoryReconsent(profile);
  const error = (accept.error ?? remove.error) as Error | null;
  const busy = accept.isPending || remove.isPending;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && setLater(true)}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-fade fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content className="anim-rise fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-raised p-6 shadow-2xl">
          <Dialog.Title className="font-serif text-lg text-ink">Mise à jour de votre consentement</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted">
            Votre profil indique une origine ethnique. Cette information est une donnée sensible, que notre
            formulaire de consentement ne mentionnait pas jusqu&apos;ici. Tant que vous n&apos;avez pas confirmé, elle
            n&apos;est plus affichée aux autres membres.
          </Dialog.Description>

          <blockquote className="mt-4 rounded-xl bg-sunken p-4 text-sm leading-6 text-ink">
            {SPECIAL_CATEGORY_CONSENT_TEXT}
          </blockquote>
          <p className="mt-3 text-xs text-muted">
            Plus de détails dans notre{" "}
            <Link to="/confidentialite" target="_blank" className="underline underline-offset-2">
              politique de confidentialité
            </Link>
            .
          </p>

          {error && <p className="mt-4 text-sm text-danger">{error.message}</p>}

          <div className="mt-6 flex flex-col gap-2">
            <Button loading={accept.isPending} disabled={busy} onClick={() => accept.mutate()}>
              J&apos;accepte
            </Button>
            <Button variant="secondary" loading={remove.isPending} disabled={busy} onClick={() => remove.mutate()}>
              Retirer mon origine ethnique de mon profil
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setLater(true)}>
              Plus tard
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
