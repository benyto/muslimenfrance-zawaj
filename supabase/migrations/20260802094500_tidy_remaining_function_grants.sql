-- Consistency follow-up to 20260802093000 — not fixing a leak (both of
-- these already self-guard correctly for an anon caller: search_profiles
-- raises PROFILE_NOT_APPROVED, get_my_roles returns an empty array), but
-- they were only ever explicitly granted to `authenticated` without first
-- revoking the broader default anon/authenticated grant a new Supabase
-- project applies to public-schema functions. Tidying so every function in
-- this schema follows the same explicit revoke-then-grant pattern as the
-- tables, rather than leaving two relying on an implicit default.

revoke execute on function public.get_my_roles() from anon, authenticated, public;
grant execute on function public.get_my_roles() to authenticated;

revoke execute on function public.search_profiles(text, uuid, text, int, int, int, int) from anon, authenticated, public;
grant execute on function public.search_profiles(text, uuid, text, int, int, int, int) to authenticated;
