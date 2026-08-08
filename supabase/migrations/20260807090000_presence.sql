-- Online/offline presence, WhatsApp-style: a per-profile opt-in
-- (show_online_status, default true) that's reciprocal by construction on
-- the client — see usePresenceChannel — rather than enforced here. This
-- column just needs to be visible to whoever's looking at a given profile,
-- same as nickname/photo, so the badge can be suppressed when the *other*
-- person has it off regardless of the viewer's own setting.

alter table public.profiles
  add column show_online_status boolean not null default true;

-- get_my_conversations, get_my_favorites and get_profile_detail all need
-- the other party's show_online_status alongside what they already return,
-- so each is dropped and recreated with one added column — same pattern as
-- every other change to these functions.

drop function public.get_my_conversations();

create function public.get_my_conversations()
returns table (
  conversation_id uuid,
  other_profile_id uuid,
  other_nickname text,
  other_photo_key text,
  other_show_online_status boolean,
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
begin
  select p.id into v_caller_profile_id from public.profiles p where p.user_id = auth.uid();
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
    op.show_online_status,
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
  show_online_status boolean,
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
begin
  select p.id into v_caller_profile_id from public.profiles p where p.user_id = auth.uid();
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
    fp.show_online_status,
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
  show_online_status boolean,
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
    p.show_online_status,
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
