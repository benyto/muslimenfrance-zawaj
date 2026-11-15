# Project status — Rencontre (zawaj.muslimenfrance.com)

A standalone dating/matrimonial SPA extracted from the `muslimenfrance`
monolith: own Supabase project, own schema, own UI/admin, own backend,
Supabase Realtime messaging, Supabase Storage photos, Resend email, Stripe
subscriptions with a trial period. Branded "zawaj" for members, "Rencontre"
internally.

This file is a snapshot of what's built and what's left — read it before
picking work back up after a break. For the full original architecture
rationale and decision log, see the plan file the project was built from.

## Stack

| Piece | Choice |
|---|---|
| Frontend | Vite + React Router 8, SPA mode (`ssr: false`), TypeScript, Tailwind CSS 4 |
| Backend | Node.js + Fastify (`apps/api`), self-hosted — not Supabase Edge Functions |
| Database | Supabase Postgres, RLS everywhere, migrations in `supabase/migrations` |
| Shared | `packages/shared` — Zod schemas + generated DB types, used by both apps |
| Auth | Magic link / email OTP only, no passwords |
| Photos | Supabase Storage (private bucket, signed URLs) |
| Payments | Stripe (checkout, portal, webhooks, trial period) |
| Email | Resend |
| Realtime | Supabase Realtime (`postgres_changes` + Presence) |

## What's built

### Core product (Phases 0–10 — done)

- **Auth**: magic-link sign-in, session in `localStorage`, `RequireAuth` /
  `RequireAdmin` route guards (UX-only — every privileged action is
  re-checked server-side against `user_roles`).
- **Profiles**: full CRUD form (27 fields incl. bio, looking-for, origin
  country), GDPR Art. 9 consent capture, moderation workflow
  (pending/approved/rejected/disabled).
- **Photos**: upload through the API into a private Supabase Storage bucket, moderation queue, reordering.
- **Private photos**: each photo is public or private
  (`profile_photos.visibility`, chosen with the Publique/Privée switch under
  each photo in PhotoManager). New uploads default to **private** — an
  upload is committed immediately, independent of the profile form's Save,
  so a public default would go live on approval before the owner chose.
  Access is per member, not per photo: a viewer asks from the locked tile
  on a profile ("Demander l'accès"), the owner answers from /profile/me
  (`PhotoAccessManager`, with a count badge on the "Profil" nav item) or
  grants proactively from the chat header. Stored in `photo_access`
  (pending/granted/denied — a decline or revoke is silent, the viewer keeps
  seeing "demande envoyée"), written only through the `request_photo_access`
  / `set_photo_access` RPCs. Enforced where keys are handed out:
  `get_profile_detail`, `search_profiles`, `get_my_conversations` and
  `get_my_favorites` omit private keys unless the caller holds a grant
  (`can_view_private_photos`). Since the move to Supabase Storage the bucket
  itself enforces it too (see "Photo storage" below): an image can only be
  shown with a signed URL, and Storage signs only what the caller may read.
- **Discovery**: filtered browse (`search_profiles` RPC), URL-driven filter
  state, report/ignore.
- **Messaging**: 1:1 conversations, Supabase Realtime delivery, typing
  presence, read receipts, unread counts, inbox-wide new-message toasts.
- **Favorites**: bookmark a profile, tabbed sidebar (Contacts / Favoris).
- **Ignore/Block**: one single one-directional mechanism (`profile_ignores`
  table + `is_profile_ignored()`/`get_my_ignored_profiles()`), exposed
  under two labels depending on where it's triggered — "Ignorer" (no
  confirm) on ProfileDetailPanel, "Bloquer" (with a ConfirmDialog, since
  cutting someone off mid-conversation carries more weight) at the top of
  an open chat. Either way the effect is identical: the profile drops out
  of the actor's own `search_profiles` results and `get_my_conversations`,
  and its messages no longer trigger the inbox toast
  (`useInboxSubscription` checks a client-side ignored-ids ref) — but the
  other party is never told, still sees the actor normally, and can still
  send (the message is written like any other, just invisible to the
  ignorer by default). Managed from Settings' "Profils ignorés" list.
  Deliberately replaced an earlier *mutual* block (`user_blocks`/
  `is_profile_blocked`, retired in
  `20260808130000_retire_mutual_block.sql`) that hid both parties from
  each other and rejected messages outright in both directions — an
  explicit product decision, not a regression: the one-directional model
  covers "I don't want to see/hear from this person" without needing two
  separate mechanisms.
