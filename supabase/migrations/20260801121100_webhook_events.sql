-- Idempotency guard for Stripe webhook retries — the old monolith's
-- handler had no dedupe check, so a retried event could double-process a
-- subscription change. The stripe-webhook Edge Function inserts the
-- Stripe event id here before processing and short-circuits on conflict.
-- No client access at all; service_role only.
create table public.webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.webhook_events enable row level security;

revoke all on public.webhook_events from authenticated;
