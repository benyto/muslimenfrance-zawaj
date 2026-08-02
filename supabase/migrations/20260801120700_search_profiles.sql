-- The *only* way to discover other profiles — replaces the old monolith's
-- blanket `select ... using (true)` policy. Enforces: caller must have an
-- approved profile of their own, excludes blocked pairs, excludes
-- non-approved profiles, hard-caps the page size (anti-scraping), and
-- returns only the columns discovery actually needs (never a full row or a
-- raw photo URL).
--
-- NOTE: signed UploadThing URLs for `primary_photo_key` are resolved by the
-- `discover` Edge Function wrapping this RPC (added in Phase 3/4), not here —
-- Postgres has no UploadThing SDK access. This RPC returns the storage key;
-- treat it as non-public until the Edge Function swaps it for a signed URL.
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
    p.nickname,
    p.gender,
    date_part('year', age(p.birthdate))::int as age,
    p.city_id,
    p.relationship_goal,
    p.religion,
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

grant execute on function public.search_profiles to authenticated;