- **Presence**: WhatsApp-style online/offline badges (green/grey/none), via
  a `last_seen_at` heartbeat (`useLastSeenHeartbeat`, ~60s while the tab is
  visible) rather than a realtime channel — a global Presence channel's
  join/leave/sync fan-out bills per-subscriber-per-event on Supabase, so
  cost scales with concurrent users × churn; a plain timestamp column has
  none of that. "Online" is just "seen in the last 2 minutes"
  (`usePresenceStatus`). Reciprocity (off ⇒ you neither show nor see) is
  enforced server-side in `get_my_conversations`/`get_my_favorites`/
  `get_profile_detail`, which null out the timestamp unless both sides have
  it on. Toggle lives in Settings (`profiles.show_online_status`).
- **Stripe**: checkout, billing portal, webhook handling with idempotency,
  trial period. Currently **free-launch mode** — no `subscription_products`
  row is `enabled`, so messaging is free for everyone until pricing is
  turned on (flip `enabled` in `/admin/subscriptions`, no redeploy needed).
- **Email**: Resend templates for new-message, subscription lifecycle,
  moderation outcomes, reports. New-message notifications are per-profile
  configurable in Settings — opt-in toggle plus a cooldown (Immédiat/15min/
  30min/1h/3h/24h) per conversation, replacing the old hardcoded 15-minute
  cooldown (`profiles.email_new_message_notifications` /
  `email_new_message_cooldown_minutes`, read server-side in
  `apps/api/src/routes/messages.ts`).
- **Admin**: dedicated dashboard (see below).
- **Geography**: full INSEE `communes_fr` dataset (~35k rows) replacing the
  original 5-row `cities` table, with region/department filtering and
  trigram-indexed typeahead search.
- **Data migration**: monolith's real dating data (23 profiles, 35 photos,
  3 conversations, 46 messages) migrated in; scripts in
  `scripts/migration/`.

### Security hardening (Phase 9 — done)

Found and fixed via live exploit scripts against two real accounts, not
just policy review:

- Message tampering (either participant could rewrite/forge any message via
  a blanket `UPDATE` grant) — fixed with column-level grants.
- `profile_photos` moderation-lock policy was self-referential and silently
  never enforced — fixed, also closed a photo-swap bypass in the same pass.
- Rate limiting redesigned into two layers (per-IP at `onRequest`, per-user
  keyed off a *verified* JWT after `requireAuth` — the original design keyed
  on an unverified token, which let an attacker mint unlimited buckets).
- `requireAdminOnly` added — moderators could previously change subscription
  pricing, same access as admins.
- GDPR export/delete, cross-tenant RLS re-verified with real non-admin
  accounts.

### Visual redesign — "Zellige" direction (done, member-facing)

Full design pass: WCAG-AA-verified token system (light + dark), real dark
mode (previously dead code — a `.dark` class strategy nothing ever applied),
Instrument Serif/Sans + Geist Mono, the rub-el-hizb octagram as a structural
motif (avatar fallback, dividers, spinner, empty states), and a from-scratch
primitives layer in `apps/web/app/components/ui/` (Button, Card, Badge,
Avatar, Chip, Sheet, ConfirmDialog, Toast, Field/Input/Select/Textarea/
Checkbox, ProgressBar, PhotoLightbox).

Covered: discovery + filters (moved into a Sheet, URL-driven), chat (fixed
composer, date separators, grouping, read receipts), conversation list,
profile form (sticky save bar + completion %, all 27 fields validated and
labeled, unsaved-changes guard), settings, auth pages, the landing page,
and a persistent 3-column desktop workspace layout (contacts/favorites
sidebar + swappable center + profile-preview sidebar).

### Admin dashboard (redesigned, done)

Moved out from under the member `AppShell` into its own shell
(`components/admin/AdminShell.tsx`): white background, fixed left sidebar
with icons + pending-count badges, mobile drawer, sign-out.

