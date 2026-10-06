-- Execute as migration/admin role after all migrations. No permanent fixtures/usage changes.
begin;
insert into auth.users(id,email_confirmed_at,phone_confirmed_at,is_anonymous) values
 ('a1000000-0000-4000-8000-000000000001',now(),null,false),
 ('a1000000-0000-4000-8000-000000000002',null,null,false),
 ('a1000000-0000-4000-8000-000000000003',null,now(),false),
 ('a1000000-0000-4000-8000-000000000004',now(),null,true);
update voice_private.limits set daily_user_limit=2,daily_global_limit=2,max_audio_seconds=60 where singleton;
delete from voice_private.global_attempts where usage_day=(now() at time zone 'UTC')::date;
set local role authenticated;
set local request.jwt.claims='{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}';
do $$ declare result jsonb; begin
 result:=public.consume_voice_quota();
 if result->>'allowed' is distinct from 'true' or (result->>'remaining')::integer is distinct from 1 or (result->>'maxAudioSeconds')::integer is distinct from 60 then raise exception 'Verified email first quota attempt failed: %',result; end if;
 result:=public.consume_voice_quota();
 if result->>'allowed' is distinct from 'false' or (result->>'remaining')::integer is distinct from 0 then raise exception 'Cooldown attempt was not denied/charged: %',result; end if;
 begin
  perform 1 from voice_private.user_attempts;
  raise exception 'Authenticated user could read private counters';
 exception when insufficient_privilege then null; end;
 begin
  update voice_private.limits set daily_user_limit=100;
  raise exception 'Authenticated user could increase private quota';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update voice_private.user_attempts set last_attempt=now()-interval '11 seconds' where user_id='a1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims='{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ declare result jsonb; begin
 result:=public.consume_voice_quota();
 if result->>'allowed' is distinct from 'false' or (result->>'remaining')::integer is distinct from 0 then raise exception 'User daily max was not enforced: %',result; end if;
end $$;
set local request.jwt.claims='{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}';
do $$ begin
 begin
  perform public.consume_voice_quota();
  raise exception 'Unverified account directly consumed quota';
 exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claims='{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}';
do $$ begin
 begin
  perform public.consume_voice_quota();
  raise exception 'Database anonymous account bypassed forged JWT flag';
 exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claims='{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}';
do $$ declare result jsonb; begin
 result:=public.consume_voice_quota();
 if result->>'allowed' is distinct from 'true' then raise exception 'Verified phone account was denied: %',result; end if;
end $$;
reset role;
update voice_private.user_attempts set last_attempt=now()-interval '11 seconds' where user_id='a1000000-0000-4000-8000-000000000003';
set local role authenticated;
set local request.jwt.claims='{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$ declare result jsonb; begin
 result:=public.consume_voice_quota();
 if result->>'allowed' is distinct from 'false' then raise exception 'Global daily budget was not enforced: %',result; end if;
end $$;
set local request.jwt.claims='{}';
do $$ begin
 begin
  perform public.consume_voice_quota();
  raise exception 'Missing auth UID was accepted';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
set local request.jwt.claims='{}';
do $$ begin
 begin
  perform public.consume_voice_quota();
  raise exception 'Anonymous role could execute quota RPC';
 exception when insufficient_privilege then null; end;
 begin
  perform 1 from voice_private.global_attempts;
  raise exception 'Anonymous role could read private counters';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from voice_private.user_attempts where user_id in ('a1000000-0000-4000-8000-000000000002'::uuid,'a1000000-0000-4000-8000-000000000004'::uuid)) then raise exception 'Unverified/anonymous attempts created counters'; end if;
 if (select attempts from voice_private.user_attempts where user_id='a1000000-0000-4000-8000-000000000001' and usage_day=(now() at time zone 'UTC')::date) is distinct from 3 then raise exception 'Denied attempts were not charged against user limit'; end if;
 if (select attempts from voice_private.global_attempts where usage_day=(now() at time zone 'UTC')::date) is distinct from 3 then raise exception 'Global counter is inconsistent'; end if;
 raise notice 'Voice quota verification passed: confirmed email/phone, unverified/anonymous, cooldown, user/global limits, private ACLs.';
end $$;
rollback;
