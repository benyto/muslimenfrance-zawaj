-- Origin country: a plain ISO 3166-1 alpha-2 code, same convention as
-- eye_color/hair_color/body_type — client-validated against a static list
-- (packages/shared/src/constants/countries.ts), no DB-level enum check.
-- Filterable in discovery, same shape as the existing profile filters.

alter table public.profiles
  add column origin_country_code varchar(2);

create index profiles_origin_country_idx on public.profiles (origin_country_code);

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

  if public.is_profile_blocked(v_caller_profile_id, p_profile_id) then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  return query
  select
    p.id, p.nickname::text, p.gender::text,
    date_part('year', age(p.birthdate))::int as age,
    p.commune_insee_code, cf.nom_standard::text, dep.name::text, reg.name::text,
    p.origin_country_code::text,
    p.bio, p.looking_for,
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

drop function public.search_profiles(text, text, text, text, text, int, int, int, int);

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
    and not public.is_profile_blocked(v_caller_profile_id, p.id)
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
