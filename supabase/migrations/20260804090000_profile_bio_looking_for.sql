-- Two free-text profile fields: a short "about me" and "what I'm looking
-- for". No new grants needed — public.profiles already has a table-level
-- owner-update grant (see 20260801120300_profiles.sql), not the per-column
-- grants used on messages/profile_photos, so new columns are writable by
-- the owner automatically.

alter table public.profiles
  add column bio text check (char_length(bio) <= 1000),
  add column looking_for text check (char_length(looking_for) <= 1000);

-- get_profile_detail must be dropped and recreated (not just altered) since
-- its return TABLE shape is changing — same pattern as every prior change
-- to this function.
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
