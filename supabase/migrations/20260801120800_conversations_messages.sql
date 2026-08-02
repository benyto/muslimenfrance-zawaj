create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  profile1_id uuid not null references public.profiles(id) on delete cascade,
  profile2_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_message_content text,
  last_message_sender_profile_id uuid references public.profiles(id),

  constraint conversations_unique_profiles unique (profile1_id, profile2_id),
  constraint conversations_no_self check (profile1_id <> profile2_id)
);

create index conversations_profile1_idx on public.conversations (profile1_id);
create index conversations_profile2_idx on public.conversations (profile2_id);
create index conversations_last_message_idx on public.conversations (last_message_at);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id),
  recipient_profile_id uuid not null references public.profiles(id),
  content text not null check (char_length(content) > 0 and char_length(content) <= 1000),
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id);
create index messages_sender_idx on public.messages (sender_profile_id);
create index messages_recipient_idx on public.messages (recipient_profile_id);
create index messages_created_at_idx on public.messages (created_at);

create trigger trg_messages_updated_at
  before update on public.messages
  for each row execute function public.set_updated_at();

-- Keeps conversations.last_message_* in sync so the conversation list can
-- be sorted/rendered without a join + aggregate on every load.
create or replace function public.update_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      last_message_content = new.content,
      last_message_sender_profile_id = new.sender_profile_id,
      updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger trg_update_conversation_last_message
  after insert on public.messages
  for each row execute function public.update_conversation_last_message();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

revoke all on public.conversations from authenticated;
grant select, insert on public.conversations to authenticated;

revoke all on public.messages from authenticated;
grant select, insert, update on public.messages to authenticated;

create policy "conversations select own"
  on public.conversations for select
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id in (profile1_id, profile2_id) and p.user_id = auth.uid()
  ));

create policy "conversations insert own"
  on public.conversations for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id in (profile1_id, profile2_id) and p.user_id = auth.uid())
    and not public.is_profile_blocked(profile1_id, profile2_id)
  );

create policy "messages select own conversation"
  on public.messages for select
  to authenticated
  using (exists (
    select 1 from public.conversations c
    join public.profiles p on p.id in (c.profile1_id, c.profile2_id)
    where c.id = messages.conversation_id and p.user_id = auth.uid()
  ));

-- Defense-in-depth backstop: the send-message Edge Function is the primary
-- path (rate limiting, friendlier errors), but this policy independently
-- re-checks blocking and subscription status at the database layer — a
-- gap in the old monolith's schema, where blocking was app-code-only.
create policy "messages insert own"
  on public.messages for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = sender_profile_id and p.user_id = auth.uid())
    and exists (
      select 1 from public.conversations c
      join public.profiles p2 on p2.id in (c.profile1_id, c.profile2_id)
      where c.id = messages.conversation_id and p2.user_id = auth.uid()
    )
    and not public.is_profile_blocked(sender_profile_id, recipient_profile_id)
    and public.has_active_dating_subscription(auth.uid())
  );

create policy "messages update own"
  on public.messages for update
  to authenticated
  using (exists (
    select 1 from public.conversations c
    join public.profiles p on p.id in (c.profile1_id, c.profile2_id)
    where c.id = messages.conversation_id and p.user_id = auth.uid()
  ));

create policy "conversations admin select"
  on public.conversations for select
  to authenticated
  using (public.is_admin_or_moderator(auth.uid()));

create policy "messages admin select"
  on public.messages for select
  to authenticated
  using (public.is_admin_or_moderator(auth.uid()));
