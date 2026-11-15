import { z } from "zod";

// Which text the member agreed to. Recorded with every subscription as proof of
// what they were shown (see subscription_consents).
//
//  - TERMS_VERSION: date of the terms of use / privacy policy in force. Also
//    the "Dernière mise à jour" shown on the legal pages. Bump it when those
//    texts change materially.
//  - CHECKOUT_WORDING_VERSION: the two checkboxes and the notice shown at
//    checkout. Bump it when that wording changes.
export const TERMS_VERSION = "2026-11-15";
export const CHECKOUT_WORDING_VERSION = "2026-11-15";

// Both must be an explicit, positive choice. A consumer who subscribes online
// is entitled to 14 days to withdraw; starting the service within that period
// needs their express request, and they must be told they pay for what has
// been provided if they do withdraw. Never pre-ticked, never implied.
export const checkoutConsentSchema = z.object({
  acceptTerms: z.literal(true, {
    error: "Vous devez accepter les conditions d’utilisation pour vous abonner",
  }),
  waiveWithdrawal: z.literal(true, {
    error: "Vous devez demander l’exécution immédiate de l’abonnement pour continuer",
  }),
});

export type CheckoutConsent = z.infer<typeof checkoutConsentSchema>;
