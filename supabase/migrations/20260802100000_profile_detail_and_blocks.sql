-- Full single-profile view for the profile detail page. RLS on `profiles`
-- is owner-only, so viewing someone else's profile has to go through a
-- security-definer RPC — same reasoning as search_profiles(), but returns
-- every display field (not just the discovery-card subset) plus the
-- target's approved photo keys, since profile_photos has no cross-user
-- select grant either.
--
-- NOTE on the explicit revoke-then-grant pattern below: a live Supabase
-- project grants execute on new public-schema functions to `anon` and
-- `authenticated` directly (not merely via the PUBLIC pseudo-role), so
-- `revoke ... from public` alone does NOT close this off — confirmed the
-- hard way in migration 20260802090000/093000. Every function below
-- revokes from the actual role names from the start.
create or replace function public.get_profile_detail(p_profile_id uuid)
returns table (
  id uuid,
  nickname text,
  gender text,
  age int,
  city_id uuid,
  interests text[],
  height int,
  weight int,
  eye_color text,
  hair_color text,
  body_type text,
  education_level text,
  occupation text,
  employment_status text,
  income_range text,
  ethnicity text,
  religion text,
  religiosity_level text,
  languages_spoken text[],
  relationship_goal text,
  smoker text,
  drinker text,
  has_children boolean,
  wants_children text,
  photo_keys text[]
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_caller_profile_id uuid;
begin
  select p.id into v_caller_profile_id
  from public.profiles p
  where p.user_id = auth.uid() and p.moderation_status = 'approved' and p.deleted_at is null;

  if v_caller_profile_id is null then
    raise exception 'PROFILE_NOT_APPROVED' using errcode = '42501';
  end if;

  -- Blocked in either direction: treat identically to "not found" rather
  -- than a distinct error, so a blocked party can't use this to confirm
  -- they were specifically blocked (vs. the profile just not existing).
  if public.is_profile_blocked(v_caller_profile_id, p_profile_id) then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  return query
  select
    p.id, p.nickname::text, p.gender::text,
    date_part('year', age(p.birthdate))::int as age,
    p.city_id, p.interests, p.height, p.weight, p.eye_color::text, p.hair_color::text, p.body_type::text,
    p.education_level::text, p.occupation::text, p.employment_status::text, p.income_range::text,
    p.ethnicity::text, p.religion::text, p.religiosity_level::text, p.languages_spoken,
    p.relationship_goal::text, p.smoker::text, p.drinker::text, p.has_children, p.wants_children::text,
    coalesce(
      (select array_agg(pp.uploadthing_key order by pp.position)
       from public.profile_photos pp
       where pp.profile_id = p.id and pp.moderation_status = 'approved'),
      '{}'
    ) as photo_keys
  from public.profiles p
  where p.id = p_profile_id and p.moderation_status = 'approved' and p.deleted_at is null;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.get_profile_detail(uuid) from anon, authenticated, public;
grant execute on function public.get_profile_detail(uuid) to authenticated;

-- "Who have I blocked, with a display name" — profiles RLS is owner-only,
-- so listing this for the settings/blocked-users page needs the same
-- security-definer treatment. Scoped entirely to the caller's own blocks;
-- no parameter, so there's nothing here for a caller to probe about
-- anyone else's block list.
create or replace function public.get_my_blocked_profiles()
returns table (blocked_profile_id uuid, nickname text, blocked_at timestamptz)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_caller_profile_id uuid;
begin
  select p.id into v_caller_profile_id from public.profiles p where p.user_id = auth.uid();
  if v_caller_profile_id is null then
    return;
  end if;

  return query
  select ub.blocked_profile_id, p.nickname::text, ub.created_at as blocked_at
  from public.user_blocks ub
  join public.profiles p on p.id = ub.blocked_profile_id
  where ub.blocker_profile_id = v_caller_profile_id
  order by ub.created_at desc;
end;
$$;

revoke execute on function public.get_my_blocked_profiles() from anon, authenticated, public;
grant execute on function public.get_my_blocked_profiles() to authenticated;

-- Fix for a latent bug in the original search_profiles() (migration
-- 20260801120700): nickname/relationship_goal/religion are varchar(N)
-- columns but the function declares a `text` return type for them.
-- Postgres requires an exact type match for RETURN QUERY into a declared
-- TABLE type, so this would raise "structure of query does not match
-- function result type" the first time it actually returned a row — never
-- caught before because every prior test of this function only exercised
-- its PROFILE_NOT_APPROVED exception path, which raises before reaching
-- the query. Signature/return-table shape is unchanged, only the body.
create or replace function public.search_profiles(
  p_gender text default null,
  p_city_id uuid default null,
  p_relationship_goal text default null,
  p_min_age int default null,
  p_max_age int default null,
  p_limit int default 24,
  p_offset int default 0
)
returns table (
  id uuid,
  nickname text,
  gender text,
  age int,
  city_id uuid,
  relationship_goal text,
  religion text,
  primary_photo_key text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_caller_profile_id uuid;
begin
  select p.id into v_caller_profile_id
  from public.profiles p
  where p.user_id = auth.uid() and p.moderation_status = 'approved' and p.deleted_at is null;

  if v_caller_profile_id is null then
    raise exception 'PROFILE_NOT_APPROVED' using errcode = '42501';
  end if;

  if p_limit is null or p_limit > 48 then
    p_limit := 48;
  end if;
  if p_limit < 1 then
    p_limit := 1;
  end if;
  if p_offset is null or p_offset < 0 then
    p_offset := 0;
  end if;

  return query
  select
    p.id,
    p.nickname::text,
    p.gender::text,
    date_part('year', age(p.birthdate))::int as age,
    p.city_id,
    p.relationship_goal::text,
    p.religion::text,
    ph.uploadthing_key as primary_photo_key
  from public.profiles p
  left join lateral (
    select pp.uploadthing_key
    from public.profile_photos pp
    where pp.profile_id = p.id and pp.moderation_status = 'approved'
    order by pp.position
    limit 1
  ) ph on true
  where p.moderation_status = 'approved'
    and p.deleted_at is null
    and p.id <> v_caller_profile_id
    and not public.is_profile_blocked(v_caller_profile_id, p.id)
    and (p_gender is null or p.gender = p_gender)
    and (p_city_id is null or p.city_id = p_city_id)
    and (p_relationship_goal is null or p.relationship_goal = p_relationship_goal)
    and (p_min_age is null or date_part('year', age(p.birthdate)) >= p_min_age)
    and (p_max_age is null or date_part('year', age(p.birthdate)) <= p_max_age)
  order by p.updated_at desc
  limit p_limit offset p_offset;
end;
$$;
