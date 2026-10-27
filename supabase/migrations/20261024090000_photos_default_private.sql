-- New uploads start private. A photo is committed the moment it's uploaded
-- (UploadThing callback → profile_photos row), independent of the profile
-- form's Save button, so with a public default it would go live to everyone
-- as soon as a moderator approved it — before its owner ever chose. Private
-- by default means going public is always a deliberate act.
--
-- Only the default changes: existing rows keep whatever visibility they
-- already have, so photos that were public stay public.
alter table public.profile_photos
  alter column visibility set default 'private';