- **Profiles**: searchable by pseudo *and* email (via a security-definer
  RPC, `admin_search_profiles` — email lives on `auth.users`, unreachable
  from a plain client select), paginated (20/page), filterable by
  moderation status *and* subscription status, quick disable/reactivate
  buttons per row, and a detail sheet (`AdminProfileDetailSheet`) showing
  every field plus the full photo grid before you can approve/reject —
  the original list showed name-only with no way to actually see the
  profile.
- **Photos**: grid review queue with an integrated lightbox (arrow through
  all photos in the current filter, not just one at a time).
- **Reports**: profile reports link straight to the same profile detail
  sheet instead of leaving the moderator to go find the profile themselves.
- **Subscriptions**: enable/configure per-audience products, free-launch
  toggle.
- **Audit log**: read-only, profile-type entries are clickable too.

Admin enums (`pending`/`approved`/etc.) are deliberately left in English —
explicit call, not an oversight.

### Server-only writes (done)

Clients can no longer insert or delete in `profile_photos`, `messages`,
`conversations` or `reports` — they keep SELECT (plus the two photo column
updates). Everything goes through `apps/api` with the service role, which
validates first: photo rows come only from `POST /photos` (and a
key can belong to one row), sending goes through the service-role-only
`send_message_command()` (finds/creates the canonical conversation and
inserts the message in one transaction), and reports check the target exists
and that a message reporter took part in it. Migration
`20261111090000_server_only_writes.sql`; verified with rolled-back
two-identity SQL tests. The query cache is also cleared whenever the signed-in
user changes (`useClearCacheOnIdentityChange`).

### Photo storage — Supabase Storage (done)

Photos moved off UploadThing (public-read files) into a **private**
`profile-photos` bucket. Every photo is two WebP objects,
`<profile_id>/<photo_id>/thumb.webp` (≤640×800) and `display.webp` (≤1600),
and `profile_photos.storage_key` is `<profile_id>/<photo_id>` (the RPCs keep
returning it as `photo_key` / `photo_keys` / `primary_photo_key`).

- **Upload** is `POST /photos` (multipart, 12 MB cap, 10 photos per member —
  also enforced by a DB trigger). The API decodes the file with `sharp`
  (so what's stored is a real image, not whatever the client claimed),
  re-encodes it, and **drops all metadata** — EXIF GPS and camera serials
  never reach storage; EXIF orientation is applied first so photos don't turn
  sideways. The original is discarded. SVG, HEIC and corrupt files are
  refused. New photos start **private** and pending.
- **Reading** needs a signed URL, and Storage only signs an object the
  caller's `SELECT` policy lets them read: `can_read_photo_object()` allows
  the owner, admins/moderators, and other *approved* members when the photo is
  approved, its owner is approved and live, and it is public — or private with
  a grant in `photo_access`. Members hold no write policy on the bucket at
  all. A leaked path is therefore useless to anyone the rule refuses, and
  withdrawing access stops *new* URLs at once.
- **Honest limit:** a URL signed *before* access was withdrawn keeps working
  until it expires (1 h). Shorten `SIGNED_URL_TTL_SECONDS` in
  `apps/web/app/lib/photo-urls.tsx` if that window matters.
- **Frontend:** `photoUrl(key)` is gone. `usePhotoUrl` / `usePhotoUrls` /
  `<PhotoImg>` (`lib/photo-urls.tsx`) batch every URL requested in the same
  render into one `createSignedUrls` call, cache for 50 min and refresh before
  expiry. Grids use the thumbnail; the full size is fetched only when the
  lightbox opens.
- **Account deletion** removes the member's stored photos first, and refuses to
  proceed if that fails.
- Not used on purpose: Supabase's on-the-fly image transformations (billed per
  distinct original, $5/1,000 after 100/month) — resizing happens once, at upload.
- Migrations `20261114100000` (bucket, access rule, `storage_key`) and
  `20261114110000` (RPCs switched over, `uploadthing_key` dropped);
  a one-off script copied the 35 existing photos (since removed: it read the dropped
  `uploadthing_key` column; `scripts/migration/05-migrate-photos.ts` now imports
  straight from the monolith into Storage).

**Still to do for this:** the 35 original files are still on UploadThing, **still
publicly readable** at their old URLs. Delete them (and the UploadThing app)
once you're satisfied with the new storage — until then the old exposure exists,
just unreferenced. `UPLOADTHING_TOKEN` (apps/api/.env) and
`VITE_UPLOADTHING_APP_ID` (apps/web/.env.local) are no longer read by the app and
can be removed, as can `RENCONTRE_UPLOADTHING_TOKEN` in `scripts/migration/.env.local`.

