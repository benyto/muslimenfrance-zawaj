-- Photos: switch to Supabase Storage (step 2 of 2).
--
-- Step 1 (20261114100000) added the private bucket and profile_photos.storage_key;
-- scripts/migration/09-photos-to-supabase-storage.ts then copied every existing
-- photo into it. This step points everything at storage_key and drops the
-- UploadThing key. The RPCs keep their output names (photo_key, photo_keys,
-- primary_photo_key) — those values are now "<profile_id>/<photo_id>", from
-- which the client derives the thumb/display object paths and asks Storage for
-- a signed URL. Bodies are otherwise identical to their previous definitions.

-- Fails (and rolls everything back) if any photo was not copied.
alter table public.profile_photos
  alter column storage_key set not null;

-- Backstop for the API's own 10-photo limit: concurrent uploads could each
-- see "9" and both insert. The advisory lock serialises inserts per profile.
create function public.enforce_max_photos()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.profile_id::text, 0));
  if (select count(*) from public.profile_photos where profile_id = new.profile_id) >= 10 then
    raise exception 'MAX_PHOTOS' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_profile_photos_max
  before insert on public.profile_photos
  for each row execute function public.enforce_max_photos();

-- ---------------------------------------------------------------------
-- Owner's view of who asked for / holds access to their private photos
-- ---------------------------------------------------------------------
drop function public.get_my_photo_access();

create function public.get_my_photo_access()
returns table (
  viewer_profile_id uuid,
  nickname text,
  photo_key text,
  status text,
  updated_at timestamptz
)
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
  select
    pa.viewer_profile_id,
    vp.nickname::text,
    (
      select pp.storage_key
      from public.profile_photos pp
      where pp.profile_id = vp.id and pp.moderation_status = 'approved' and pp.visibility = 'public'
      order by pp.position
      limit 1
    ),
    pa.status,
    pa.updated_at
  from public.photo_access pa
  join public.profiles vp on vp.id = pa.viewer_profile_id
  where pa.owner_profile_id = v_caller_profile_id
    and pa.status in ('pending', 'granted')
    and vp.deleted_at is null
    and (pa.status = 'granted' or not public.is_profile_ignored(v_caller_profile_id, vp.id))
  order by (pa.status = 'pending') desc, pa.updated_at desc;
end;
$$;

revoke execute on function public.get_my_photo_access() from anon, authenticated, public;
grant execute on function public.get_my_photo_access() to authenticated;

