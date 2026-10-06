-- Only this new schema is affected. No existing patient data is migrated.
create table public.care_records (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  record jsonb not null,
  updated_at timestamptz not null default now(),
  constraint care_record_shape check (
    jsonb_typeof(record) = 'object' and
    jsonb_typeof(record->'profile') = 'object' and
    jsonb_typeof(record->'entries') = 'array' and
    jsonb_typeof(record->'dayRecords') = 'object' and
    record ?& array['profile','entries','dayRecords'] and
    octet_length(record::text) <= 2000000
  )
);
create table public.care_grants (
  owner_id uuid not null references auth.users(id) on delete cascade,
  reader_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, reader_id),
  constraint care_grant_other_account check (owner_id <> reader_id)
);
create index care_grants_reader_idx on public.care_grants(reader_id);
alter table public.care_records enable row level security;
alter table public.care_grants enable row level security;
revoke all on public.care_records, public.care_grants from anon, authenticated;
grant select, insert, update, delete on public.care_records to authenticated;
grant select, insert, delete on public.care_grants to authenticated;
-- The recipient can see only grant rows addressed to them, enabling the record lookup.
create policy care_grants_read on public.care_grants for select to authenticated
  using ((select auth.uid()) = owner_id or (select auth.uid()) = reader_id);
create policy care_grants_owner_insert on public.care_grants for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy care_grants_owner_delete on public.care_grants for delete to authenticated
  using ((select auth.uid()) = owner_id);
create policy care_records_read on public.care_records for select to authenticated
  using ((select auth.uid()) = owner_id or exists (
    select 1 from public.care_grants g where g.owner_id = care_records.owner_id and g.reader_id = (select auth.uid())
  ));
create policy care_records_owner_insert on public.care_records for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy care_records_owner_update on public.care_records for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy care_records_owner_delete on public.care_records for delete to authenticated
  using ((select auth.uid()) = owner_id);
