-- RLS and triggers alone don't make a table broadcast over Supabase
-- Realtime — it also has to be added to the `supabase_realtime`
-- publication explicitly. Missed this in Phase 1; caught live when a
-- second message sent via a direct API call never reached an already-open,
-- successfully-`joined` channel subscribed to postgres_changes on
-- `messages`. RLS on `messages` still gates who receives which row's
-- events (Realtime evaluates it per-subscriber), so this only affects
-- whether change events are emitted at all, not who can see them.
alter publication supabase_realtime add table public.messages;
