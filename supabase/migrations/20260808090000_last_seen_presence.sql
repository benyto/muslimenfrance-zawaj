-- Replace realtime Presence (a single global "presence:app" channel every
-- opted-in client joined) with a last-seen-at heartbeat: cheaper at scale.
-- Realtime messages bill per-delivery-per-subscriber, so the global
-- channel's join/leave/sync fan-out scaled with concurrent-user-count ×
-- churn — fine at launch, but a real line item once more than a handful of
-- people are online at once. A polled timestamp has none of that fan-out
-- cost: it's a plain column already sitting on rows these RPCs fetch
-- anyway, no separate channel or subscriber count involved.
--
-- profiles.last_seen_at is bumped by the client on a throttled heartbeat
-- (useLastSeenHeartbeat) roughly once a minute while show_online_status is
-- on and the tab is visible. "Online" is then just "last_seen_at within the
-- last couple of minutes", computed client-side (usePresenceFromLastSeen) —
-- no polling loop needed server-side.

alter table public.profiles
  add column last_seen_at timestamptz;

-- The shared set_updated_at() trigger (used by several tables) would bump
-- updated_at on every heartbeat write, and search_profiles() orders by
-- updated_at desc — silently turning "recently edited" into "has the app
-- open right now". profiles gets its own trigger function that leaves
-- updated_at untouched when last_seen_at is the only thing that changed;
-- every other table keeps using the shared one unmodified.
drop trigger trg_profiles_updated_at on public.profiles;

create function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  if (to_jsonb(new) - 'updated_at' - 'last_seen_at') = (to_jsonb(old) - 'updated_at' - 'last_seen_at') then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_profiles_updated_at();

-- get_my_conversations, get_my_favorites and get_profile_detail: swap the
-- other party's show_online_status boolean for their last_seen_at, computed
-- server-side with reciprocity baked in (null unless BOTH the caller and
-- the other profile have show_online_status on) rather than left to the
-- client — there's no channel-join left to piggyback the privacy rule on.

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
      where pp.profile_id = op.id and pp.moderation_status = 'approved'
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
  where c.profile1_id = v_caller_profile_id or c.profile2_id = v_caller_profile_id
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
      where pp.profile_id = fp.id and pp.moderation_status = 'approved'
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
