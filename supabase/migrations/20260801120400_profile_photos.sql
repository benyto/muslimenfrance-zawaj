-- Stores the UploadThing file key, never a public URL — reads happen
-- exclusively through server-generated short-TTL signed URLs (see
-- search_profiles() and the uploadthing-callback/uploadthing-delete Edge
-- Functions added in later phases). No table grant exists for viewing
-- another profile's photos.

create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  uploadthing_key text not null,
  position int not null default 0,

  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  moderated_by uuid references auth.users(id),
  moderated_at timestamptz,

  created_at timestamptz not null default now()
);

create index profile_photos_profile_idx on public.profile_photos (profile_id);
create index profile_photos_position_idx on public.profile_photos (profile_id, position);
create index profile_photos_moderation_status_idx on public.profile_photos (moderation_status);

alter table public.profile_photos enable row level security;

revoke all on public.profile_photos from authenticated;
grant select, insert, update, delete on public.profile_photos to authenticated;

create policy "profile_photos owner select"
  on public.profile_photos for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));

-- Photos are normally created by the uploadthing-callback Edge Function
-- (service_role, bypasses RLS) right after a signed upload completes. This
-- policy exists as a fallback client-insert path, but still forces every
-- new row to start unmoderated — an owner can never insert a pre-approved
-- photo for themselves.
create policy "profile_photos owner insert"
  on public.profile_photos for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid())
    and moderation_status = 'pending'
    and moderated_by is null
    and moderated_at is null
  );

-- Owners may only reorder photos (`position`) — moderation fields stay
-- locked to their prior values, same pattern as public.profiles above.
create policy "profile_photos owner update position"
  on public.profile_photos for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()))
  with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid())
    and moderation_status is not distinct from (select pp.moderation_status from public.profile_photos pp where pp.id = profile_photos.id)
    and moderated_by is not distinct from (select pp.moderated_by from public.profile_photos pp where pp.id = profile_photos.id)
    and moderated_at is not distinct from (select pp.moderated_at from public.profile_photos pp where pp.id = profile_photos.id)
  );

create policy "profile_photos owner delete"
  on public.profile_photos for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid()));

create policy "profile_photos admin all"
  on public.profile_photos for all
  to authenticated
  using (public.is_admin_or_moderator(auth.uid()))
  with check (public.is_admin_or_moderator(auth.uid()));
