-- Moderators and admins no longer read conversations or messages directly.
--
-- Until now two policies gave anyone with a moderator or admin role SELECT on
-- every conversation and every message. No screen used it (the reports page
-- never showed a reported message), but it left all private conversations
-- readable, unlogged, to everyone on the moderation team — more than the
-- privacy policy can justify.
--
-- The only way to read a conversation is now the API's
-- GET /admin/reports/:id/conversation, which:
--   * works only for an OPEN report about a message in that conversation,
--   * returns a window of messages around the reported one, not the history,
--   * writes an audit entry for every view (action 'conversation_viewed'),
--     and refuses to return anything if that entry cannot be written.
-- It runs with the service role, so no policy is needed for it; members keep
-- their own policies untouched.
drop policy "conversations admin select" on public.conversations;
drop policy "messages admin select" on public.messages;
