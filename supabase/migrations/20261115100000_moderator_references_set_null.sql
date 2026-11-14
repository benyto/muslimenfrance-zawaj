-- A moderator or admin could not be deleted once they had acted on anything.
--
-- profiles.moderated_by, profile_photos.moderated_by, reports.reviewed_by and
-- admin_audit_log.admin_user_id all pointed at auth.users with no delete rule,
-- so removing that user was refused by the database (the auth API answered
-- with a bare 500). Erasure under GDPR applies to staff as much as to members,
-- and the same would have blocked any future cleanup of a moderator account.
--
-- They become ON DELETE SET NULL: the moderated profile, photo, report and
-- audit entry all stay — only the pointer to the person who acted is dropped,
-- which is what anonymising the actor means. The audit trail keeps what was
-- done, to what, and when.
alter table public.profiles
  drop constraint profiles_moderated_by_fkey,
  add constraint profiles_moderated_by_fkey
    foreign key (moderated_by) references auth.users(id) on delete set null;

alter table public.profile_photos
  drop constraint profile_photos_moderated_by_fkey,
  add constraint profile_photos_moderated_by_fkey
    foreign key (moderated_by) references auth.users(id) on delete set null;

alter table public.reports
  drop constraint reports_reviewed_by_fkey,
  add constraint reports_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users(id) on delete set null;

alter table public.admin_audit_log
  alter column admin_user_id drop not null,
  drop constraint admin_audit_log_admin_user_id_fkey,
  add constraint admin_audit_log_admin_user_id_fkey
    foreign key (admin_user_id) references auth.users(id) on delete set null;
