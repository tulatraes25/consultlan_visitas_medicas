-- RLS integration tests against real PostgreSQL in GitHub CI.
-- All data is invented. No identifiers here refer to real patients or clinicians.
\set ON_ERROR_STOP on
insert into auth.users(id) values
('11111111-1111-4111-8111-111111111111'), -- Professional A
('22222222-2222-4222-8222-222222222222'), -- Professional B
('33333333-3333-4333-8333-333333333333'), -- Coordinator A
('44444444-4444-4444-8444-444444444444'), -- Admin A
('55555555-5555-4555-8555-555555555555'), -- Auditor A
('66666666-6666-4666-8666-666666666666'), -- Professional Other Organization
('77777777-7777-4777-8777-777777777777'); -- Inactive Membership A

insert into public.organizations(id,name) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Organización sintética A'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Organización sintética B');

insert into public.memberships(organization_id,user_id,app_role,active) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','PROFESSIONAL',true),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','PROFESSIONAL',true),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','COORDINATOR',true),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444','ADMIN',true),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555','AUDITOR',true),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','66666666-6666-4666-8666-666666666666','PROFESSIONAL',true),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','77777777-7777-4777-8777-777777777777','ADMIN',false);

insert into public.professionals(id,organization_id,user_id,specialty,active) values
('1111aaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','ENFERMERIA',true),
('2222aaaa-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','KINESIOLOGIA',true),
('6666aaaa-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','66666666-6666-4666-8666-666666666666','MEDICINA',true);

insert into public.patients(id,organization_id,display_name) values
('aaaa0000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Paciente ficticio A'),
('aaaa0000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Paciente ficticio B'),
('bbbb0000-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Paciente ficticio C');

insert into public.visits(id,organization_id,patient_id,professional_id,scheduled_start,scheduled_end,state) values
('1111bbbb-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaa0000-0000-4000-8000-000000000001','1111aaaa-0000-4000-8000-000000000001',
 '2026-10-10T10:00:00Z','2026-10-10T11:00:00Z','ASSIGNED'),
('2222bbbb-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaa0000-0000-4000-8000-000000000002','2222aaaa-0000-4000-8000-000000000002',
 '2026-10-10T11:00:00Z','2026-10-10T12:00:00Z','IN_PROGRESS'),
('6666bbbb-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'bbbb0000-0000-4000-8000-000000000003','6666aaaa-0000-4000-8000-000000000003',
 '2026-10-10T12:00:00Z','2026-10-10T13:00:00Z','ASSIGNED');

insert into public.clinical_records(organization_id,visit_id,author_user_id,version_number,narrative) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1111bbbb-0000-4000-8000-000000000001',
 '11111111-1111-4111-8111-111111111111',1,'Nota sintética A, no clínica'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2222bbbb-0000-4000-8000-000000000002',
 '22222222-2222-4222-8222-222222222222',1,'Nota sintética B, no clínica'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','6666bbbb-0000-4000-8000-000000000003',
 '66666666-6666-4666-8666-666666666666',1,'Nota sintética C, no clínica');

insert into public.attendance_evidence(organization_id,visit_id,document_sha256,outcome) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1111bbbb-0000-4000-8000-000000000001',
 repeat('a',64),'PENDING');

insert into public.audit_events(organization_id,event_type,safe_metadata) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DEMO_AUDIT','{"test":"synthetic"}');

-- Professional A: sees only own visit/clinical record/patient, not admin audit.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare n integer;
begin
  select count(*) into n from public.visits;
  if n <> 1 then raise exception 'Professional A sees % visits, expected 1',n; end if;
  select count(*) into n from public.patients;
  if n <> 1 then raise exception 'Professional A sees % patients, expected 1',n; end if;
  select count(*) into n from public.clinical_records;
  if n <> 1 then raise exception 'Professional A sees % clinical records, expected 1',n; end if;
  select count(*) into n from public.attendance_evidence;
  if n <> 1 then raise exception 'Professional A sees % attendance, expected 1',n; end if;
  select count(*) into n from public.audit_events;
  if n <> 0 then raise exception 'Professional A can read audit events'; end if;
end $$;
commit;

-- Professional B: cannot see A, even inside the same organization.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$
declare n integer;
begin
  select count(*) into n from public.visits where patient_id='aaaa0000-0000-4000-8000-000000000001';
  if n <> 0 then raise exception 'Professional B can see A assigned visit'; end if;
  select count(*) into n from public.clinical_records;
  if n <> 1 then raise exception 'Professional B clinical scope invalid'; end if;
  select count(*) into n from public.patients;
  if n <> 1 then raise exception 'Professional B patient scope invalid'; end if;
end $$;
commit;

