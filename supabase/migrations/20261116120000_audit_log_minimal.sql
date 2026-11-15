-- The moderation audit log must not hold members' personal data.
--
-- Each entry used to store a full snapshot of the profile, photo or report
-- row that a moderator acted on (nickname, birth date, texts, a reporter's
-- description, user ids…) in before/after. Nothing reads those snapshots, but
-- the log deliberately outlives the people in it — so deleting an account left
-- all of that behind, which a right-to-erasure request cannot allow.
--
-- Entries now record only the decision: who, what, which record, when, and the
-- status it moved between. Once the member is gone, the target id points at
-- nothing, so what remains no longer identifies them.
--
-- 1. Scrub what is already there. Keep only the status values.
-- 2. Make it impossible to write more: a constraint allows nothing but those
--    keys in member-related entries. (Subscription-product entries hold pricing
--    configuration, not personal data, and are unrestricted.)

update public.admin_audit_log
set before = case
      when before ? 'moderation_status' then jsonb_build_object('moderation_status', before -> 'moderation_status')
      when before ? 'status' then jsonb_build_object('status', before -> 'status')
      else null
    end,
    after = case
      when after ? 'moderation_status' then jsonb_build_object('moderation_status', after -> 'moderation_status')
      when after ? 'status' then jsonb_build_object('status', after -> 'status')
      else null
    end
where target_type <> 'subscription';

create function public.audit_details_are_minimal(details jsonb)
returns boolean
language sql
immutable
as $$
  select details is null
    or (
      jsonb_typeof(details) = 'object'
      and not exists (
        select 1
        from jsonb_object_keys(details) as k
        where k not in ('moderation_status', 'status', 'bio_changed', 'looking_for_changed')
      )
    );
$$;

alter table public.admin_audit_log
  add constraint admin_audit_log_details_minimal check (
    target_type = 'subscription'
    or (public.audit_details_are_minimal(before) and public.audit_details_are_minimal(after))
  );
