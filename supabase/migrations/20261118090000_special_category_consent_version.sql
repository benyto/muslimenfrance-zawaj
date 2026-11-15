-- Consent for special-category data (GDPR art. 9) now names ethnicity.
--
-- The profile consent used to cover religion and religious practice, but the
-- profile also holds and shows an "ethnicity" field, which is special-category
-- data too. The checkbox wording now covers all three (see
-- SPECIAL_CATEGORY_CONSENT_TEXT in packages/shared), and we record which version
-- of the wording each member accepted.
--
-- Members who consented under the old wording keep their data and their
-- consent for what it covered, but have no recorded version. Until they accept
-- the new wording — or remove the field — their ethnicity is not shown to other
-- members. Nothing is deleted.
--
-- 1. The version column, and the rule that it is written only by the server
--    (a function below), so the date and wording on record are ours, not
--    whatever a browser sends.
-- 2. get_profile_detail hides ethnicity without a current-enough version.

alter table public.profiles add column special_category_consent_version text;

create function public.guard_profile_consent()
returns trigger
language plpgsql
as $$
begin
  -- Same shape as guard_profile_texts: browser role only; the definer function,
  -- the API's service role and moderators pass untouched.
  if current_user <> 'authenticated' or public.is_admin_or_moderator(auth.uid()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.special_category_consent_version := null;
    new.special_category_consent_at := null;
    return new;
  end if;

  if new.special_category_consent_version is distinct from old.special_category_consent_version
     or new.special_category_consent_at is distinct from old.special_category_consent_at then
    raise exception 'CONSENT_RECORD_IS_SERVER_MANAGED' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_guard_consent
  before insert or update on public.profiles
  for each row execute function public.guard_profile_consent();

-- Records that the caller accepted the given version of the wording, now.
-- (A version dated more than a day ahead is refused; the day of slack covers
-- a build dated in a timezone ahead of the database's UTC date.)
create function public.record_special_category_consent(p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_version is null or p_version !~ '^\d{4}-\d{2}-\d{2}$' or p_version > to_char(current_date + 1, 'YYYY-MM-DD') then
    raise exception 'INVALID_CONSENT_VERSION' using errcode = '22023';
  end if;

  update public.profiles
  set special_category_consent = true,
      special_category_consent_at = now(),
      special_category_consent_version = p_version
  where user_id = auth.uid() and deleted_at is null;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.record_special_category_consent(text) from anon, authenticated, public;
grant execute on function public.record_special_category_consent(text) to authenticated;

-- 2. Same function as before; only the ethnicity column differs. (create or
--    replace keeps the existing grants.)
create or replace function public.get_profile_detail(p_profile_id uuid)
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
  photo_keys text[],
  private_photo_count int,
  photo_access_status text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_caller_profile_id uuid;
  v_caller_shares boolean;
  v_can_view boolean;
  v_access_status text;
begin
  select p.id, p.show_online_status into v_caller_profile_id, v_caller_shares
  from public.profiles p
  where p.user_id = auth.uid() and p.moderation_status = 'approved' and p.deleted_at is null;

  if v_caller_profile_id is null then
    raise exception 'PROFILE_NOT_APPROVED' using errcode = '42501';
  end if;

  v_can_view := public.can_view_private_photos(v_caller_profile_id, p_profile_id);

  select case when pa.status = 'granted' then 'granted' else 'pending' end
  into v_access_status
  from public.photo_access pa
  where pa.owner_profile_id = p_profile_id and pa.viewer_profile_id = v_caller_profile_id;
  v_access_status := coalesce(v_access_status, 'none');

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
    -- Ethnicity is only shown once the member has consented to wording that
    -- covers it (see the comment at the top of this migration).
    case when p.special_category_consent_version >= '2026-11-15' then p.ethnicity::text else null end,
    p.religion::text, p.religiosity_level::text, p.languages_spoken,
    p.relationship_goal::text, p.smoker::text, p.drinker::text, p.has_children, p.wants_children::text,
    coalesce(
      (select array_agg(pp.storage_key order by pp.position)
       from public.profile_photos pp
       where pp.profile_id = p.id
         and pp.moderation_status = 'approved'
         and (pp.visibility = 'public' or v_can_view)),
      '{}'
    ) as photo_keys,
    (
      select count(*)::int
      from public.profile_photos pp
      where pp.profile_id = p.id
        and pp.moderation_status = 'approved'
        and pp.visibility = 'private'
        and not v_can_view
    ) as private_photo_count,
    v_access_status
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