### Stripe webhook reliability (done)

`webhook_events` is now a durable inbox with a state (`processing` /
`processed` / `failed`, attempts, last error). `claim_webhook_event()` takes
an event atomically; the handler answers **200** only for a genuine duplicate
of something already *processed*, **409** if another delivery is working on it,
and **5xx** whenever recording or processing failed — so Stripe redelivers
instead of the event being lost. A failed event is re-claimed by its
redelivery (same id), and a dead attempt (`processing` for >5 min) is taken
over. Subscription events project the subscription's **current** state from
Stripe rather than the event's snapshot, so out-of-order delivery can't
resurrect a canceled subscription. Emails are sent only after the event is
marked processed, and never fail the webhook. Migration
`20261115090000_webhook_event_state.sql`. Not covered: two *different*
events for one subscription processed at the exact same instant (both read
current state, so they converge). Old rows are pruned — see "Webhook event
cleanup" below.

### Account export (done)

`POST /gdpr/export` (`lib/gdpr/export.ts`) now reads every table through
`fetchAll` (`lib/paginate.ts`), which pages with a stable order, asks for the
exact row count and **throws** if it ends up with fewer rows — PostgREST's
silent 1,000-row cap used to cut long message histories off with no error.
Any read failure makes the whole export fail: the response is a 500 and
`gdpr_requests` is marked `failed`; `completed` is only written for a full
export. Fields are chosen explicitly per table (no `select("*")`): moderator
identities (`moderated_by`/`reviewed_by`), moderators' private report notes
and storage paths are left out; the moderation note addressed to the member
is kept. Added what was missing: favorites, and a 7-day signed download link
for every photo (private ones included — they're the member's own). A silent
photo-access decline is exported as "pending", never "denied".

**Also fixed (found while testing the export):** a moderator/admin who had ever
acted on something could not be deleted — `profiles.moderated_by`,
`profile_photos.moderated_by`, `reports.reviewed_by` and
`admin_audit_log.admin_user_id` referenced `auth.users` with no delete rule, so
the database refused and the auth API answered a bare 500. They are now
`ON DELETE SET NULL` (migration `20261115100000_moderator_references_set_null.sql`;
the audit log's `admin_user_id` is nullable and `admin/audit-log.tsx` shows
"Compte supprimé"): the moderated records and audit entries stay, only the
pointer to the person who acted is dropped.

### Reliability fixes (done)

