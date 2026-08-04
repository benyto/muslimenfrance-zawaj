-- Favorites: a simple bookmark, same shape/RLS pattern as user_blocks
-- (20260801120500_user_blocks.sql) — owner-only table-level grant, no
-- column tricks needed since the whole row is either the caller's or it
-- isn't. No extra "is this profile blocked" guard on insert: a blocked
-- profile is already unreachable via get_profile_detail (it raises
-- PROFILE_NOT_FOUND), which is the only place the favorite toggle lives,
-- so the case can't come up in practice.

create table public.profile_favorites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  favorited_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint profile_favorites_no_self check (profile_id <> favorited_profile_id),
  constraint profile_favorites_unique unique (profile_id, favorited_profile_id)
);

create index profile_favorites_profile_idx on public.profile_favorites (profile_id);
create index profile_favorites_favorited_idx on public.profile_favorites (favorited_profile_id);

alter table public.profile_favorites enable row level security;

revoke all on public.profile_favorites from authenticated;
grant select, insert, delete on public.profile_favorites to authenticated;

create policy "profile_favorites owner select"
  on public.profile_favorites for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));

create policy "profile_favorites owner insert"
  on public.profile_favorites for insert
  to authenticated
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));

create policy "profile_favorites owner delete"
  on public.profile_favorites for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));

create policy "profile_favorites admin select"
  on public.profile_favorites for select
  to authenticated
  using (public.is_admin_or_moderator(auth.uid()));

-- Joined display data for the sidebar's Favoris tab — mirrors
-- get_my_conversations' primary-photo subquery. Excludes hard-deleted
-- profiles (a permanently deleted account shouldn't show up anywhere);
-- deliberately not filtered by moderation_status, same as conversations,
-- so a favorite doesn't just vanish while its owner is mid-re-review.
create function public.get_my_favorites()
returns table (
  favorited_profile_id uuid,
  nickname text,
  photo_key text,
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
