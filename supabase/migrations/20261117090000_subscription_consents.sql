-- Proof of what a member agreed to when they subscribed.
--
-- A consumer who subscribes online has 14 days to withdraw. For the service to
-- start inside that period they must expressly ask for it, knowing they will
-- owe payment for what has been provided if they withdraw — and the seller has
-- to be able to show that they did. One row is written per checkout, only after
-- the API has received both explicit choices and Stripe has created the
-- session, keyed by that session.
--
-- Server-only (no grants, no policies): members never read or write it; it is
-- included in their data export, and removed with their account.
create table public.subscription_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_product_id uuid references public.subscription_products(id) on delete set null,
  stripe_checkout_session_id text not null unique,
  terms_version text not null,
  wording_version text not null,
  accepted_terms boolean not null check (accepted_terms),
  waived_withdrawal boolean not null check (waived_withdrawal),
  created_at timestamptz not null default now()
);

create index subscription_consents_user_idx on public.subscription_consents (user_id);

alter table public.subscription_consents enable row level security;
revoke all on public.subscription_consents from anon, authenticated;
