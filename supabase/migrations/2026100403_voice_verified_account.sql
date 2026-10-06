-- Harden already-deployed RPC: inspect current Auth record, not client claims.
-- No counter/settings changes, no health/transcript/audio access.
create or replace function public.consume_voice_quota()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  day_key date := (pg_catalog.now() at time zone 'UTC')::date;
  user_limit integer; global_limit integer; audio_seconds integer;
  used integer; global_used integer; previous_attempt timestamptz;
begin
  if caller is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    or not exists (
      select 1 from auth.users as account
      where account.id = caller
        and not coalesce(account.is_anonymous, false)
        and (account.email_confirmed_at is not null or account.phone_confirmed_at is not null)
    ) then
    raise exception 'Sign in with a verified account' using errcode = '42501';
  end if;
  select daily_user_limit, daily_global_limit, max_audio_seconds into user_limit, global_limit, audio_seconds from voice_private.limits where singleton;
  if user_limit is null then raise exception 'Quota configuration unavailable'; end if;
  insert into voice_private.user_attempts(user_id, usage_day) values(caller,day_key) on conflict do nothing;
  select last_attempt into previous_attempt from voice_private.user_attempts where user_id=caller and usage_day=day_key for update;
  update voice_private.user_attempts set attempts=least(attempts+1,1000000), last_attempt=pg_catalog.now() where user_id=caller and usage_day=day_key returning attempts into used;
  if used>user_limit or previous_attempt>pg_catalog.now()-interval '10 seconds' then
    return pg_catalog.jsonb_build_object('allowed',false,'remaining',greatest(0,user_limit-used),'maxAudioSeconds',audio_seconds);
  end if;
  insert into voice_private.global_attempts(usage_day,attempts) values(day_key,1)
    on conflict(usage_day) do update set attempts=least(voice_private.global_attempts.attempts+1,1000000) returning attempts into global_used;
  return pg_catalog.jsonb_build_object('allowed',global_used<=global_limit,'remaining',greatest(0,user_limit-used),'maxAudioSeconds',audio_seconds);
end;
$$;
revoke all on function public.consume_voice_quota() from public, anon, authenticated;
grant execute on function public.consume_voice_quota() to authenticated;
