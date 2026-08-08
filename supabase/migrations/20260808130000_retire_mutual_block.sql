-- Retire mutual blocking (user_blocks / is_profile_blocked) in favor of
-- profile_ignores for both of its former trigger points — explicit product
-- decision: "Ignorer" (ProfileDetailPanel) and "Bloquer" (chat header) now
-- both call the same one-directional ignore mechanism under different
-- labels/friction, rather than two genuinely different mechanisms. The
-- accepted tradeoff: an ignored/"blocked" party can still view the
-- ignorer's profile and still send messages — nothing prevents the write —
-- it's just invisible to the ignorer (out of their search results, their
-- conversation list, and their inbox toast) rather than rejected outright.
--
-- Order matters: every reference to is_profile_blocked is removed from
-- policies/functions first, so it's unreferenced by the time it (and
-- user_blocks) are dropped at the end.

-- conversations/messages insert policies: drop the mutual-block guard.
-- Nothing replaces it — ignore was never meant to prevent inserts, only to
-- hide their effect from the ignorer's side, which get_my_conversations()
-- and the client's ignored-ids check already handle.
drop policy "conversations insert own" on public.conversations;

create policy "conversations insert own"
  on public.conversations for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id in (profile1_id, profile2_id) and p.user_id = auth.uid())
  );

drop policy "messages insert own" on public.messages;

create policy "messages insert own"
  on public.messages for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = sender_profile_id and p.user_id = auth.uid())
    and exists (
      select 1 from public.conversations c
      join public.profiles p2 on p2.id in (c.profile1_id, c.profile2_id)
      where c.id = messages.conversation_id and p2.user_id = auth.uid()
    )
    and public.has_active_dating_subscription(auth.uid())
  );

-- search_profiles: drop the bidirectional block exclusion, keep the
-- one-directional ignore exclusion already added in profile_ignores.sql.
-- Signature/return shape unchanged.
drop function public.search_profiles(text, text, text, text, text, text, int, int, int, int);

create function public.search_profiles(
  p_gender text default null,
  p_commune_insee_code text default null,
  p_department_code text default null,
  p_region_code text default null,
  p_relationship_goal text default null,
  p_origin_country_code text default null,
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
  commune_insee_code text,
  commune_nom text,
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
    p.commune_insee_code,
    cf.nom_standard::text,
    p.relationship_goal::text,
    p.religion::text,
    ph.uploadthing_key as primary_photo_key
  from public.profiles p
  left join public.communes_fr cf on cf.code_insee = p.commune_insee_code
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
    and not public.is_profile_ignored(v_caller_profile_id, p.id)
    and (p_gender is null or p.gender = p_gender)
    and (p_commune_insee_code is null or p.commune_insee_code = p_commune_insee_code)
    and (p_department_code is null or cf.dep_code = p_department_code)
    and (p_region_code is null or cf.reg_code = p_region_code)
    and (p_relationship_goal is null or p.relationship_goal = p_relationship_goal)
    and (p_origin_country_code is null or p.origin_country_code = p_origin_country_code)
    and (p_min_age is null or date_part('year', age(p.birthdate)) >= p_min_age)
    and (p_max_age is null or date_part('year', age(p.birthdate)) <= p_max_age)
  order by p.updated_at desc
  limit p_limit offset p_offset;
end;
$$;

revoke execute on function public.search_profiles(text, text, text, text, text, text, int, int, int, int) from anon, authenticated, public;
grant execute on function public.search_profiles(text, text, text, text, text, text, int, int, int, int) to authenticated;

-- get_profile_detail: drop the "blocked pair -> PROFILE_NOT_FOUND" guard —
-- ignore never restricted direct profile access, so this simply goes away
-- with nothing replacing it. Signature/return shape unchanged.
drop function public.get_profile_detail(uuid);

create function public.get_profile_detail(p_profile_id uuid)
returns table (
  id uuid,
  nickname text,
  gender text,
  age int,
  commune_insee_code text,
  commune_nom text,
  department_name text,
  region_name text,
  origin_country_code text,
  bio text,
  looking_for text,
  last_seen_at timestamptz,
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
  v_caller_shares boolean;
begin
  select p.id, p.show_online_status into v_caller_profile_id, v_caller_shares
  from public.profiles p
  where p.user_id = auth.uid() and p.moderation_status = 'approved' and p.deleted_at is null;

  if v_caller_profile_id is null then
    raise exception 'PROFILE_NOT_APPROVED' using errcode = '42501';
  end if;

  return query
  select
    p.id, p.nickname::text, p.gender::text,
    date_part('year', age(p.birthdate))::int as age,
    p.commune_insee_code, cf.nom_standard::text, dep.name::text, reg.name::text,
    p.origin_country_code::text,
    p.bio, p.looking_for,
    case when v_caller_shares and p.show_online_status then p.last_seen_at else null end,
    p.interests, p.height, p.weight, p.eye_color::text, p.hair_color::text, p.body_type::text,
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
  left join public.communes_fr cf on cf.code_insee = p.commune_insee_code
  left join public.departments dep on dep.code = cf.dep_code
  left join public.regions reg on reg.code = cf.reg_code
  where p.id = p_profile_id and p.moderation_status = 'approved' and p.deleted_at is null;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.get_profile_detail(uuid) from anon, authenticated, public;
grant execute on function public.get_profile_detail(uuid) to authenticated;

-- Nothing references get_my_blocked_profiles()/is_profile_blocked()/
-- user_blocks any more — drop all three. Table drop cascades its own
-- policies.
drop function public.get_my_blocked_profiles();
drop function public.is_profile_blocked(uuid, uuid);
drop table public.user_blocks;
