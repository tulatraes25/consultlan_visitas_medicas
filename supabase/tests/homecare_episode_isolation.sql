-- HC-01 integration tests. Run AFTER SUPA-01 and SUPA-02 existing suites.
-- All IDs and descriptions are synthetic, no clinical cases or treatment data.
\set ON_ERROR_STOP on

-- SUPA-02 suite ends by revoking user A. Restore synthetic fixture membership only.
update public.memberships set active = true
where organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id='11111111-1111-4111-8111-111111111111';

insert into public.homecare_episodes(
  id,organization_id,patient_id,episode_state,opened_at,activated_at,
  lead_professional_id)
values
('e1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaa0000-0000-4000-8000-000000000001','ACTIVE',
 '2026-10-09T10:00:00Z','2026-10-10T10:00:00Z',
 '1111aaaa-0000-4000-8000-000000000001'),
('e2000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaa0000-0000-4000-8000-000000000002','ACTIVE',
 '2026-10-09T10:00:00Z','2026-10-10T10:00:00Z',
 '2222aaaa-0000-4000-8000-000000000002'),
('e3000000-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'bbbb0000-0000-4000-8000-000000000003','ACTIVE',
 '2026-10-09T10:00:00Z','2026-10-10T10:00:00Z',
 '6666aaaa-0000-4000-8000-000000000003'),
('e4000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaa0000-0000-4000-8000-000000000001','DRAFT',
 '2026-10-09T10:00:00Z',null,null);

insert into public.homecare_care_team(
  episode_id,organization_id,professional_id,team_function,active)