- **API is deployable**: `npm run build -w apps/api` now bundles to a single
  `dist/server.js` with esbuild (the shared package ships TypeScript, so the
  old `tsc` output couldn't start under plain `node`). CI starts the built
  file and requires `/health`.
- **New-message emails**: per-recipient, atomic cooldown
  (`message_email_claims` + `claim_message_email_slot()`), released if the
  send fails, and sent after the reply instead of before it. Conversation
  polling dropped from 15s to 60s (realtime covers it).
- **Message history cursor** is `(created_at, id)` with a matching index, so
  messages sharing a timestamp at a page boundary are no longer skipped.
- **Account deletion** cancels any live Stripe subscription first, and
  refuses to proceed (502) if Stripe can't be reached.
- Removed the stale `pnpm-lock.yaml` (npm is the package manager).
- **Email templates escape everything typed by a person** (nicknames, the
  message preview, moderators' notes) via `escapeHtml` in
  `lib/email/layout.ts`, which also escapes the title. Before this, a message
  such as `<a href=…>` arrived as a live link in a mail from our own domain.
  `test/email-templates.test.ts` feeds hostile text through every template and
  fails if a template is added without being covered. Any new template must
  escape its free-text parameters.

**Needs your attention:** the Stripe *test* secret key in `apps/api/.env` is
expired ("Expired API Key provided"). Roll a new one before testing
checkout or subscriptions. The live-subscription cancellation path on
account deletion has therefore not been exercised against real Stripe objects.

### Profile text review (done — migration needs applying)

Edits to **bio** and **"what I'm looking for"** on an approved profile are held
for a moderator; **new photos** already were (they start `pending` and others
never see them). While an edit waits, the profile stays visible with its
previous approved text. Nickname and the other fields are not reviewed.

- Pending text lives in `profiles.bio_pending` / `looking_for_pending`
  (readable only by the author and moderators); `text_review_version` is bumped
  whenever it changes. Migration `20261116100000_profile_text_review.sql`.
- **Enforced in the database**, because members write to `profiles` directly: a
  trigger refuses direct changes to those columns (and to the pending ones) for
  an approved profile. The form saves them through `submit_profile_texts()`,
  which makes a changed text pending, applies a cleared field immediately, and
  cancels the pending edit if the member types the live text back. A profile
  that isn't approved yet takes text directly (the whole profile is reviewed).
- Moderators: `POST /admin/profiles/:id/texts/review` (`decision`, `version`,
  `notes`) → `review_profile_texts()`. The decision carries the version the
  moderator was shown; if the member rewrote it meanwhile it is refused (409)
  rather than approving unseen text. Audit-logged; the member is emailed.
  Admin UI: "Textes à valider" filter and dashboard card, and an
  Actuel / Proposé panel in the profile sheet.
- Included in the GDPR export. Tests: `apps/api/test/profile-text-review.test.ts`.
- **Deploy order matters:** apply the migration *before* the new web build —
  the new form calls `submit_profile_texts`, which doesn't exist until then.

### Legal pages (draft — not launch-ready until the checklist below is done)

Public pages `/cgu`, `/confidentialite`, `/mentions-legales`
(`app/routes/legal/`), linked from the landing page, the login form
("En continuant, vous acceptez…"), the profile form's consent section and
Réglages. They were written from what the app actually does (data collected,
processors, retention, moderation, deletion), in French, and **a lawyer should
review them**.

**Fill in `apps/web/app/lib/legal-config.ts`** — company name/form/registration/
address, director of publication, contact e-mail, host, Supabase region,
consumer mediator. Anything still `null` shows as a highlighted
"[… — à compléter]" on the page, so gaps are visible, but nothing blocks a
build: check each page before launch.

**Before launch** (found while checking the text against the code):
1. **Inactive accounts** are never purged and no retention period is defined;
   neither is the audit-log, reports-about-a-member or backup retention. The
   policy has placeholders. (Reports filed *about* someone are deliberately
   kept after their account is deleted, for safety and legal claims, and the
   policy says so — decide how long.)
2. New-message e-mails are **on by default** (opt-out), so the policy bases
   them on legitimate interest rather than consent.

### Moderators can no longer browse conversations (done — migration needs applying)

Two RLS policies used to give every moderator and admin SELECT on all
conversations and messages. No screen used it — the reports page never showed a
reported message, so a message report could not actually be assessed — but it
left every private conversation readable and unlogged. Migration
`20261119090000_moderators_no_direct_message_access.sql` drops both policies.

The only path now is **`GET /admin/reports/:id/conversation`** (moderator/admin):
- only for an **open** (`pending`/`reviewed`) report about a **message** — profile
  reports and handled reports give no access (400 / 409);
- returns a **window** (25 messages before, the reported one, 25 after), with the
  two participants' nicknames — no emails or ids of accounts;
- writes an audit entry `conversation_viewed` (target = the report) for every
  view, with no content, and **returns nothing if that entry can't be written**.

UI: "Voir la conversation" on open message reports (`ReportedConversationSheet`),
fetched once per opening (never refetched, since each fetch is logged). Privacy
policy (art. 5, 9) and terms (art. 7) describe this. Tests:
`test/conversation-access.test.ts`.

**Deploy order**: either order is safe, but until the migration is applied the old
broad access still exists. The API route works regardless (service role).

### Special-category consent now covers ethnicity (done — migration needs applying)

The profile consent named religion and religious practice, but the profile also
holds and shows **ethnicity**, which is special-category data too (GDPR art. 9).
The wording (`SPECIAL_CATEGORY_CONSENT_TEXT`, `packages/shared/src/constants/consent.ts`)
now names all three and says they are visible to other members. It is the single
source for the profile form and the re-consent dialog.

- **Recorded per member**: `profiles.special_category_consent_version`, written —
  with the timestamp — only by the database function `record_special_category_consent`;
  a trigger refuses direct changes to the version and date from the browser.
  Migration `20261118090000_special_category_consent_version.sql`.
- **Existing members**: they keep their data, but have no version, so their
  **ethnicity is hidden from other members** (`get_profile_detail`) until they
  accept the new wording or remove the field. Nothing is deleted. Religion and
  practice stay visible — the old wording covered them.
- **In the app**: a one-time dialog (`ConsentRenewalDialog`, in `AppShell`) for
  members who hold an ethnicity but not the current consent: *J'accepte* /
  *Retirer mon origine ethnique* / *Plus tard* (comes back next visit). The
  profile form's box starts **unticked** for anyone who hasn't accepted the
  current wording, so they must read and tick it to save.
- **Changing the wording later**: bump `SPECIAL_CATEGORY_CONSENT_VERSION`, update
  the date in the migration's `get_profile_detail` rule with a new migration, and
  update the privacy policy's article 3.
- Included in the data export. Tests: `test/special-category-consent.test.ts`.
  The wording is a draft for legal review.

### Checkout consent (done — migration needs applying)

Subscribing now needs two **separate, unticked** choices, made in a dialog in
the app before the redirect to Stripe: acceptance of the terms/privacy policy,
and the member's express request that the subscription start immediately, with
the acknowledgement that if they withdraw within 14 days they pay for what has
been provided (French consumer law, art. L221-25 *Code de la consommation*).
Stripe's own page supports only one terms checkbox and needs a URL set in the
Stripe dashboard, so this is done in the app, under our control.

- **Enforced by the API**: `POST /stripe/checkout` refuses (400) unless
  `acceptTerms` and `waiveWithdrawal` are both literally `true`
  (`checkoutConsentSchema` in `packages/shared`), before Stripe is contacted.
- **Proof is kept**: once Stripe has created the session, a row is written to
  `subscription_consents` (session id, `TERMS_VERSION`, `CHECKOUT_WORDING_VERSION`,
  both flags; migration `20261117090000_subscription_consents.sql`). If it can't
  be written the member gets no payment link and the session is expired. The
  table is server-only, is included in the member's data export, and is removed
  with their account.
- Stripe also shows the same notice (withdrawal, auto-renewal, how to cancel)
  next to the pay button, in French (`CHECKOUT_NOTICE`, `custom_text.submit`).
- **Versions**: bump `TERMS_VERSION` when the terms/privacy policy change
  materially (it also drives the "Dernière mise à jour" on the legal pages) and
  `CHECKOUT_WORDING_VERSION` when the checkboxes or the notice change. The
  wording lives in three places that must agree: the dialog
  (`components/settings/CheckoutConsentDialog.tsx`), `CHECKOUT_NOTICE`
  (`routes/stripe.ts`) and CGU article 9.
- **Deploy order**: apply the migration *before* the new API — checkout writes
  to the new table. Not exercised end to end: creating a real Checkout session
  needs a Stripe account with a priced product, which this project doesn't have
  enabled yet; run one test-mode checkout before charging anyone.
- Tests: `test/checkout-consent.test.ts`. The wording is a draft for legal review.

### Audit log holds no personal data (done — migration needs applying)

`admin_audit_log` used to store a full snapshot of the profile / photo / report
row for every moderation decision, and it survived account deletion. Entries
now record only the decision: actor, action, target id, timestamp and the
status values it moved between (`moderation_status` / `status`, plus
`bio_changed` / `looking_for_changed` for text reviews). Migration
`20261116120000_audit_log_minimal.sql` scrubs existing rows and adds a CHECK
(`admin_audit_log_details_minimal`) so the database refuses anything else for
member-related entries — widening it takes a migration, not a code slip.
Subscription-product entries keep full before/after (pricing, not personal).
After deletion the remaining rows point at an id that no longer exists.
`writeAuditLog` in `routes/admin.ts` takes a narrow `AuditState`;
`test/audit-log.test.ts` covers it, including the post-deletion state.

### Webhook event cleanup (done — migration needs applying)

`webhook_events` only exists to recognise a redelivered Stripe event, so old
rows are deleted by `prune_webhook_events()` (migration
`20261116090000_prune_webhook_events.sql`, service-role only). The API runs it
at startup and then daily (`lib/maintenance.ts`); a failure is logged and never
affects requests. **Retention is `WEBHOOK_EVENT_RETENTION_DAYS`** in the API's
environment: default 90, minimum 7 (shorter than Stripe's redelivery window
would let a late retry be processed twice). Events still being processed are
never removed. Until the migration is applied the daily job just logs an error.

### Integration tests (done)

`npm test` (root) runs `apps/api/test/*.test.ts` with `node:test` + `tsx`
against a **real Supabase stack and the real running API** — not mocks. It
covers messaging (create/reuse conversation, sender can't be spoofed, ignore
semantics, paywall, history cursor with tied timestamps, email-slot claims),
reports (target validation, one open report per target), photo upload
(re-encode, orientation, EXIF/GPS stripped, SVG/corrupt/oversized refused,
ten-photo cap), photo deletion, who can see which photo (pending / approved /
private grants / withdrawn / unapproved viewer), account export (internal
fields excluded, working photo links, declined request shown as pending),
account deletion (files and rows removed, others untouched), moderator
deletion, admin authorization, the Stripe webhook's signature checks and
claim/retry state machine, the paginator, and that clients can't write
server-only tables.

- **Safety guard**: `test/helpers/env.ts` refuses to start unless
  `TEST_SUPABASE_URL` is a local address (override:
  `ALLOW_REMOTE_TEST_DB=yes-this-database-may-receive-test-data`). Every
  throwaway user is `test-<run id>-…@rencontre.invalid` and is removed in
  `after()`; the last file (`zz-no-leftovers`) fails if anything remains.
- **Env**: `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`,
  `TEST_SUPABASE_SERVICE_KEY`, `TEST_API_URL` (default `localhost:8787`),
  `TEST_STRIPE_WEBHOOK_SECRET` (same as the API's `STRIPE_WEBHOOK_SECRET`;
  the webhook tests skip without it). Start the API for tests with
  `RATE_LIMIT_MAX=100000` and a dummy `RESEND_API_KEY`.
- **CI**: the `test` job in `.github/workflows/ci.yml` does
  `supabase start` (migrations replay from scratch), lifts the local auth
  throttle on the runner only, builds and starts the API, and runs the suite.
- `TEST_STRIPE_KEY_IS_PLACEHOLDER=yes` enables the test for "account deletion
  is refused (502) and nothing is removed while Stripe is unreachable"; set it
  only when the API runs with a placeholder `STRIPE_SECRET_KEY` (CI does).
- **Not covered**: Stripe events that read back from Stripe (checkout /
  subscription updated|deleted / invoice) need the real Stripe API; the
  browser UI (no component or e2e tests yet).
- On a *hosted* project the suite works but is slow: Supabase throttles
  magic-link verification to 30 per 5 minutes per IP, so member creation
  waits it out.

## Known gaps / deliberately deferred

- **Phase 11 (launch/cutover)** — not started: DNS, redirecting the
  monolith's old `/dating` routes, decommissioning old dating tables there,
  deploying `apps/api` on the VPS. This needs the user to actually be ready
  to cut over, not something to start speculatively.
- **Clickable message-notification toasts** — currently informational only;
  clicking one doesn't jump to the conversation. Would need extending the
  `Toast` primitive with an action/click slot.
- **`PhotoManager` (own-profile photo editor)** doesn't use the lightbox —
  it's a reorder/delete UI, not a browsing one, so it didn't seem like the
  right fit, but it's a small follow-up if wanted.
- **NSFW pre-filter on photo upload** — still human-queue-only, no
  automated moderation API wired in (flagged in the original plan, never
  picked up).
- **Scheduled purge of long-rejected profiles/photos** — no cron exists.
- **`apps/web`'s own CSP header** — belongs at the hosting layer
  (nginx/Caddy/provider config), not application code; has no home in this
  repo until a hosting target is chosen.

## Where to look

- `supabase/migrations/` — every schema change, in order; each file's
  header comment explains *why*, not just what.
- `apps/web/app/components/ui/` — the shared primitive library everything
  else is built on.
- `apps/web/app/lib/queries/` — all TanStack Query hooks, one file per
  domain (`useAdmin.ts`, `useFavorites.ts`, `useDiscoverProfiles.ts`, etc).
- `apps/api/src/routes/` — every privileged write route.
- `scripts/migration/` — the one-off monolith → new-project data migration,
  with its own README.
