-- "My conversation list, with the other participant's display info" —
-- profiles RLS is owner-only, so listing who each conversation is *with*
-- (nickname, photo) needs the same security-definer treatment as
-- get_profile_detail(). Scoped entirely to the caller's own conversations.
create or replace function public.get_my_conversations()
returns table (
  conversation_id uuid,
  other_profile_id uuid,
  other_nickname text,
  other_photo_key text,
  last_message_at timestamptz,
  last_message_content text,
  last_message_sender_profile_id uuid,
  unread_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_caller_profile_id uuid;
begin
  select p.id into v_caller_profile_id from public.profiles p where p.user_id = auth.uid();
  if v_caller_profile_id is null then
    return;
  end if;

  return query
  select
    c.id,
    op.id,
    op.nickname::text,
    (
      select pp.uploadthing_key
      from public.profile_photos pp
      where pp.profile_id = op.id and pp.moderation_status = 'approved'
      order by pp.position
      limit 1
    ),
    c.last_message_at,
    c.last_message_content,
    c.last_message_sender_profile_id,
    (
      select count(*)
      from public.messages m
      where m.conversation_id = c.id
        and m.recipient_profile_id = v_caller_profile_id
        and m.is_read = false
    )
  from public.conversations c
  join public.profiles op
    on op.id = case when c.profile1_id = v_caller_profile_id then c.profile2_id else c.profile1_id end
  where c.profile1_id = v_caller_profile_id or c.profile2_id = v_caller_profile_id
  order by c.last_message_at desc;
end;
$$;

revoke execute on function public.get_my_conversations() from anon, authenticated, public;
grant execute on function public.get_my_conversations() to authenticated;
