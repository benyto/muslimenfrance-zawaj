-- Admin profile search: nickname is on public.profiles, but email lives on
-- auth.users, which isn't exposed through the client's PostgREST schema —
-- there's no "select email from profiles" path available to a regular
-- client session, admin or not. A security-definer function is the
-- standard way around that: it runs with the function owner's privileges,
-- so it can read auth.users directly regardless of the caller's own grants,
-- while still re-checking is_admin_or_moderator() itself rather than
-- trusting the client-side RequireAdmin gate.
--
-- Also folds in pagination (count(*) over() returns the full match count
-- alongside each page's rows in one query, rather than a separate count
-- round-trip) since the old useAdminProfiles() fetched every matching row
-- with no limit at all.

create function public.admin_search_profiles(
  p_search text default null,
  p_status text default null,
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
    p.created_at,
    (
      select pp.uploadthing_key
      from public.profile_photos pp
      where pp.profile_id = p.id
      order by pp.position
      limit 1
    ),
    count(*) over() as total_count
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where (p_status is null or p_status = 'all' or p.moderation_status = p_status)
    and (
      p_search is null or btrim(p_search) = '' or
      p.nickname ilike '%' || p_search || '%' or
      u.email ilike '%' || p_search || '%'
    )
  order by p.created_at desc
  limit p_limit offset p_offset;
end;
$$;

revoke execute on function public.admin_search_profiles(text, text, int, int) from anon, authenticated, public;
grant execute on function public.admin_search_profiles(text, text, int, int) to authenticated;
