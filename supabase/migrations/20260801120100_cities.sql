-- Reference table copied (subset actually referenced by migrated profiles)
-- from the muslimenfrance monolith's `cities` table during Phase 10 data
-- migration. Non-sensitive, so a blanket authenticated-read policy is fine.

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  postal_code text,
  department text,
  region text,
  created_at timestamptz not null default now()
);

alter table public.cities enable row level security;

create policy "cities select public"
  on public.cities for select
  to authenticated
  using (true);

-- Only service_role (Edge Functions / migration scripts) can write.
revoke insert, update, delete on public.cities from authenticated;
