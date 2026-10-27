-- Private photos: each photo is `public` (default — every approved member
-- sees it, exactly as before) or `private` (only members the owner has
-- explicitly allowed). Access is per *member*, not per photo: granting
-- someone access unlocks all of the owner's private photos for them.
--
-- Enforcement lives in the RPCs, not in the client. profile_photos has no
-- cross-user SELECT grant, so the only way a member ever learns another
-- member's photo key is through get_profile_detail / search_profiles /
-- get_my_conversations / get_my_favorites — all of which now leave private
-- keys out unless the caller holds a grant. Honest limit: files are still
-- public-read on UploadThing (see the TODO(private mode) in
-- apps/api/src/uploadthing/router.ts), so the protection is "the key is
-- never handed out", not "the URL is cryptographically gated" — someone who
-- was granted access and saved a URL keeps it after a revoke. Closing that
-- needs UploadThing private ACL + signed URLs.

alter table public.profile_photos
  add column visibility text not null default 'public'
    check (visibility in ('public', 'private'));

-- Owners may flip visibility; every other column stays frozen by the
-- column-level grant from 20260802150000_lock_down_client_updates.sql.
grant update (visibility) on public.profile_photos to authenticated;

-- ---------------------------------------------------------------------
-- Grants / requests. One row per (owner, viewer):
--   pending  — viewer asked, owner hasn't answered
--   granted  — viewer can see the owner's private photos
--   denied   — owner declined or later revoked. Deliberately silent: the
--              viewer keeps seeing "request sent" rather than a rejection,
--              same philosophy as ignore, and can't spam new requests.
-- No client grants at all — everything goes through the RPCs below, so a
-- viewer can never write their own `granted` row.
-- ---------------------------------------------------------------------
create table public.photo_access (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  viewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'granted', 'denied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint photo_access_no_self check (owner_profile_id <> viewer_profile_id),
  constraint photo_access_unique unique (owner_profile_id, viewer_profile_id)
);

create index photo_access_owner_idx on public.photo_access (owner_profile_id, status);
create index photo_access_viewer_idx on public.photo_access (viewer_profile_id);

create trigger trg_photo_access_updated_at
  before update on public.photo_access
  for each row execute function public.set_updated_at();

alter table public.photo_access enable row level security;
revoke all on public.photo_access from authenticated;
grant select on public.photo_access to authenticated;

create policy "photo_access admin select"
  on public.photo_access for select
  to authenticated
  using (public.is_admin_or_moderator(auth.uid()));

create function public.can_view_private_photos(p_viewer_profile_id uuid, p_owner_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.photo_access
    where owner_profile_id = p_owner_profile_id
      and viewer_profile_id = p_viewer_profile_id
      and status = 'granted'
  );
$$;

revoke execute on function public.can_view_private_photos(uuid, uuid) from anon, authenticated, public;
grant execute on function public.can_view_private_photos(uuid, uuid) to authenticated;

-- Viewer asks for access. Idempotent and silent about prior outcomes: if a
-- row already exists in any state, nothing changes.
create function public.request_photo_access(p_owner_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
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

  if v_caller_profile_id = p_owner_profile_id then
    raise exception 'INVALID_REQUEST' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_owner_profile_id and p.moderation_status = 'approved' and p.deleted_at is null
  ) then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.photo_access (owner_profile_id, viewer_profile_id, status)
  values (p_owner_profile_id, v_caller_profile_id, 'pending')
  on conflict (owner_profile_id, viewer_profile_id) do nothing;
end;
$$;

revoke execute on function public.request_photo_access(uuid) from anon, authenticated, public;
grant execute on function public.request_photo_access(uuid) to authenticated;

-- Owner decides, for one specific member: grant (also usable proactively,
-- without a prior request) or withdraw/decline. The caller is always the
-- owner — there is no parameter to act as someone else.
create function public.set_photo_access(p_viewer_profile_id uuid, p_grant boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_profile_id uuid;
begin
  select p.id into v_owner_profile_id
  from public.profiles p
  where p.user_id = auth.uid() and p.deleted_at is null;

  if v_owner_profile_id is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_owner_profile_id = p_viewer_profile_id then
    raise exception 'INVALID_REQUEST' using errcode = '22023';
  end if;

  if p_grant then
    if not exists (
      select 1 from public.profiles p
      where p.id = p_viewer_profile_id and p.moderation_status = 'approved' and p.deleted_at is null
    ) then
      raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
    end if;

    insert into public.photo_access (owner_profile_id, viewer_profile_id, status)
    values (v_owner_profile_id, p_viewer_profile_id, 'granted')
    on conflict (owner_profile_id, viewer_profile_id) do update set status = 'granted';
  else
    update public.photo_access
    set status = 'denied'
    where owner_profile_id = v_owner_profile_id and viewer_profile_id = p_viewer_profile_id;
  end if;
end;
$$;

revoke execute on function public.set_photo_access(uuid, boolean) from anon, authenticated, public;
grant execute on function public.set_photo_access(uuid, boolean) to authenticated;

-- The owner's side: open requests plus current grants. Requests from
-- members the owner has ignored are left out (ignore means "I don't want to
-- hear from them" — a request is hearing from them); existing grants always
-- show so they can still be revoked.
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
      select pp.uploadthing_key
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
-- Every RPC that hands out photo keys, now visibility-aware. Bodies are
-- otherwise identical to their previous definitions (search_profiles /
-- get_profile_detail: 20260808130000, get_my_conversations: 20260808120000,
-- get_my_favorites: 20260808090000).
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
    ph.uploadthing_key as primary_photo_key
  from public.profiles p
  left join public.communes_fr cf on cf.code_insee = p.commune_insee_code
  left join lateral (
    select pp.uploadthing_key
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
      select pp.uploadthing_key
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
      select pp.uploadthing_key
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
      (select array_agg(pp.uploadthing_key order by pp.position)
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