-- ---------------------------------------------------------------------
-- search_profiles, get_my_conversations, get_my_favorites, get_profile_detail
-- ---------------------------------------------------------------------
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
    ph.storage_key as primary_photo_key
  from public.profiles p
  left join public.communes_fr cf on cf.code_insee = p.commune_insee_code
  left join lateral (
    select pp.storage_key
    from public.profile_photos pp
    where pp.profile_id = p.id
      and pp.moderation_status = 'approved'
      and (pp.visibility = 'public' or public.can_view_private_photos(v_caller_profile_id, p.id))
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

drop function public.get_my_conversations();

create function public.get_my_conversations()
returns table (
  conversation_id uuid,
  other_profile_id uuid,
  other_nickname text,
  other_photo_key text,
  other_last_seen_at timestamptz,
  last_message_at timestamptz,
  last_message_content text,
  last_message_sender_profile_id uuid,
  unread_count bigint
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
  from public.profiles p where p.user_id = auth.uid();
  if v_caller_profile_id is null then
    return;
  end if;

  return query
  select
    c.id,
    op.id,
    op.nickname::text,
    (
      select pp.storage_key
      from public.profile_photos pp
      where pp.profile_id = op.id
        and pp.moderation_status = 'approved'
        and (pp.visibility = 'public' or public.can_view_private_photos(v_caller_profile_id, op.id))
      order by pp.position
      limit 1
    ),
    case when v_caller_shares and op.show_online_status then op.last_seen_at else null end,
    c.last_message_at,
    c.last_message_content,
    c.last_message_sender_profile_id,
    (
      select count(*)
      from public.messages m
      where m.conversation_id = c.id
        and m.recipient_profile_id = v_caller_profile_id
        and m.is_read = false
    )
  from public.conversations c
  join public.profiles op
    on op.id = case when c.profile1_id = v_caller_profile_id then c.profile2_id else c.profile1_id end
  where (c.profile1_id = v_caller_profile_id or c.profile2_id = v_caller_profile_id)
    and not public.is_profile_ignored(v_caller_profile_id, op.id)
  order by c.last_message_at desc;
end;
$$;

revoke execute on function public.get_my_conversations() from anon, authenticated, public;
grant execute on function public.get_my_conversations() to authenticated;

drop function public.get_my_favorites();

create function public.get_my_favorites()
returns table (
  favorited_profile_id uuid,
  nickname text,
  photo_key text,
  last_seen_at timestamptz,
  commune_nom text,
  favorited_at timestamptz
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
  from public.profiles p where p.user_id = auth.uid();
  if v_caller_profile_id is null then
    return;
  end if;

  return query
  select
    fp.id,
    fp.nickname::text,
    (
      select pp.storage_key
      from public.profile_photos pp
      where pp.profile_id = fp.id
        and pp.moderation_status = 'approved'
        and (pp.visibility = 'public' or public.can_view_private_photos(v_caller_profile_id, fp.id))
      order by pp.position
      limit 1
    ),
    case when v_caller_shares and fp.show_online_status then fp.last_seen_at else null end,
    cf.nom_standard::text,
    pf.created_at
  from public.profile_favorites pf
  join public.profiles fp on fp.id = pf.favorited_profile_id
  left join public.communes_fr cf on cf.code_insee = fp.commune_insee_code
  where pf.profile_id = v_caller_profile_id
    and fp.deleted_at is null
  order by pf.created_at desc;
end;
$$;

revoke execute on function public.get_my_favorites() from anon, authenticated, public;
grant execute on function public.get_my_favorites() to authenticated;

-- get_profile_detail additionally reports what the caller *can't* see
-- (private_photo_count) and where they stand on asking for it
-- (photo_access_status: none | pending | granted — a declined/revoked
-- request is reported as pending on purpose, see photo_access above).
-- The owner previewing their own profile gets the stranger's view: no grant
-- to themselves exists, so their private photos count as hidden — matching
-- the "voici comment votre profil apparaît aux autres membres" banner.
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
    p.ethnicity::text, p.religion::text, p.religiosity_level::text, p.languages_spoken,
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

revoke execute on function public.get_profile_detail(uuid) from anon, authenticated, public;
grant execute on function public.get_profile_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Admin profile list
-- ---------------------------------------------------------------------
drop function public.admin_search_profiles(text, text, text, int, int);

create function public.admin_search_profiles(
  p_search text default null,
  p_status text default null,
  p_subscription_status text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  nickname text,
  email text,
  gender text,
  birthdate date,
  moderation_status text,
  subscription_status text,
  created_at timestamptz,
  primary_photo_key text,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin_or_moderator(auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_limit is null or p_limit > 100 then
    p_limit := 100;
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
    u.email::text,
    p.gender::text,
    p.birthdate,
    p.moderation_status::text,
    us.status,
    p.created_at,
    (
      select pp.storage_key
      from public.profile_photos pp
      where pp.profile_id = p.id
      order by pp.position
      limit 1
    ),
    count(*) over() as total_count
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join lateral (
    select s.status
    from public.user_subscriptions s
    where s.user_id = p.user_id
    order by s.created_at desc
    limit 1
  ) us on true
  where (p_status is null or p_status = 'all' or p.moderation_status = p_status)
    and (
      p_search is null or btrim(p_search) = '' or
      p.nickname ilike '%' || p_search || '%' or
      u.email ilike '%' || p_search || '%'
    )
    and (
      p_subscription_status is null or p_subscription_status = 'all' or
      (p_subscription_status = 'none' and us.status is null) or
      us.status = p_subscription_status
    )
  order by p.created_at desc
  limit p_limit offset p_offset;
end;
$$;

revoke execute on function public.admin_search_profiles(text, text, text, int, int) from anon, authenticated, public;
grant execute on function public.admin_search_profiles(text, text, text, int, int) to authenticated;

-- ---------------------------------------------------------------------
-- Nothing reads the UploadThing key any more. (Drops its unique constraint
-- with it.) The files themselves are untouched on UploadThing.
-- ---------------------------------------------------------------------
alter table public.profile_photos drop column uploadthing_key;
