// Who is behind the service, as the legal pages (CGU, politique de
// confidentialité, mentions légales) must state it.
//
// EVERY `null` BELOW MUST BE FILLED IN BEFORE LAUNCH. Until then the pages show
// the missing item as a highlighted "[… — à compléter]" so it can't be missed.
// These are facts only you have (company details, host, contact address); they
// are deliberately not guessed.
//
// The texts around them are a working draft written from what the app actually
// does — a lawyer should review them before they are relied on.
import { TERMS_VERSION } from "@rencontre/shared";

export const legal = {
  /**
   * Shown at the top of each page. Derived from TERMS_VERSION (packages/shared),
   * which is also recorded with each subscription as proof of what was agreed —
   * bump that constant when the terms or the privacy policy change materially.
   */
  lastUpdated: new Date(`${TERMS_VERSION}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }),

  publisher: {
    /** Raison sociale (or full name for an individual). */
    name: null as string | null,
    /** e.g. "SAS", "SARL", "Association loi 1901", "Entrepreneur individuel". */
    legalForm: null as string | null,
    /** Only for companies with a share capital, e.g. "1 000 €". Leave null otherwise. */
    shareCapital: null as string | null,
    /** SIREN/SIRET and RCS city (or RNA number for an association). */
    registration: null as string | null,
    /** Numéro de TVA intracommunautaire, if any. */
    vatNumber: null as string | null,
    /** Siège social. */
    address: null as string | null,
    directorOfPublication: null as string | null,
  },

  /** The address members write to — also used for data-protection requests. */
  contactEmail: null as string | null,

  /** Where the web app and API are hosted (not decided yet). */
  host: {
    name: null as string | null,
    address: null as string | null,
    phone: null as string | null,
  },

  /** Region of the Supabase project (database, authentication, photo storage). */
  databaseRegion: null as string | null,

  /** Médiateur de la consommation — mandatory for consumer sales in France. */
  mediator: {
    name: null as string | null,
    website: null as string | null,
  },
};
