-- Tracks the last time a "you have a new message" email was sent for a
-- conversation, so POST /messages can debounce: skip the email if one was
-- already sent in the last 15 minutes, rather than emailing on every single
-- message while two people are actively chatting. One column is enough
-- (rather than per-recipient) since every conversation here is strictly
-- 1:1 — "notify the other participant" always means the same single person
-- relative to whoever just sent.
alter table public.conversations
  add column last_notification_email_sent_at timestamptz;