-- Coordinator sees operational and administrative attendance, NOT clinical content.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $$
declare n integer;
begin
  select count(*) into n from public.visits;
  if n <> 2 then raise exception 'Coordinator expected 2 visits, got %',n; end if;
  select count(*) into n from public.patients;
  if n <> 2 then raise exception 'Coordinator expected 2 patients, got %',n; end if;
  select count(*) into n from public.clinical_records;
  if n <> 0 then raise exception 'Coordinator must not see clinical notes'; end if;
  select count(*) into n from public.attendance_evidence;
  if n <> 1 then raise exception 'Coordinator expected attendance metadata'; end if;
  select count(*) into n from public.audit_events;
  if n <> 0 then raise exception 'Coordinator must not see audit events'; end if;
end $$;
commit;

-- Admin may see audit and operations but NOT clinical narrative.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$
declare n integer;
begin
  select count(*) into n from public.visits;
  if n <> 2 then raise exception 'Admin operational scope invalid'; end if;
  select count(*) into n from public.clinical_records;
  if n <> 0 then raise exception 'Admin must not see clinical notes by default'; end if;
  select count(*) into n from public.audit_events;
  if n <> 1 then raise exception 'Admin audit permission missing'; end if;
end $$;
commit;

-- Auditor can see ONLY audit and organization membership, not patients/visits.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
do $$
declare n integer;
begin
  select count(*) into n from public.audit_events;
  if n <> 1 then raise exception 'Auditor cannot access audit log'; end if;
  select count(*) into n from public.visits;
  if n <> 0 then raise exception 'Auditor sees visits'; end if;
  select count(*) into n from public.patients;
  if n <> 0 then raise exception 'Auditor sees patients'; end if;
  select count(*) into n from public.clinical_records;
  if n <> 0 then raise exception 'Auditor sees notes'; end if;
end $$;
commit;

-- Cross-tenant patient isolation.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
do $$
declare n integer;
begin
  select count(*) into n from public.visits;
  if n <> 1 then raise exception 'Other organization visit isolation broken'; end if;
  select count(*) into n from public.clinical_records;
  if n <> 1 then raise exception 'Other organization clinical isolation broken'; end if;
  select count(*) into n from public.patients;
  if n <> 1 then raise exception 'Other organization patient isolation broken'; end if;
end $$;
commit;

-- Deactivated member (even ADMIN) sees zero rows.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
do $$
declare n integer;
begin
  select count(*) into n from public.organizations;
  if n <> 0 then raise exception 'Inactive member still sees org'; end if;
  select count(*) into n from public.visits;
  if n <> 0 then raise exception 'Inactive member still sees visits'; end if;
  select count(*) into n from public.patients;
  if n <> 0 then raise exception 'Inactive member still sees patients'; end if;
end $$;
commit;

-- Anonymous users do not have SELECT privilege; catch the expected SQL failure.
begin;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$
declare blocked boolean := false;
begin
  begin
    perform count(*) from public.patients;
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then raise exception 'ANON_PATIENT_READ_ALLOWED'; end if;
end $$;
commit;

-- Even a logged-in PROFESSIONAL cannot create membership, edit visits or insert evidence.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare
  member_insert_blocked boolean := false;
  visit_update_blocked boolean := false;
  evidence_insert_blocked boolean := false;
begin
  begin
    insert into public.memberships(organization_id,user_id,app_role,active)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            '77777777-7777-4777-8777-777777777777','ADMIN',true);
  exception when insufficient_privilege then member_insert_blocked := true;
  end;
  begin
    update public.visits set state='CLOSED_VERIFIED';
  exception when insufficient_privilege then visit_update_blocked := true;
  end;
  begin
    insert into public.attendance_evidence(organization_id,visit_id,document_sha256,outcome)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            '1111bbbb-0000-4000-8000-000000000001',repeat('f',64),'SIGNED_ELECTRONIC');
  exception when insufficient_privilege then evidence_insert_blocked := true;
  end;
  if not (member_insert_blocked and visit_update_blocked and evidence_insert_blocked) then
    raise exception 'CLIENT_MUTATION_NOT_BLOCKED: % % %',
      member_insert_blocked,visit_update_blocked,evidence_insert_blocked;
  end if;
end $$;
commit;

-- A server-side attempt to attach another organization's patient to a visit is impossible.
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.visits(organization_id,patient_id,professional_id,scheduled_start,scheduled_end)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbb0000-0000-4000-8000-000000000003',
      '1111aaaa-0000-4000-8000-000000000001',
      '2026-10-10T16:00:00Z','2026-10-10T17:00:00Z');
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'CROSS_ORGANIZATION_VISIT_INSERT_ALLOWED'; end if;
end $$;

-- Active membership revocation is immediately enforced by RLS (no roles from stale JWT).
update public.memberships set active=false
where user_id='11111111-1111-4111-8111-111111111111';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare n integer;
begin
  select count(*) into n from public.visits;
  if n <> 0 then raise exception 'Revoked professional still sees visits'; end if;
  select count(*) into n from public.clinical_records;
  if n <> 0 then raise exception 'Revoked professional still sees records'; end if;
end $$;
commit;

select 'SUPA-01: ALL RLS AND INTEGRITY ASSERTIONS PASSED' as test_result;
