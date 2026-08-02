create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  content_type varchar(20) not null check (content_type in ('profile', 'message')),
  content_id uuid not null,
  reason varchar(50) not null check (
    reason in ('spam', 'inappropriate', 'harassment', 'fake', 'violence', 'hate_speech', 'other')
  ),
  description text,
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reports_status_idx on public.reports (status);
create index reports_content_idx on public.reports (content_type, content_id);
create index reports_reporter_idx on public.reports (reporter_id);

create trigger trg_reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

alter table public.reports enable row level security;

revoke all on public.reports from authenticated;
grant select, insert on public.reports to authenticated;

create policy "reports reporter select own"
  on public.reports for select
  to authenticated
  using (auth.uid() = reporter_id);

create policy "reports insert own"
  on public.reports for insert
  to authenticated
  with check (
    auth.uid() = reporter_id
    and status = 'pending'
    and admin_notes is null
    and reviewed_by is null
  );

create policy "reports admin all"
  on public.reports for all
  to authenticated
  using (public.is_admin_or_moderator(auth.uid()))
  with check (public.is_admin_or_moderator(auth.uid()));
