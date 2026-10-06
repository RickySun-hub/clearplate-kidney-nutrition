-- Run against a disposable Supabase database after migrations. All fixtures roll back.
begin;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.care_records(owner_id,record) values ('11111111-1111-4111-8111-111111111111','{"profile":{},"entries":[],"dayRecords":{}}');
insert into public.care_grants(owner_id,reader_id) values ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
do $$ begin
 if (select count(*) from public.care_records) <> 1 then raise exception 'Owner cannot read own record'; end if;
 update public.care_records set updated_at = now();
 if not found then raise exception 'Owner update failed'; end if;
 begin
  update public.care_records set owner_id = '33333333-3333-4333-8333-333333333333';
  raise exception 'Owner reassignment was allowed';
 exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
do $$ begin
 if (select count(*) from public.care_records) <> 1 then raise exception 'Granted reader cannot read'; end if;
 begin
  insert into public.care_records(owner_id,record) values ('11111111-1111-4111-8111-111111111111','{"profile":{},"entries":[],"dayRecords":{}}');
  raise exception 'Reader insertion into owner record was allowed';
 exception when insufficient_privilege then null; end;
 update public.care_records set record = '{"profile":{},"entries":[],"dayRecords":{}}';
 if found then raise exception 'Reader write was allowed'; end if;
 delete from public.care_records;
 if found then raise exception 'Reader delete was allowed'; end if;
 delete from public.care_grants;
 if found then raise exception 'Reader revoked owner permission'; end if;
 begin
  insert into public.care_grants(owner_id,reader_id) values ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333');
  raise exception 'Reader granted another reader';
 exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
do $$ begin
 if exists(select 1 from public.care_records) then raise exception 'Unrelated account saw a record'; end if;
 if exists(select 1 from public.care_grants) then raise exception 'Unrelated account saw grants'; end if;
end $$;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
delete from public.care_grants;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
do $$ begin
 if exists(select 1 from public.care_records) then raise exception 'Revoked reader still saw record'; end if;
end $$;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
do $$ begin
 delete from public.care_records;
 if not found then raise exception 'Owner delete failed'; end if;
end $$;
set local role anon;
set local request.jwt.claims = '{}';
do $$ begin
 begin
  perform 1 from public.care_records;
  raise exception 'Anonymous record access was allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform 1 from public.care_grants;
  raise exception 'Anonymous grant access was allowed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
