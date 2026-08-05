-- Adds subscription status to the admin profile search/list — free-launch
-- mode means it's null for nearly everyone today, but the column and the
-- filter need to exist before subscriptions are actually turned on, not
-- bolted on after real subscribers show up.

drop function public.admin_search_profiles(text, text, int, int);

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
      select pp.uploadthing_key
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
