-- Real bug caught live while cleaning up test data: deleting a profile
-- (e.g. via the Phase 9 GDPR-delete flow, cascading from auth.users) failed
-- with "violates foreign key constraint messages_sender_profile_id_fkey" —
-- messages.sender_profile_id/recipient_profile_id reference profiles(id)
-- with no ON DELETE action (defaults to RESTRICT), unlike
-- messages.conversation_id (which does cascade, transitively deleting
-- messages when their conversation goes). Postgres enforces every foreign
-- key independently, so the conversation-mediated cascade path doesn't
-- supersede this direct one — it blocks the delete regardless. Add the
-- missing cascade so a deleted profile's messages are cleaned up via
-- either path.
alter table public.messages
  drop constraint messages_sender_profile_id_fkey,
  add constraint messages_sender_profile_id_fkey
    foreign key (sender_profile_id) references public.profiles(id) on delete cascade;

alter table public.messages
  drop constraint messages_recipient_profile_id_fkey,
  add constraint messages_recipient_profile_id_fkey
    foreign key (recipient_profile_id) references public.profiles(id) on delete cascade;
