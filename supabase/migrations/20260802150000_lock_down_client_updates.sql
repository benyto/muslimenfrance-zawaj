-- Phase 9 (redone) — two confirmed vulnerabilities and one broken policy,
-- all found by actually exploiting them against this project rather than
-- by reading the policies.
--
-- The root cause in both cases: RLS policies can only accept or reject a
-- whole row, they cannot say "only this column may change". Both tables
-- below had a broad `grant update` to `authenticated` plus a policy that
-- only checked *which rows* were reachable, so every other column on a
-- reachable row was freely rewritable. The fix is column-level UPDATE
-- grants — the right Postgres tool for "only this column may change" —
-- with the row policy narrowed to match.
--
-- ---------------------------------------------------------------------
-- 1. public.messages — CONFIRMED EXPLOITED (high severity)
--
-- `grant update on public.messages` + a policy whose USING clause only
-- checked "is the caller a participant in this conversation" meant either
-- participant could UPDATE any column of any message in the thread. Proven
-- live with two real accounts:
--   * attacker rewrote the victim's message `content` after the fact
--     ("ORIGINAL MESSAGE FROM VICTIM" -> "TAMPERED BY ATTACKER"), and
--   * attacker flipped `sender_profile_id`/`recipient_profile_id` on their
--     own message so it rendered as though the victim had sent it.
-- Both succeeded with no error. In a dating app this is message forgery:
-- it lets someone fabricate a conversation history and then report the
-- other party with it as "evidence".
--
-- The only update the client legitimately performs is marking received
-- messages read (see apps/web/app/lib/queries/useMarkAsRead.ts), so:
revoke update on public.messages from authenticated;
grant update (is_read) on public.messages to authenticated;

drop policy "messages update own" on public.messages;

-- Narrowed from "either participant" to "the recipient only" — a sender
-- has no reason to mark their own outgoing message as read, and this
-- matches what useMarkAsRead already filters on.
create policy "messages recipient marks read"
  on public.messages for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = messages.recipient_profile_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = messages.recipient_profile_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 2. public.profile_photos — broken policy (fail-closed) + latent bypass
--
-- "profile_photos owner update position" tried to freeze the moderation
-- columns by comparing each against a subquery on profile_photos itself:
--     moderation_status is not distinct from
--       (select pp.moderation_status from public.profile_photos pp ...)
-- A policy on a table that queries that same table is self-referential, so
-- Postgres aborts with "infinite recursion detected in policy for relation
-- profile_photos" instead of evaluating it. Confirmed live: *every* owner
-- UPDATE on profile_photos errors out, so the intended moderation lock has
-- never actually been enforcing anything, and legitimate photo reordering
-- is 100% broken (latent only because the UI has no reorder control yet).
--
-- It failed closed, so it was never exploitable as written — but simply
-- de-recursing it would have opened a real moderation bypass: nothing in
-- that policy froze `uploadthing_key`, so an owner could swap an already
-- approved photo's file for an unreviewed one while keeping the approved
-- status. Column-level grants close both at once: `position` is the only
-- column an owner can touch, so moderation_status/moderated_by/
-- moderated_at *and* uploadthing_key/profile_id are all immutable
-- client-side, and the policy no longer needs the self-reference at all.
revoke update on public.profile_photos from authenticated;
grant update (position) on public.profile_photos to authenticated;

drop policy "profile_photos owner update position" on public.profile_photos;

create policy "profile_photos owner update position"
  on public.profile_photos for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid())
  );

-- Note on public.profiles: it uses the same self-referencing-subquery
-- pattern in "profiles owner update", but there it demonstrably works
-- (verified live: a pending user cannot self-approve — "new row violates
-- row-level security policy" — while ordinary edits and the ProfileForm
-- upsert path both still succeed). profiles' own SELECT policy is a plain
-- `auth.uid() = user_id` with no subquery, which is why it doesn't trip
-- the recursion detector the way profile_photos' does. Left as-is
-- deliberately: it is a verified-working control, and rewriting it to
-- column grants would mean enumerating ~30 mutable columns and silently
-- breaking writes to any column added later without an accompanying grant.
