-- New-message email notifications: per-profile opt-in + configurable
-- cooldown, same pattern as show_online_status (20260807090000_presence.sql)
-- — plain columns on the caller's own row, read directly by
-- apps/api/src/routes/messages.ts via the service-role client (a privileged
-- read of the recipient's prefs, same trust boundary as everything else that
-- route already does) and written directly by the client via the existing
-- broad "profiles owner update" policy, same as show_online_status. No RPC
-- or RLS change needed on either side.
--
-- cooldown_minutes = 0 means "no cooldown, notify on every message" — the
-- existing hardcoded 15-minute default becomes just that, a default value,
-- not a floor.

alter table public.profiles
  add column email_new_message_notifications boolean not null default true,
  add column email_new_message_cooldown_minutes int not null default 15
    check (email_new_message_cooldown_minutes between 0 and 1440);
