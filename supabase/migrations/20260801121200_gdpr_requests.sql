-- Tracks GDPR export/delete requests handled by the gdpr-export /
-- gdpr-delete Edge Functions. A user can see their own request history;
-- only service_role inserts/updates (the Edge Functions own the lifecycle).
create table public.gdpr_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('export', 'delete')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index gdpr_requests_user_idx on public.gdpr_requests (user_id);

alter table public.gdpr_requests enable row level security;

revoke all on public.gdpr_requests from authenticated;
grant select on public.gdpr_requests to authenticated;

create policy "gdpr_requests owner select"
  on public.gdpr_requests for select
  to authenticated
  using (auth.uid() = user_id);
