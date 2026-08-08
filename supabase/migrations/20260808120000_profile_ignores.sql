-- "Ignore": one-directional, deliberately distinct from user_blocks
-- (mutual — both parties vanish from each other's search results and
-- neither can message the other). Ignoring someone only changes the
-- ignorer's own experience: the ignored profile drops out of the ignorer's
-- own search results and their messages stop landing in the ignorer's
-- inbox/toasts going forward — but the ignored party is never told, still
-- sees the ignorer normally in their own searches, and can still send
-- (their POST /messages succeeds; the row is written same as any other
-- message) — it's just that get_my_conversations() no longer surfaces that
-- conversation to the ignorer, so it never shows up in their list, unread
-- count, or realtime toast. Same table/RLS shape as profile_favorites.

create table public.profile_ignores (
  id uuid primary key default gen_random_uuid(),
  ignorer_profile_id uuid not null references public.profiles(id) on delete cascade,
  ignored_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint profile_ignores_no_self check (ignorer_profile_id <> ignored_profile_id),
  constraint profile_ignores_unique unique (ignorer_profile_id, ignored_profile_id)
);

create index profile_ignores_ignorer_idx on public.profile_ignores (ignorer_profile_id);
create index profile_ignores_ignored_idx on public.profile_ignores (ignored_profile_id);

alter table public.profile_ignores enable row level security;

revoke all on public.profile_ignores from authenticated;
grant select, insert, delete on public.profile_ignores to authenticated;

create policy "profile_ignores owner select"
  on public.profile_ignores for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = ignorer_profile_id and p.user_id = auth.uid()));

create policy "profile_ignores owner insert"
  on public.profile_ignores for insert
  to authenticated
  with check (exists (select 1 from public.profiles p where p.id = ignorer_profile_id and p.user_id = auth.uid()));

create policy "profile_ignores owner delete"
  on public.profile_ignores for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = ignorer_profile_id and p.user_id = auth.uid()));

create policy "profile_ignores admin select"
  on public.profile_ignores for select
  to authenticated
  using (public.is_admin_or_moderator(auth.uid()));

-- One-directional, unlike is_profile_blocked's OR-both-directions check —
-- "does p_ignorer_profile_id currently ignore p_ignored_profile_id".
create function public.is_profile_ignored(p_ignorer_profile_id uuid, p_ignored_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profile_ignores
    where ignorer_profile_id = p_ignorer_profile_id and ignored_profile_id = p_ignored_profile_id
  );
$$;

revoke execute on function public.is_profile_ignored(uuid, uuid) from anon, authenticated, public;
grant execute on function public.is_profile_ignored(uuid, uuid) to authenticated;

-- "Who have I ignored" — for the Settings "Profils ignorés" list, same
-- shape as get_my_blocked_profiles().
create function public.get_my_ignored_profiles()
returns table (ignored_profile_id uuid, nickname text, ignored_at timestamptz)
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
  select pi.ignored_profile_id, p.nickname::text, pi.created_at as ignored_at
  from public.profile_ignores pi
  join public.profiles p on p.id = pi.ignored_profile_id
  where pi.ignorer_profile_id = v_caller_profile_id
  order by pi.created_at desc;
end;
$$;

revoke execute on function public.get_my_ignored_profiles() from anon, authenticated, public;
grant execute on function public.get_my_ignored_profiles() to authenticated;

-- search_profiles: drop the ignorer's own ignored profiles from their own
-- results (one-directional — an ignored profile still sees the ignorer
-- normally in *their* search). Signature/return shape unchanged.
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
    and not public.is_profile_blocked(v_caller_profile_id, p.id)
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

-- get_my_conversations: drop conversations with a profile the caller has
-- ignored from the caller's own list (and therefore from their unread
-- count and the realtime inbox toast, both of which are driven off this
-- same query / the client-side ignored-ids cache — see
-- apps/web/app/lib/realtime/useInboxSubscription.ts). The other party's own
-- get_my_conversations() is untouched — they still see the conversation.
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
  where (c.profile1_id = v_caller_profile_id or c.profile2_id = v_caller_profile_id)
    and not public.is_profile_ignored(v_caller_profile_id, op.id)
  order by c.last_message_at desc;
end;
$$;

revoke execute on function public.get_my_conversations() from anon, authenticated, public;
grant execute on function public.get_my_conversations() to authenticated;
