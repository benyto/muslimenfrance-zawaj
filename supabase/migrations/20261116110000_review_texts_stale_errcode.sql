-- review_profile_texts raised STALE_REVIEW with SQLSTATE 40001
-- (serialization_failure). That code means "retry this transaction" to the
-- layers between the API and Postgres, and against the hosted project the
-- request was retried until the gateway gave up after two minutes instead of
-- answering. A stale decision is not retryable — the moderator has to look
-- again — so it now uses an ordinary error code and answers immediately.
--
-- Only the error code changes. (create or replace keeps the existing grants:
-- service role only.)
create or replace function public.review_profile_texts(p_profile_id uuid, p_approve boolean, p_expected_version int)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.profiles;
begin
  select * into v from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v.bio_pending is null and v.looking_for_pending is null then
    raise exception 'NO_PENDING_TEXT' using errcode = 'P0002';
  end if;
  if v.text_review_version <> p_expected_version then
    raise exception 'STALE_REVIEW' using errcode = 'P0001';
  end if;

  update public.profiles
  set bio = case when p_approve and bio_pending is not null then bio_pending else bio end,
      looking_for = case when p_approve and looking_for_pending is not null then looking_for_pending else looking_for end,
      bio_pending = null,
      looking_for_pending = null
  where id = p_profile_id
  returning * into v;
  return v;
end;
$$;