values
('e1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '1111aaaa-0000-4000-8000-000000000001','LEAD',true),
('e2000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '2222aaaa-0000-4000-8000-000000000002','LEAD',true),
('e3000000-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '6666aaaa-0000-4000-8000-000000000003','LEAD',true);

insert into public.homecare_care_plan_versions(
  episode_id,organization_id,version_number,plan_state,
  approved_by_user_id,approved_at,valid_from)
values
('e1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 1,'APPROVED','11111111-1111-4111-8111-111111111111',
 '2026-10-10T10:00:00Z','2026-10-10T10:00:00Z'),
('e2000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 1,'APPROVED','22222222-2222-4222-8222-222222222222',
 '2026-10-10T10:00:00Z','2026-10-10T10:00:00Z'),
('e3000000-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 1,'APPROVED','66666666-6666-4666-8666-666666666666',
 '2026-10-10T10:00:00Z','2026-10-10T10:00:00Z'),
('e4000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 1,'DRAFT',null,null,null);

-- These fixtures only exercise relational validity; there is no clinical
-- approval process in HC-01 and these are NOT proof of authentic orders.
insert into public.visits(
  id,organization_id,patient_id,professional_id,homecare_episode_id,
  care_plan_version,scheduled_start,scheduled_end,state)
values
('c1000000-0000-4000-8000-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaa0000-0000-4000-8000-000000000001',
 '1111aaaa-0000-4000-8000-000000000001',
 'e1000000-0000-4000-8000-000000000001',1,
 '2026-10-12T10:00:00Z','2026-10-12T11:00:00Z','ASSIGNED'),
('c2000000-0000-4000-8000-000000000002',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaa0000-0000-4000-8000-000000000002',
 '2222aaaa-0000-4000-8000-000000000002',
 'e2000000-0000-4000-8000-000000000002',1,
 '2026-10-12T11:00:00Z','2026-10-12T12:00:00Z','ASSIGNED'),
('c3000000-0000-4000-8000-000000000003',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'bbbb0000-0000-4000-8000-000000000003',
 '6666aaaa-0000-4000-8000-000000000003',
 'e3000000-0000-4000-8000-000000000003',1,
 '2026-10-12T12:00:00Z','2026-10-12T13:00:00Z','ASSIGNED');

insert into public.clinical_records(
  organization_id,visit_id,author_user_id,version_number,narrative)
values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'c1000000-0000-4000-8000-000000000001',
 '11111111-1111-4111-8111-111111111111',1,'Registro de demostración X'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'c2000000-0000-4000-8000-000000000002',
 '22222222-2222-4222-8222-222222222222',1,'Registro de demostración Y');

-- Professional A: case/plan/team/visit/narrative only for active case A,
-- and NO legacy unbound visit, NO second professional's notes or other tenant.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare n integer;
begin
  select count(*) into n from public.homecare_episodes;
  if n <> 1 then raise exception 'TEAM_A_EPISODES: %',n; end if;
  select count(*) into n from public.homecare_care_team;
  if n <> 1 then raise exception 'TEAM_A_MEMBERSHIPS: %',n; end if;
  select count(*) into n from public.homecare_care_plan_versions;
  if n <> 1 then raise exception 'TEAM_A_PLAN_METADATA: %',n; end if;
  select count(*) into n from public.visits;
  if n <> 1 then raise exception 'TEAM_A_BOUND_VISITS: %',n; end if;
  select count(*) into n from public.clinical_records;
  if n <> 1 then raise exception 'TEAM_A_CLINICAL_NOTES: %',n; end if;
  select count(*) into n from public.patients;
  if n <> 1 then raise exception 'TEAM_A_PATIENTS: %',n; end if;
  select count(*) into n from public.visits where homecare_episode_id is null;
  if n <> 0 then raise exception 'LEGACY_VISITS_LEAK_TO_CLINICIAN'; end if;
end $$;
commit;

-- Other professional of SAME organization cannot inspect A's homecare case.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$
declare n integer;
begin
  select count(*) into n from public.homecare_episodes
    where id='e1000000-0000-4000-8000-000000000001';
  if n <> 0 then raise exception 'UNASSIGNED_STAFF_CAN_READ_EPISODE'; end if;
  select count(*) into n from public.homecare_care_plan_versions
    where episode_id='e1000000-0000-4000-8000-000000000001';
  if n <> 0 then raise exception 'UNASSIGNED_STAFF_CAN_READ_PLAN'; end if;
  select count(*) into n from public.clinical_records
    where visit_id='c1000000-0000-4000-8000-000000000001';
  if n <> 0 then raise exception 'UNASSIGNED_STAFF_CAN_READ_CLINICAL'; end if;
  select count(*) into n from public.visits;
  if n <> 1 then raise exception 'TEAM_B_VISIT_SCOPE: %',n; end if;
end $$;
commit;

-- Coordination may inspect operational metadata, NOT other clinicians' notes.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $$
declare n integer;
begin
  select count(*) into n from public.homecare_episodes;
  if n <> 3 then raise exception 'COORDINATOR_EPISODE_SCOPE: %',n; end if;
  select count(*) into n from public.visits;
  if n <> 2 then raise exception 'COORDINATOR_HAS_LEGACY_VISITS: %',n; end if;
  select count(*) into n from public.homecare_care_plan_versions;
  if n <> 3 then raise exception 'COORDINATOR_PLAN_METADATA_SCOPE: %',n; end if;
  select count(*) into n from public.clinical_records;
  if n <> 0 then raise exception 'COORDINATOR_CLINICAL_SCOPE_BREACH'; end if;
  select count(*) into n from public.attendance_evidence;
  if n <> 0 then raise exception 'COORDINATOR_LEGACY_EVIDENCE_EXPOSURE'; end if;
end $$;
commit;

-- Separate organization and auditor are fully isolated from program patients.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
do $$
declare n integer;
begin
  select count(*) into n from public.homecare_episodes;
  if n <> 1 then raise exception 'CROSS_TENANT_EPISODE_SCOPE: %',n; end if;
  select count(*) into n from public.visits;
  if n <> 1 then raise exception 'CROSS_TENANT_VISIT_SCOPE: %',n; end if;
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
do $$
declare n integer;
begin
  select count(*) into n from public.homecare_episodes;
  if n <> 0 then raise exception 'AUDITOR_CAN_READ_EPISODES'; end if;
  select count(*) into n from public.homecare_care_plan_versions;
  if n <> 0 then raise exception 'AUDITOR_CAN_READ_PLANS'; end if;
  select count(*) into n from public.homecare_care_team;
  if n <> 0 then raise exception 'AUDITOR_CAN_READ_TEAM'; end if;
end $$;
commit;

-- No INSERT/UPDATE/DELETE privileges on new tables for users with valid JWTs.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$
declare blocked_episode boolean := false;
declare blocked_team boolean := false;
declare blocked_plan boolean := false;
begin
  begin
    insert into public.homecare_episodes(organization_id,patient_id)
      values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaa0000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then blocked_episode:=true;
  end;
  begin
    update public.homecare_care_team set active=false;
  exception when insufficient_privilege then blocked_team:=true;
  end;
  begin
    update public.homecare_care_plan_versions set plan_state='APPROVED';
  exception when insufficient_privilege then blocked_plan:=true;
  end;
  if not (blocked_episode and blocked_team and blocked_plan) then
    raise exception 'DIRECT_MOBILE_WRITES_ALLOWED: % % %',
      blocked_episode,blocked_team,blocked_plan;
  end if;
end $$;
commit;

begin;
set local role anon;
do $$
declare blocked boolean := false;
begin
  begin
    perform count(*) from public.homecare_episodes;
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'ANON_READS_EPISODES'; end if;
end $$;
commit;

-- Neither migration NOR synthetic test creates an invented clinical episode
-- to backfill an older prototype visit. New writes must include both IDs.
do $$
declare rejected boolean := false;
begin
  begin
    insert into public.visits(
      organization_id,patient_id,professional_id,scheduled_start,scheduled_end,state)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaa0000-0000-4000-8000-000000000001',
      '1111aaaa-0000-4000-8000-000000000001',
      '2026-10-15T10:00:00Z','2026-10-15T11:00:00Z','ASSIGNED');
  exception when check_violation or insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'UNBOUND_NEW_VISIT_INSERTED'; end if;
end $$;

-- Composite FK: same patient, episode and organization, even for cancelled rows.
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.visits(
      organization_id,patient_id,professional_id,homecare_episode_id,care_plan_version,
      scheduled_start,scheduled_end,state)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaa0000-0000-4000-8000-000000000002',
      '1111aaaa-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001',1,
      '2026-10-15T13:00:00Z','2026-10-15T14:00:00Z','CANCELLED');
  exception when foreign_key_violation then blocked:=true;
  end;
  if not blocked then raise exception 'CROSS_PATIENT_EPISODE_ALLOWED'; end if;
end $$;

-- Wrong plan number violates FK even when visit has a terminal state.
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.visits(
      organization_id,patient_id,professional_id,homecare_episode_id,care_plan_version,
      scheduled_start,scheduled_end,state)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaa0000-0000-4000-8000-000000000001',
      '1111aaaa-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001',99,
      '2026-10-15T15:00:00Z','2026-10-15T16:00:00Z','CANCELLED');
  exception when foreign_key_violation then blocked:=true;
  end;
  if not blocked then raise exception 'FOREIGN_OR_MISSING_PLAN_ACCEPTED'; end if;
