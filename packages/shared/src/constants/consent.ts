// Consent for special-category data (GDPR art. 9) on a member's profile.
//
// The wording below is what a member ticks, and SPECIAL_CATEGORY_CONSENT_VERSION
// is recorded when they do (profiles.special_category_consent_version, set by
// the database function record_special_category_consent — never by the browser).
//
// Change the text materially → bump the version, and update the same date in
// the migration's get_profile_detail rule (ethnicity is only shown to members
// whose recorded version is at least that date), so members are asked again.
// Keep the privacy policy's article 3 in step with this wording.
export const SPECIAL_CATEGORY_CONSENT_VERSION = "2026-11-15";

export const SPECIAL_CATEGORY_CONSENT_TEXT =
  "J’accepte que les données relatives à ma religion, à mon niveau de pratique religieuse et à mon origine ethnique, " +
  "que je choisis de renseigner, soient collectées et utilisées pour mon profil de rencontre et visibles des autres membres " +
  "dont le profil est validé (données sensibles au sens du RGPD). Je peux retirer ce consentement à tout moment en " +
  "effaçant ces informations de mon profil ou en supprimant mon compte.";

type ConsentFields = {
  special_category_consent: boolean;
  special_category_consent_version: string | null;
  ethnicity: string | null;
};

/** The member has accepted the current wording. */
export function hasCurrentSpecialCategoryConsent(profile: Pick<ConsentFields, "special_category_consent" | "special_category_consent_version">) {
  return (
    profile.special_category_consent &&
    profile.special_category_consent_version !== null &&
    profile.special_category_consent_version >= SPECIAL_CATEGORY_CONSENT_VERSION
  );
}

/**
 * Whether to ask an existing member to confirm the current wording: they
 * consented under an earlier one, and they hold data it newly covers
 * (ethnicity). Someone with no ethnicity on file has nothing to confirm — the
 * form asks them if they ever add one.
 */
export function needsSpecialCategoryReconsent(profile: ConsentFields) {
  return profile.special_category_consent && !hasCurrentSpecialCategoryConsent(profile) && !!profile.ethnicity?.trim();
}
