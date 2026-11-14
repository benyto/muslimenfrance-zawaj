-- Stripe webhook events become a small durable inbox with a processing state,
-- instead of a bare "seen this id" list.
--
-- The old flow inserted the event id first and processed afterwards. Two ways
-- that loses events: (1) any insert error — not only a duplicate — was answered
-- with 200, so a database hiccup acknowledged an event that was never handled;
-- (2) if processing then failed, the id was already recorded, so Stripe's retry
-- was treated as a duplicate and dropped. Now an event is only "processed"
-- once its work actually succeeded; a failure leaves it 'failed' and the API
-- answers 5xx so Stripe redelivers it, and a retry takes it over again.
alter table public.webhook_events
  add column status text not null default 'processed'
    check (status in ('processing', 'processed', 'failed')),
  add column attempts int not null default 1,
  add column last_error text,
  add column received_at timestamptz not null default now(),
  add column processing_started_at timestamptz;

-- Existing rows were all handled under the old flow: they keep status
-- 'processed' (the default above) and their original processed_at. New rows
-- only get a processed_at once they actually are.
alter table public.webhook_events
  alter column processed_at drop not null,
  alter column processed_at drop default;

-- Takes an event for processing, atomically. Returns:
--   'claimed'     — this caller should process it (new, previously failed, or
--                   its last attempt died mid-way: 'processing' for longer than
--                   p_stale_seconds)
--   'duplicate'   — already processed; acknowledge and do nothing
--   'in_progress' — another delivery is processing it right now; answer
--                   non-2xx so Stripe tries again later rather than dropping it
create function public.claim_webhook_event(p_id text, p_type text, p_stale_seconds int default 300)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.webhook_events as w (id, type, status, attempts, processing_started_at, processed_at)
  values (p_id, p_type, 'processing', 1, now(), null)
  on conflict (id) do update
    set status = 'processing',
        attempts = w.attempts + 1,
        processing_started_at = now(),
        last_error = null
    where w.status = 'failed'
       or (w.status = 'processing'
           and w.processing_started_at < now() - make_interval(secs => p_stale_seconds));

  if found then
    return 'claimed';
  end if;

  if (select status from public.webhook_events where id = p_id) = 'processed' then
    return 'duplicate';
  end if;
  return 'in_progress';
end;
$$;

revoke execute on function public.claim_webhook_event(text, text, int) from anon, authenticated, public;
grant execute on function public.claim_webhook_event(text, text, int) to service_role;
