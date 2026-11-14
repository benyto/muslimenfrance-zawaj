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

**Needs your attention:** the Stripe *test* secret key in `apps/api/.env` is
expired ("Expired API Key provided"). Roll a new one before testing
checkout or subscriptions. The live-subscription cancellation path on
account deletion has therefore not been exercised against real Stripe objects.

## Known gaps / deliberately deferred

- **Phase 11 (launch/cutover)** — not started: DNS, redirecting the
  monolith's old `/dating` routes, decommissioning old dating tables there,
  deploying `apps/api` on the VPS. This needs the user to actually be ready
  to cut over, not something to start speculatively.
- **Clickable message-notification toasts** — currently informational only;
  clicking one doesn't jump to the conversation. Would need extending the
  `Toast` primitive with an action/click slot.
- **No legal/terms/privacy pages** — the landing page deliberately doesn't
  link to them; they don't exist anywhere in this app, and a live 404 is
  worse than no link.
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
