create table public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_profile_id uuid not null references public.profiles(id) on delete cascade,
  blocked_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),

  constraint user_blocks_no_self_block check (blocker_profile_id <> blocked_profile_id),
  constraint user_blocks_unique unique (blocker_profile_id, blocked_profile_id)
);

create index user_blocks_blocker_idx on public.user_blocks (blocker_profile_id);
create index user_blocks_blocked_idx on public.user_blocks (blocked_profile_id);

alter table public.user_blocks enable row level security;

revoke all on public.user_blocks from authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

create policy "user_blocks owner select"
  on public.user_blocks for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = blocker_profile_id and p.user_id = auth.uid()));

create policy "user_blocks owner insert"
  on public.user_blocks for insert
  to authenticated
  with check (exists (select 1 from public.profiles p where p.id = blocker_profile_id and p.user_id = auth.uid()));

create policy "user_blocks owner delete"
  on public.user_blocks for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = blocker_profile_id and p.user_id = auth.uid()));

create policy "user_blocks admin select"
  on public.user_blocks for select
  to authenticated
  using (public.is_admin_or_moderator(auth.uid()));

-- Used both by RLS policies (messages/conversations insert checks below)
-- and by the send-message/discover Edge Functions — single source of truth
-- for "are these two profiles blocked in either direction".
create or replace function public.is_profile_blocked(p_profile_a uuid, p_profile_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_profile_id = p_profile_a and blocked_profile_id = p_profile_b)
       or (blocker_profile_id = p_profile_b and blocked_profile_id = p_profile_a)
  );
$$;
