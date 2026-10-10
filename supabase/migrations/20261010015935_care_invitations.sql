-- Additive: existing patient records and grants are unchanged.
create schema if not exists renalsync_private;
revoke all on schema renalsync_private from public, anon;
grant usage on schema renalsync_private to authenticated;
create table renalsync_private.care_invitations (
 id uuid primary key default gen_random_uuid(),
 reader_id uuid not null references auth.users(id) on delete cascade,
 recipient_email text not null check(length(recipient_email)<=254),
 reader_name text not null check(length(reader_name) between 1 and 100),
 reader_email text not null,
 patient_name text not null default '' check(length(patient_name)<=100),
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 responded_at timestamptz,
 owner_id uuid references auth.users(id) on delete cascade,
 last_sent_at timestamptz,
 send_count integer not null default 0
);
alter table renalsync_private.care_invitations enable row level security;
revoke all on renalsync_private.care_invitations from public,anon,authenticated;
create index care_invitation_reader_idx on renalsync_private.care_invitations(reader_id,created_at desc);
create index care_invitation_email_idx on renalsync_private.care_invitations(recipient_email,created_at desc);
create function renalsync_private.invitation_action(action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); verified_email text; inv renalsync_private.care_invitations%rowtype;
 email_input text; name_input text; invite_id uuid; result jsonb;
begin
 if uid is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select lower(trim(email)) into verified_email from auth.users where id=uid and email_confirmed_at is not null;
 if verified_email is null or verified_email='' then raise exception 'Verified email required' using errcode='42501'; end if;
 if action='create' then
  email_input:=lower(trim(payload->>'email')); name_input:=trim(payload->>'readerName');
  if email_input is null or length(email_input)>254 or email_input !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or email_input=verified_email then raise exception 'Invalid recipient' using errcode='22023'; end if;
  if name_input is null or length(name_input) not between 1 and 100 or length(coalesce(payload->>'patientName',''))>100 then raise exception 'Invalid name' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if (select count(*) from renalsync_private.care_invitations where reader_id=uid and created_at>now()-interval '1 day')>=20 then raise exception 'Daily invitation limit reached' using errcode='54000'; end if;
  select * into inv from renalsync_private.care_invitations where reader_id=uid and recipient_email=email_input and status='pending' and expires_at>now() order by created_at desc limit 1;
  if not found then
   insert into renalsync_private.care_invitations(reader_id,recipient_email,reader_name,reader_email,patient_name)
   values(uid,email_input,name_input,verified_email,trim(coalesce(payload->>'patientName',''))) returning * into inv;
  end if;
  return to_jsonb(inv);
 elsif action='list' then
  select coalesce(jsonb_agg(item order by created_at desc),'[]'::jsonb) into result from (
   select i.created_at,to_jsonb(i)||jsonb_build_object('status',case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,'direction',case when i.reader_id=uid then 'outgoing' else 'incoming' end,'active',exists(select 1 from public.care_grants g where g.owner_id=i.owner_id and g.reader_id=i.reader_id)) item
   from renalsync_private.care_invitations i where i.reader_id=uid or (i.recipient_email=verified_email and (i.owner_id is null or i.owner_id=uid)) order by i.created_at desc limit 200
  ) rows;
  return result;
 end if;
 begin invite_id:=(payload->>'id')::uuid; exception when others then raise exception 'Invalid invitation' using errcode='22023'; end;
 select * into inv from renalsync_private.care_invitations where id=invite_id for update;
 if not found or not (inv.reader_id=uid or (inv.recipient_email=verified_email and (inv.owner_id is null or inv.owner_id=uid))) then raise exception 'Invitation unavailable for this account' using errcode='42501'; end if;
 if action='get' then
  return to_jsonb(inv)||jsonb_build_object('status',case when inv.status='pending' and inv.expires_at<=now() then 'expired' else inv.status end,'active',exists(select 1 from public.care_grants g where g.owner_id=inv.owner_id and g.reader_id=inv.reader_id));
 elsif action='cancel' then
  if inv.reader_id<>uid then raise exception 'Not permitted' using errcode='42501'; end if;
  if inv.status='pending' then update renalsync_private.care_invitations set status='cancelled',responded_at=now() where id=inv.id returning * into inv; end if;
  return to_jsonb(inv);
 elsif action='accept' or action='decline' then
  if inv.recipient_email<>verified_email or inv.reader_id=uid then raise exception 'Recipient email does not match' using errcode='42501'; end if;
  if action='accept' and inv.status='accepted' and inv.owner_id=uid then
   if not exists(select 1 from public.care_grants where owner_id=uid and reader_id=inv.reader_id) then raise exception 'Access revoked; request a new invitation' using errcode='22023'; end if;
   return to_jsonb(inv);
  end if;
  if inv.status<>'pending' or inv.expires_at<=now() then raise exception 'Invitation no longer pending' using errcode='22023'; end if;
  if action='accept' then
   if payload->>'consent' is distinct from 'true' then raise exception 'Explicit consent required' using errcode='22023'; end if;
   insert into public.care_grants(owner_id,reader_id) values(uid,inv.reader_id) on conflict do nothing;
  end if;
  update renalsync_private.care_invitations set status=case when action='accept' then 'accepted' else 'declined' end,owner_id=uid,responded_at=now() where id=inv.id returning * into inv;
  return to_jsonb(inv);
 elsif action='claim_email' then
  if inv.reader_id<>uid then raise exception 'Not permitted' using errcode='42501'; end if;
  if inv.status<>'pending' or inv.expires_at<=now() then raise exception 'Invitation no longer pending' using errcode='22023'; end if;
  if inv.send_count>=5 or inv.last_sent_at>now()-interval '1 minute' then raise exception 'Wait before resending' using errcode='54000'; end if;
  update renalsync_private.care_invitations set last_sent_at=now(),send_count=send_count+1 where id=inv.id returning * into inv;
  return to_jsonb(inv);
 end if;
 raise exception 'Unknown invitation action' using errcode='22023';
end $$;
revoke all on function renalsync_private.invitation_action(text,jsonb) from public,anon,authenticated;
grant execute on function renalsync_private.invitation_action(text,jsonb) to authenticated;
create function public.care_invitation_action(action text,payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select renalsync_private.invitation_action(action,payload); $$;
revoke all on function public.care_invitation_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.care_invitation_action(text,jsonb) to authenticated;
notify pgrst,'reload schema';
