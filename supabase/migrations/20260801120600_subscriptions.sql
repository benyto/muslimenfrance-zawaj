-- `audience` generalizes the old monolith's dating_male/dating_female
-- product split into a single configurable table. Whether to keep a
-- gender-segmented price or unify into one 'all' product is a pricing
-- decision left to the user — this schema supports either.
create table public.subscription_products (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('all', 'male', 'female')),
  name text not null,
  stripe_product_id text,
  stripe_price_id text,
  price_amount int,
  currency varchar(3) not null default 'eur',
  interval varchar(20) not null default 'month',
  trial_period_days int not null default 7,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (audience)
);

create trigger trg_subscription_products_updated_at
  before update on public.subscription_products
  for each row execute function public.set_updated_at();

alter table public.subscription_products enable row level security;

revoke all on public.subscription_products from authenticated;
grant select on public.subscription_products to authenticated;

create policy "subscription_products select enabled"
  on public.subscription_products for select
  to authenticated
  using (enabled = true);

create policy "subscription_products admin all"
  on public.subscription_products for all
  to authenticated
  using (public.is_admin_or_moderator(auth.uid()))
  with check (public.is_admin_or_moderator(auth.uid()));

-- Only ever written by the stripe-webhook Edge Function (service_role).
create table public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_product_id uuid references public.subscription_products(id),
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  status text not null check (
    status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')
  ),
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_subscriptions_user_idx on public.user_subscriptions (user_id);
create index user_subscriptions_status_idx on public.user_subscriptions (status);

create trigger trg_user_subscriptions_updated_at
  before update on public.user_subscriptions
  for each row execute function public.set_updated_at();

alter table public.user_subscriptions enable row level security;

revoke all on public.user_subscriptions from authenticated;
grant select on public.user_subscriptions to authenticated;

create policy "user_subscriptions owner select"
  on public.user_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_subscriptions admin select"
  on public.user_subscriptions for select
  to authenticated
  using (public.is_admin_or_moderator(auth.uid()));

-- Single source of truth for "can this user send dating messages right
-- now" — enforced both in the messages insert RLS policy and in the
-- send-message Edge Function's pre-check.
create or replace function public.has_active_dating_subscription(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_subscriptions
    where user_id = p_user_id
      and status in ('trialing', 'active')
      and (current_period_end is null or current_period_end > now())
  );
$$;