end $$;

-- Draft plan exists but may NOT authorize an actual visit.
insert into public.homecare_care_plan_versions(
  episode_id,organization_id,version_number,plan_state)
values('e1000000-0000-4000-8000-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2,'DRAFT');
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.visits(
      organization_id,patient_id,professional_id,homecare_episode_id,care_plan_version,
      scheduled_start,scheduled_end,state)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaa0000-0000-4000-8000-000000000001',
      '1111aaaa-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001',2,
      '2026-10-15T17:00:00Z','2026-10-15T18:00:00Z','ASSIGNED');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'DRAFT_CARE_PLAN_AUTHORIZED_VISIT'; end if;
end $$;

-- Assigned but unapproved/absent clinician has no ability to operate on a case.
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.visits(
      organization_id,patient_id,professional_id,homecare_episode_id,care_plan_version,
      scheduled_start,scheduled_end,state)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaa0000-0000-4000-8000-000000000001',
      '2222aaaa-0000-4000-8000-000000000002',
      'e1000000-0000-4000-8000-000000000001',1,
      '2026-10-15T19:00:00Z','2026-10-15T20:00:00Z','ASSIGNED');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'NON_TEAM_PROFESSIONAL_ASSIGNED_TO_CASE'; end if;
end $$;

-- Even the trusted backend may NOT call the historical unbound scheduling API.
begin;
set local role service_role;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.api_schedule_visit(
      '33333333-3333-4333-8333-333333333333',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaa0000-0000-4000-8000-000000000001',
      '1111aaaa-0000-4000-8000-000000000001',
      '2026-10-16T10:00:00Z','2026-10-16T11:00:00Z',
      'dead0000-0000-4000-8000-000000000001');
  exception when insufficient_privilege or check_violation then blocked:=true;
  end;
  if not blocked then raise exception 'LEGACY_SCHEDULING_BYPASS'; end if;
end $$;
commit;

-- Revocation immediately blocks read even with the same old JWT subject.
update public.memberships set active=false
where user_id='11111111-1111-4111-8111-111111111111'
  and organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare n integer;
begin
  select count(*) into n from public.homecare_episodes;
  if n <> 0 then raise exception 'REVOKED_USER_READS_CASES'; end if;
  select count(*) into n from public.visits;
  if n <> 0 then raise exception 'REVOKED_USER_READS_VISITS'; end if;
  select count(*) into n from public.clinical_records;
  if n <> 0 then raise exception 'REVOKED_USER_READS_NOTES'; end if;
end $$;
commit;

-- Confirm no clinic/CONSULTLAN cross-system FK fields exist in homecare model.
do $$
declare n integer;
begin
  select count(*) into n from information_schema.columns
    where table_schema='public'
      and table_name in (
        'homecare_episodes','homecare_care_team','homecare_care_plan_versions'
      )
      and column_name ~* 'consultlan|clinic.*patient|external.*patient';
  if n <> 0 then raise exception 'EXTERNAL_CLINIC_PATIENT_REF_PRESENT'; end if;
end $$;

select 'HC-01: HOMECARE EPISODES / PLAN / TEAM / RLS PASSED' as test_result;
