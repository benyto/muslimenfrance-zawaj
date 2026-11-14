-- Photos move from UploadThing (public-read files) to Supabase Storage, in two
-- steps so the app keeps working in between. This is step 1 and only adds:
-- a private bucket, the rule for who may read an object, and the column that
-- will hold each photo's storage key. Step 2 (after the existing photos have
-- been copied over) switches the RPCs to that column and drops
-- uploadthing_key.
--
-- Layout: every photo is two objects in the private `profile-photos` bucket,
--   <profile_id>/<photo_id>/thumb.webp     (grid cards, avatars)
--   <profile_id>/<photo_id>/display.webp   (profile view, lightbox)
-- and profile_photos.storage_key is "<profile_id>/<photo_id>". Both are
-- written by the API after it has decoded and re-encoded the upload (EXIF/GPS
-- dropped), so what is stored is never the raw file.

alter table public.profile_photos
  add column storage_key text,
  add constraint profile_photos_storage_key_unique unique (storage_key);

-- Private, WebP only, capped well above what the API produces (~0.3 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 3145728, array['image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Who may read an object. This is the one rule that decides signing: a signed
-- URL can only be created for an object the SELECT policy below lets the
-- caller read, so a leaked path is worthless to anyone this says no to — and
-- withdrawing access takes effect at the next signing instead of never.
--   * the photo's owner, whatever its moderation state
--   * admins and moderators (they review every photo)
--   * any other approved member, if the photo is approved, its owner's profile
--     is approved and live, and the photo is public — or private and the owner
--     has granted this member access (photo_access)
-- SECURITY DEFINER because it has to read profiles / profile_photos, which RLS
-- keeps owner-only, on behalf of whoever is asking.
create function public.can_read_photo_object(p_object_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_key text := split_part(p_object_name, '/', 1) || '/' || split_part(p_object_name, '/', 2);
  v_photo record;
  v_viewer_profile_id uuid;
begin
  select pp.profile_id, pp.moderation_status, pp.visibility
  into v_photo
  from public.profile_photos pp
  where pp.storage_key = v_key;

  if not found then
    return false;
  end if;

  if public.is_admin_or_moderator(auth.uid()) then
    return true;
  end if;

  select p.id into v_viewer_profile_id
  from public.profiles p
  where p.user_id = auth.uid() and p.deleted_at is null;

  if v_viewer_profile_id is null then
    return false;
  end if;

  if v_viewer_profile_id = v_photo.profile_id then
    return true;
  end if;

  return v_photo.moderation_status = 'approved'
    and exists (
      select 1 from public.profiles me
      where me.id = v_viewer_profile_id and me.moderation_status = 'approved'
    )
    and exists (
      select 1 from public.profiles owner
      where owner.id = v_photo.profile_id and owner.moderation_status = 'approved' and owner.deleted_at is null
    )
    and (
      v_photo.visibility = 'public'
      or public.can_view_private_photos(v_viewer_profile_id, v_photo.profile_id)
    );
end;
$$;

revoke execute on function public.can_read_photo_object(text) from anon, public;
grant execute on function public.can_read_photo_object(text) to authenticated;

-- Read only. There is deliberately no INSERT/UPDATE/DELETE policy for members:
-- objects are written and removed by the API with the service role, after it
-- has validated the image and the owner.
create policy "profile photos readable by authorised members"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'profile-photos' and public.can_read_photo_object(name));
