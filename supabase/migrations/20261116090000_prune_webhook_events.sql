-- webhook_events is an inbox that exists so a redelivered Stripe event isn't
-- processed twice. Stripe stops redelivering within days, so rows older than
-- that have no job left to do — they only accumulate, one per event, forever.
--
-- The API calls this once a day with a retention period it reads from its
-- environment (WEBHOOK_EVENT_RETENTION_DAYS). Server-only: no member can
-- reach it.
--
-- Age is when the event was processed (or, if it never was, when it arrived),
-- so rows from before the processing state existed are aged by their original
-- processed_at. An event still being processed is never removed.
create function public.prune_webhook_events(p_older_than_days int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  if p_older_than_days is null or p_older_than_days < 1 then
    raise exception 'p_older_than_days must be at least 1';
  end if;

  delete from public.webhook_events
  where status <> 'processing'
    and coalesce(processed_at, received_at) < now() - make_interval(days => p_older_than_days);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.prune_webhook_events(int) from anon, authenticated, public;
grant execute on function public.prune_webhook_events(int) to service_role;
