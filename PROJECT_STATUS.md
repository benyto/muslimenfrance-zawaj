# Project status — Rencontre (zawaj.muslimenfrance.com)

A standalone dating/matrimonial SPA extracted from the `muslimenfrance`
monolith: own Supabase project, own schema, own UI/admin, own backend,
Supabase Realtime messaging, UploadThing photos, Resend email, Stripe
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
| Photos | UploadThing |
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
- **Photos**: UploadThing upload, moderation queue, reordering.
- **Discovery**: filtered browse (`search_profiles` RPC), URL-driven filter
  state, block/report.
- **Messaging**: 1:1 conversations, Supabase Realtime delivery, typing
  presence, read receipts, unread counts, inbox-wide new-message toasts.
- **Favorites**: bookmark a profile, tabbed sidebar (Contacts / Favoris).
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
