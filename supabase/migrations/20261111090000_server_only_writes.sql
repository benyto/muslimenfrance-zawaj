-- Server-only writes for photos, messages, conversations and reports.
--
-- Until now these tables were writable two ways: through apps/api (which
-- enforces rate limits, approval and ownership) and directly through
-- PostgREST under a policy that checked much less. Anything the API
-- enforces and the policy doesn't was therefore optional for whoever
-- called PostgREST instead. The fix is to remove the second path: clients
-- keep SELECT (and the two column updates they legitimately need), and every
-- insert/delete goes through the API with the service role, which validates
-- first. Nothing the app does is lost — the UI only ever called the API.

-- ---------------------------------------------------------------------
-- 1. profile_photos
--
-- The owner insert policy accepted any `uploadthing_key`, and
-- DELETE /photos/:id then asked UploadThing to delete whatever file that
-- row named. Photo keys are handed to every member who can see the photo,
-- so a member could insert a row pointing at someone else's key and delete
-- their file through the API. Now rows are created only by the UploadThing
-- callback (service role, key supplied by UploadThing itself), removed only
-- by the API route, and a key can belong to exactly one row.
-- ---------------------------------------------------------------------
revoke insert, delete on public.profile_photos from authenticated;
drop policy "profile_photos owner insert" on public.profile_photos;
drop policy "profile_photos owner delete" on public.profile_photos;

-- Keep the earliest row per key (the genuine uploader's) before enforcing.
delete from public.profile_photos a
using public.profile_photos b
where a.uploadthing_key = b.uploadthing_key
  and (a.created_at, a.id) > (b.created_at, b.id);

alter table public.profile_photos
  add constraint profile_photos_key_unique unique (uploadthing_key);

-- ---------------------------------------------------------------------
-- 2. conversations / messages
--
-- The messages insert policy never checked that the recipient was the
-- other participant, that either profile was approved, or applied the
-- API's per-minute quota. Both inserts are removed; sending now goes
-- through send_message_command(), callable only by the service role, which
-- creates-or-finds the conversation and inserts the message in one
-- transaction.
-- ---------------------------------------------------------------------
revoke insert on public.conversations from authenticated;
revoke insert on public.messages from authenticated;
drop policy "conversations insert own" on public.conversations;
drop policy "messages insert own" on public.messages;

-- A pair must map to exactly one row. The unique constraint was on the
-- ordered pair, so (A,B) and (B,A) could both exist, and a lookup expecting
-- one row then failed. Normalise existing rows, then enforce one canonical
-- order (smaller id first).
update public.messages m
set conversation_id = keep.id
from public.conversations rev
join public.conversations keep
  on keep.profile1_id = rev.profile2_id and keep.profile2_id = rev.profile1_id
where rev.profile1_id > rev.profile2_id
  and m.conversation_id = rev.id;

delete from public.conversations rev
using public.conversations keep
where rev.profile1_id > rev.profile2_id
  and keep.profile1_id = rev.profile2_id
  and keep.profile2_id = rev.profile1_id;

update public.conversations
set profile1_id = profile2_id, profile2_id = profile1_id
where profile1_id > profile2_id;

-- Merged threads may now hold a newer message than their preview shows.
update public.conversations c
set last_message_at = lm.created_at,
    last_message_content = lm.content,
    last_message_sender_profile_id = lm.sender_profile_id
from (
  select distinct on (conversation_id) conversation_id, created_at, content, sender_profile_id
  from public.messages
  order by conversation_id, created_at desc, id desc
) lm
where lm.conversation_id = c.id;

alter table public.conversations
  add constraint conversations_canonical_order check (profile1_id < profile2_id);

create function public.send_message_command(
  p_sender_user_id uuid,
  p_recipient_profile_id uuid,
  p_content text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_profile_id uuid;
  v_profile1_id uuid;
  v_profile2_id uuid;
  v_conversation_id uuid;
  v_message public.messages;
begin
  select p.id into v_sender_profile_id
  from public.profiles p
  where p.user_id = p_sender_user_id and p.moderation_status = 'approved' and p.deleted_at is null;

  if v_sender_profile_id is null then
    raise exception 'SENDER_NOT_APPROVED' using errcode = '42501';
  end if;

  if v_sender_profile_id = p_recipient_profile_id then
    raise exception 'SELF_MESSAGE' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_recipient_profile_id and p.moderation_status = 'approved' and p.deleted_at is null
  ) then
    raise exception 'RECIPIENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.has_active_dating_subscription(p_sender_user_id) then
    raise exception 'SUBSCRIPTION_REQUIRED';
  end if;

  v_profile1_id := least(v_sender_profile_id, p_recipient_profile_id);
  v_profile2_id := greatest(v_sender_profile_id, p_recipient_profile_id);

  -- Two simultaneous first messages: the loser's insert does nothing and
  -- both then find the same row, instead of one failing on the constraint.
  insert into public.conversations (profile1_id, profile2_id)
  values (v_profile1_id, v_profile2_id)
  on conflict (profile1_id, profile2_id) do nothing;

  select c.id into v_conversation_id
  from public.conversations c
  where c.profile1_id = v_profile1_id and c.profile2_id = v_profile2_id;

  insert into public.messages (conversation_id, sender_profile_id, recipient_profile_id, content)
  values (v_conversation_id, v_sender_profile_id, p_recipient_profile_id, p_content)
  returning * into v_message;

  return v_message;
end;
$$;

-- Service role only: the API has already authenticated the caller and
-- applied its rate limit, and passes the verified user id in. Exposing this
-- to `authenticated` would reopen the bypass this migration closes.
revoke execute on function public.send_message_command(uuid, uuid, text) from anon, authenticated, public;
grant execute on function public.send_message_command(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- 3. reports
--
-- Direct inserts skipped the API's hourly quota and the Zod limits, and the
-- API itself never checked that the target existed. Insert is removed (the
-- API inserts with the service role, after validating the target); the
-- database now also bounds the description and allows one open report per
-- reporter and target, while a new one stays possible once it's handled.
-- ---------------------------------------------------------------------
revoke insert on public.reports from authenticated;
drop policy "reports insert own" on public.reports;

-- NOT VALID: bounds new rows without rejecting any historic one.
alter table public.reports
  add constraint reports_description_length check (description is null or char_length(description) <= 1000) not valid;

delete from public.reports a
using public.reports b
where a.status = 'pending' and b.status = 'pending'
  and a.reporter_id = b.reporter_id
  and a.content_type = b.content_type
  and a.content_id = b.content_id
  and (a.created_at, a.id) > (b.created_at, b.id);

create unique index reports_one_open_per_target
  on public.reports (reporter_id, content_type, content_id)
  where status = 'pending';
