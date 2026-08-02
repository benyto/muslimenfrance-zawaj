-- Follow-up fix to 20260802090000: that migration revoked execute "from
-- public" (the generic Postgres pseudo-role), which is what worked in a
-- vanilla local Postgres test — but a live Supabase project separately
-- grants execute on public-schema functions to the `anon`/`authenticated`
-- roles directly (via its own project-bootstrap default privileges), not
-- merely inherited through PUBLIC. Confirmed live: an unauthenticated
-- caller (publishable key only, no user session) could still successfully
-- call has_active_dating_subscription/is_admin_or_moderator/
-- is_profile_blocked after the previous migration — the internal
-- self-only guard meant the *answer* was safe (always false for a
-- non-matching id), but the function should not be callable by anon at
-- all. Revoking by explicit role name (matching the pattern already used
-- for every table in this schema, e.g. "revoke all on ... from
-- authenticated") actually closes it.

revoke execute on function public.is_profile_blocked(uuid, uuid) from anon, authenticated, public;
grant execute on function public.is_profile_blocked(uuid, uuid) to authenticated;

revoke execute on function public.has_active_dating_subscription(uuid) from anon, authenticated, public;
grant execute on function public.has_active_dating_subscription(uuid) to authenticated;

revoke execute on function public.is_admin_or_moderator(uuid) from anon, authenticated, public;
grant execute on function public.is_admin_or_moderator(uuid) to authenticated;
