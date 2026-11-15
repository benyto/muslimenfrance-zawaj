-- Edits to the two free-text fields of an approved profile ("about me" and
-- "what I'm looking for") must be validated by a moderator before anyone else
-- sees them. New photos already work this way (they start as 'pending' and
-- only approved ones are shown to others).
--
-- While an edit waits, the profile stays visible with its last approved text:
-- the new text is held in *_pending, which nothing but the author and
-- moderators can read. Approving moves it into place; rejecting discards it.
--
-- This is enforced here, not in the web form: members write to `profiles`
-- straight from the browser, so the rule has to hold for any client.
alter table public.profiles
  add column bio_pending text check (char_length(bio_pending) <= 1000),
  add column looking_for_pending text check (char_length(looking_for_pending) <= 1000),
  -- Bumped whenever the pending text changes. A moderator's decision carries
  -- the version they were shown, so approving cannot apply text the member
  -- rewrote a moment earlier and the moderator never saw.
  add column text_review_version int not null default 0;

create index profiles_pending_texts_idx on public.profiles (id)
  where bio_pending is not null or looking_for_pending is not null;

-- ---------------------------------------------------------------------
-- Guard: a member cannot change these fields directly.
-- Applies to the browser's own role only. The functions below are SECURITY
-- DEFINER (they run as their owner) and the API's service role is a different
-- role, so both pass untouched; moderators are let through explicitly.
-- ---------------------------------------------------------------------
create function public.guard_profile_texts()
returns trigger
language plpgsql
as $$
begin
  if current_user <> 'authenticated' or public.is_admin_or_moderator(auth.uid()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A new profile is reviewed as a whole; nothing can be "pending" on it yet.
    new.bio_pending := null;
    new.looking_for_pending := null;
    new.text_review_version := 0;
    return new;
  end if;

  if new.bio_pending is distinct from old.bio_pending
     or new.looking_for_pending is distinct from old.looking_for_pending
     or new.text_review_version is distinct from old.text_review_version then
    raise exception 'PROFILE_TEXT_PENDING_IS_SERVER_MANAGED' using errcode = '42501';
  end if;

  if old.moderation_status = 'approved'
     and (new.bio is distinct from old.bio or new.looking_for is distinct from old.looking_for) then
    raise exception 'PROFILE_TEXT_REQUIRES_REVIEW' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger trg_profiles_guard_texts
  before insert or update on public.profiles
  for each row execute function public.guard_profile_texts();

-- ---------------------------------------------------------------------
-- The member's way to save these two fields.
--   * Profile not approved yet (pending / rejected): written straight in —
--     the whole profile is reviewed anyway.
--   * Approved: a changed text becomes pending and the live text stays.
--     Clearing a field applies at once (nothing to review), and typing the
--     live text back cancels the pending change.
-- ---------------------------------------------------------------------
create function public.submit_profile_texts(p_bio text, p_looking_for text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.profiles;
  v_bio text := nullif(btrim(p_bio), '');
  v_looking_for text := nullif(btrim(p_looking_for), '');
  v_live_bio text;
  v_live_looking_for text;
  v_pending_bio text;
  v_pending_looking_for text;
begin
  if char_length(v_bio) > 1000 or char_length(v_looking_for) > 1000 then
    raise exception 'TEXT_TOO_LONG' using errcode = '22023';
  end if;

  select * into v from public.profiles
  where user_id = auth.uid() and deleted_at is null
  for update;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v.moderation_status <> 'approved' then
    update public.profiles
    set bio = v_bio, looking_for = v_looking_for, bio_pending = null, looking_for_pending = null
    where id = v.id;
    return;
  end if;

  -- Blank: applied now. Same as what is live: nothing to review. Otherwise: pending.
  v_live_bio := case when v_bio is null then null else v.bio end;
  v_live_looking_for := case when v_looking_for is null then null else v.looking_for end;
  v_pending_bio := case
    when v_bio is null or v_bio is not distinct from nullif(btrim(v.bio), '') then null
    else v_bio
  end;
  v_pending_looking_for := case
    when v_looking_for is null or v_looking_for is not distinct from nullif(btrim(v.looking_for), '') then null
    else v_looking_for
  end;

  update public.profiles
  set bio = v_live_bio,
      looking_for = v_live_looking_for,
      bio_pending = v_pending_bio,
      looking_for_pending = v_pending_looking_for,
      text_review_version = case
        when (v_pending_bio, v_pending_looking_for) is distinct from (v.bio_pending, v.looking_for_pending)
        then v.text_review_version + 1
        else v.text_review_version
      end
  where id = v.id;
end;
$$;

revoke execute on function public.submit_profile_texts(text, text) from anon, authenticated, public;
grant execute on function public.submit_profile_texts(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- A moderator's decision. Server-only: the API checks the caller's role,
-- writes the audit entry and emails the member.
-- ---------------------------------------------------------------------
create function public.review_profile_texts(p_profile_id uuid, p_approve boolean, p_expected_version int)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.profiles;
begin
  select * into v from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v.bio_pending is null and v.looking_for_pending is null then
    raise exception 'NO_PENDING_TEXT' using errcode = 'P0002';
  end if;
  if v.text_review_version <> p_expected_version then
    raise exception 'STALE_REVIEW' using errcode = '40001';
  end if;

  update public.profiles
  set bio = case when p_approve and bio_pending is not null then bio_pending else bio end,
      looking_for = case when p_approve and looking_for_pending is not null then looking_for_pending else looking_for end,
      bio_pending = null,
      looking_for_pending = null
  where id = p_profile_id
  returning * into v;
  return v;
end;
$$;

revoke execute on function public.review_profile_texts(uuid, boolean, int) from anon, authenticated, public;
grant execute on function public.review_profile_texts(uuid, boolean, int) to service_role;

-- ---------------------------------------------------------------------
-- Moderators' list: flag profiles with a text edit waiting, and let them be
-- filtered with the pseudo-status 'texts_pending'.
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
  has_pending_texts boolean,
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
    (p.bio_pending is not null or p.looking_for_pending is not null),
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
  where (
      p_status is null or p_status = 'all'
      -- Not a moderation status: profiles whose text edit is waiting for review.
      or (p_status = 'texts_pending' and (p.bio_pending is not null or p.looking_for_pending is not null))
      or p.moderation_status = p_status
    )
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
