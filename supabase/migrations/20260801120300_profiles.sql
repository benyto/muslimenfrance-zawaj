-- Dating profile — 1:1 with auth.users. No blanket public/authenticated
-- select policy (unlike the old monolith's profile_dating table): other
-- users discover profiles exclusively through the search_profiles() RPC
-- (added in a later migration), which filters out non-approved and
-- blocked-pair rows server-side.

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,

  nickname varchar(50) not null,
  gender text not null check (gender in ('male', 'female')),
  birthdate date not null check (birthdate <= (current_date - interval '18 years')),
  interests text[] not null default '{}',

  height integer,
  weight integer,
  eye_color varchar(20),
  hair_color varchar(20),
  body_type varchar(20),

  education_level varchar(50),
  occupation varchar(100),
  employment_status varchar(30),
  income_range varchar(30),

  ethnicity varchar(50),
  religion varchar(30),
  religiosity_level varchar(20),
  languages_spoken text[] not null default '{}',

  relationship_goal varchar(30),
  smoker varchar(20),
  drinker varchar(20),
  has_children boolean,
  wants_children varchar(20),

  city_id uuid references public.cities(id),

  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected', 'disabled')),
  moderation_notes text,
  moderated_by uuid references auth.users(id),
  moderated_at timestamptz,

  -- GDPR Art. 9: religion/religiosity is special-category data — explicit
  -- consent is required before it can be stored (a gap in the old schema).
  special_category_consent boolean not null default false,
  special_category_consent_at timestamptz,

  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_gender_idx on public.profiles (gender);
create index profiles_birthdate_idx on public.profiles (birthdate);
create index profiles_city_idx on public.profiles (city_id);
create index profiles_relationship_goal_idx on public.profiles (relationship_goal);
create index profiles_religion_idx on public.profiles (religion);
create index profiles_moderation_status_idx on public.profiles (moderation_status);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Deny-by-default: revoke everything, then grant back only what's needed.
revoke all on public.profiles from authenticated;
grant select, insert, update on public.profiles to authenticated;

create policy "profiles owner select"
  on public.profiles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "profiles owner insert"
  on public.profiles for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and special_category_consent = true
    and moderation_status = 'pending'
    and moderated_by is null
    and moderated_at is null
  );

create policy "profiles owner update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and special_category_consent = true
    -- moderation/lifecycle fields are never client-writable: an owner update
    -- can only carry the same values the row already had before the update.
    -- (Postgres evaluates this subquery against the pre-update snapshot, so
    -- it reads the OLD row even though the outer reference is unqualified.)
    and moderation_status is not distinct from (select p.moderation_status from public.profiles p where p.id = profiles.id)
    and moderated_by is not distinct from (select p.moderated_by from public.profiles p where p.id = profiles.id)
    and moderated_at is not distinct from (select p.moderated_at from public.profiles p where p.id = profiles.id)
    and moderation_notes is not distinct from (select p.moderation_notes from public.profiles p where p.id = profiles.id)
    and deleted_at is not distinct from (select p.deleted_at from public.profiles p where p.id = profiles.id)
  );

create policy "profiles admin all"
  on public.profiles for all
  to authenticated
  using (public.is_admin_or_moderator(auth.uid()))
  with check (public.is_admin_or_moderator(auth.uid()));
