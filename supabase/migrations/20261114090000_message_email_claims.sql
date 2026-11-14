-- 1. New-message email cooldown: per recipient, claimed atomically.
--
-- The cooldown used to be one timestamp on the conversation, read and then
-- written in two separate steps. Two problems: it was shared by both
-- participants (A's message emailing B started a window that also silenced
-- the email to A when B replied), and two messages sent at the same moment
-- could both read "not sent yet" and both send. Now there is one row per
-- (conversation, recipient) and claim_message_email_slot() takes the slot in
-- a single statement: it returns true only to the caller that moved
-- last_sent_at forward, so concurrent sends produce one email.
create table public.message_email_claims (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  last_sent_at timestamptz not null,
  primary key (conversation_id, recipient_profile_id)
);

-- Server-only: no grants, no policies.
alter table public.message_email_claims enable row level security;
revoke all on public.message_email_claims from anon, authenticated;

create function public.claim_message_email_slot(
  p_conversation_id uuid,
  p_recipient_profile_id uuid,
  p_cooldown_minutes int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.message_email_claims as c (conversation_id, recipient_profile_id, last_sent_at)
  values (p_conversation_id, p_recipient_profile_id, now())
  on conflict (conversation_id, recipient_profile_id) do update
    set last_sent_at = now()
    where c.last_sent_at <= now() - make_interval(mins => p_cooldown_minutes);
  -- FOUND is false when the conflict branch's WHERE rejected the update,
  -- i.e. an email already went out inside the cooldown window.
  return found;
end;
$$;

-- Gives the slot back when the email could not be sent, so a Resend outage
-- doesn't silently use up the recipient's window.
create function public.release_message_email_slot(
  p_conversation_id uuid,
  p_recipient_profile_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.message_email_claims
  where conversation_id = p_conversation_id and recipient_profile_id = p_recipient_profile_id;
$$;

revoke execute on function public.claim_message_email_slot(uuid, uuid, int) from anon, authenticated, public;
revoke execute on function public.release_message_email_slot(uuid, uuid) from anon, authenticated, public;
grant execute on function public.claim_message_email_slot(uuid, uuid, int) to service_role;
grant execute on function public.release_message_email_slot(uuid, uuid) to service_role;

alter table public.conversations drop column last_notification_email_sent_at;

-- 2. Message history: the thread is read "this conversation, newest first,
-- page by page", with (created_at, id) as the cursor so rows sharing a
-- timestamp at a page boundary are neither skipped nor repeated. One index
-- matches that exactly and also serves the old conversation_id-only lookups
-- (it has the same leading column), so the narrower one is dropped.
create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc, id desc);
drop index public.messages_conversation_idx;
