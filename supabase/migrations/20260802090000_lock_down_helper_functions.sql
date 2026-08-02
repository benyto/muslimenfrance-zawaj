-- Security fix: is_profile_blocked, has_active_dating_subscription, and
-- is_admin_or_moderator were created without any grant/revoke statement,
-- so they inherited Postgres's default PUBLIC execute grant. Since each
-- takes a caller-supplied id with no internal check that the id actually
-- relates to the caller, ANY caller — including unauthenticated `anon`,
-- via PostgREST's /rest/v1/rpc/<fn> endpoint — could pass an arbitrary
-- UUID and get a truthful answer about a completely unrelated user:
-- whether they have an active subscription, whether two arbitrary profiles
-- have blocked each other, or whether an arbitrary user id is an admin
-- (a reconnaissance vector for targeting admin accounts).
--
-- Fix: revoke the implicit PUBLIC grant (blocks `anon` entirely — these
-- functions are irrelevant before login) and add an internal guard so a
-- non-admin caller can only ever get a truthful answer about their own
-- id/profile. Every existing call site in this schema (RLS policies,
-- search_profiles) already only ever passes the caller's own auth.uid()
-- or own profile id, so this is purely restrictive — no legitimate
-- behavior changes.

revoke execute on function public.is_profile_blocked(uuid, uuid) from public;
grant execute on function public.is_profile_blocked(uuid, uuid) to authenticated;

revoke execute on function public.has_active_dating_subscription(uuid) from public;
grant execute on function public.has_active_dating_subscription(uuid) to authenticated;

revoke execute on function public.is_admin_or_moderator(uuid) from public;
grant execute on function public.is_admin_or_moderator(uuid) to authenticated;

create or replace function public.is_admin_or_moderator(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role in ('admin', 'moderator')
  );
$$;

create or replace function public.has_active_dating_subscription(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.user_subscriptions
    where user_id = p_user_id
      and status in ('trialing', 'active')
      and (current_period_end is null or current_period_end > now())
  );
$$;

create or replace function public.is_profile_blocked(p_profile_a uuid, p_profile_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.id in (p_profile_a, p_profile_b)
  )
  and exists (
    select 1 from public.user_blocks
    where (blocker_profile_id = p_profile_a and blocked_profile_id = p_profile_b)
       or (blocker_profile_id = p_profile_b and blocked_profile_id = p_profile_a)
  );
$$;
