-- Admin/moderator role model — a dedicated table rather than a boolean
-- column or JWT claim, checked from RLS policies and Edge Functions alike.
-- Only service_role (Edge Functions) can write; the RPC below lets a client
-- read its own roles without needing a table grant.

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator', 'user')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create index user_roles_user_id_idx on public.user_roles (user_id);

alter table public.user_roles enable row level security;

revoke insert, update, delete on public.user_roles from authenticated;

create policy "user_roles self select"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

-- security definer so a caller can check their own roles without a direct
-- table grant; never trust a client-supplied role value anywhere else.
create or replace function public.get_my_roles()
returns text[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(role), '{}')
  from public.user_roles
  where user_id = auth.uid();
$$;

grant execute on function public.get_my_roles to authenticated;

create or replace function public.is_admin_or_moderator(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role in ('admin', 'moderator')
  );
$$;
