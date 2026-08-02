-- Written only by service-role Edge Functions (moderate-profile,
-- moderate-photo, resolve-report, ...) so the audit write and the actual
-- mutation happen atomically in one function call. Never client-writable.
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  action text not null,
  target_type text not null check (target_type in ('profile', 'photo', 'report', 'subscription', 'user')),
  target_id uuid not null,
  before jsonb,
  after jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index admin_audit_log_target_idx on public.admin_audit_log (target_type, target_id);
create index admin_audit_log_admin_idx on public.admin_audit_log (admin_user_id);
create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at);

alter table public.admin_audit_log enable row level security;

revoke all on public.admin_audit_log from authenticated;
grant select on public.admin_audit_log to authenticated;

create policy "admin_audit_log admin select"
  on public.admin_audit_log for select
  to authenticated
  using (public.is_admin_or_moderator(auth.uid()));
