-- Business decision: launch fully free (no paywall) until the user base is
-- large enough, then switch to paid later — without a code deploy.
--
-- Reuses subscription_products.enabled (already per-audience, matching the
-- old monolith's male/female product split) as the toggle: if no *enabled*
-- product applies to a user's gender (audience = 'all' or their own
-- gender), messaging is free for them. Flipping this later is a plain
-- UPDATE on subscription_products (via the Phase 8 admin UI, or directly
-- for now) — has_active_dating_subscription() is the single source of
-- truth already wired into both the `messages insert` RLS policy and the
-- POST /messages route's pre-check, so this one change covers both.
create or replace function public.has_active_dating_subscription(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_gender text;
  v_paywall_applies boolean;
begin
  if p_user_id <> auth.uid() then
    return false;
  end if;

  select gender into v_gender from public.profiles where user_id = p_user_id;

  select exists (
    select 1 from public.subscription_products
    where enabled = true and (audience = 'all' or audience = v_gender)
  ) into v_paywall_applies;

  if not v_paywall_applies then
    return true;
  end if;

  return exists (
    select 1 from public.user_subscriptions
    where user_id = p_user_id
      and status in ('trialing', 'active')
      and (current_period_end is null or current_period_end > now())
  );
end;
$$;
