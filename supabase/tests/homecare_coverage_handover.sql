-- HC-02A PostgreSQL integration. Execute AFTER HC-01 suite.
-- All rows are invented and contain no orders, diagnoses or family identities.
\set ON_ERROR_STOP on

-- HC-01 suite intentionally revoked synthetic clinician A: restore fixture.
update public.memberships set active=true
where organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id='11111111-1111-4111-8111-111111111111';

-- A homecare shift can be handed over from professional A to B; both must
-- belong to the same homecare episode's care team.
insert into public.homecare_care_team(
  episode_id,organization_id,professional_id,team_function,active)
values (
 'e1000000-0000-4000-8000-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '2222aaaa-0000-4000-8000-000000000002',
 'CARE_TEAM',true
);

insert into public.homecare_coverage_assignments(
 id,organization_id,episode_id,patient_id,professional_id,care_plan_version,
 service_kind,coverage_state,scheduled_start,scheduled_end)
values
('d1000000-0000-4000-8000-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e1000000-0000-4000-8000-000000000001',
 'aaaa0000-0000-4000-8000-000000000001','1111aaaa-0000-4000-8000-000000000001',
 1,'VISIT','ASSIGNED','2026-10-19T11:00:00Z','2026-10-19T12:00:00Z'),
('d1000000-0000-4000-8000-000000000002',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e1000000-0000-4000-8000-000000000001',
 'aaaa0000-0000-4000-8000-000000000001','1111aaaa-0000-4000-8000-000000000001',
 1,'SHIFT','ASSIGNED','2026-10-20T06:00:00Z','2026-10-20T18:00:00Z'),
('d1000000-0000-4000-8000-000000000003',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e1000000-0000-4000-8000-000000000001',
 'aaaa0000-0000-4000-8000-000000000001','2222aaaa-0000-4000-8000-000000000002',
 1,'SHIFT','ASSIGNED','2026-10-20T18:00:00Z','2026-10-20T23:00:00Z'),
('d1000000-0000-4000-8000-000000000004',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e2000000-0000-4000-8000-000000000002',
 'aaaa0000-0000-4000-8000-000000000002','2222aaaa-0000-4000-8000-000000000002',
 1,'SHIFT','ASSIGNED','2026-10-21T06:00:00Z','2026-10-21T18:00:00Z'),
('d1000000-0000-4000-8000-000000000005',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','e3000000-0000-4000-8000-000000000003',
 'bbbb0000-0000-4000-8000-000000000003','6666aaaa-0000-4000-8000-000000000003',
 1,'SHIFT','ASSIGNED','2026-10-20T06:00:00Z','2026-10-20T18:00:00Z');

insert into public.homecare_shift_handovers(
 id,organization_id,episode_id,from_assignment_id,to_assignment_id,
 handover_state,acknowledged_by_user_id,acknowledged_at)
values (
 'f1000000-0000-4000-8000-000000000001',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'e1000000-0000-4000-8000-000000000001',
 'd1000000-0000-4000-8000-000000000002',
 'd1000000-0000-4000-8000-000000000003',
 'ACKNOWLEDGED','22222222-2222-4222-8222-222222222222',
 '2026-10-20T18:02:00Z'
);

-- Unlike HC-01 legacy fixtures, this VISIT is linked to canonical roster.
insert into public.visits(
 id,organization_id,patient_id,professional_id,homecare_episode_id,
 care_plan_version,homecare_coverage_id,scheduled_start,scheduled_end,state)
values(
 'c4000000-0000-4000-8000-000000000004',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaa0000-0000-4000-8000-000000000001',
 '1111aaaa-0000-4000-8000-000000000001',
 'e1000000-0000-4000-8000-000000000001',1,
 'd1000000-0000-4000-8000-000000000001',
 '2026-10-19T11:00:00Z','2026-10-19T12:00:00Z','ASSIGNED'
);
insert into public.clinical_records(
 organization_id,visit_id,author_user_id,version_number,narrative)
values(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'c4000000-0000-4000-8000-000000000004',
 '11111111-1111-4111-8111-111111111111',1,
 'Nota ficticia de visita, no expediente real'
);

-- Read scopes: professional sees only own roster, own new clinical visit,
-- and own participation in handover, NOT another professional's narratives.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare n integer;
begin
  select count(*) into n from public.homecare_coverage_assignments;
  if n<>2 then raise exception 'PRO_A_COVERAGE_SCOPE: %',n; end if;
  select count(*) into n from public.homecare_shift_handovers;
  if n<>1 then raise exception 'PRO_A_HANDOVER_SCOPE: %',n; end if;
  select count(*) into n from public.visits;
  if n<>1 then raise exception 'PRO_A_VISIT_SCOPE: %',n; end if;
  select count(*) into n from public.clinical_records;
  if n<>1 then raise exception 'PRO_A_NOTE_SCOPE: %',n; end if;
  select count(*) into n from public.patients;
  if n<>1 then raise exception 'PRO_A_PATIENT_SCOPE: %',n; end if;
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$
declare n integer;
begin
  select count(*) into n from public.homecare_coverage_assignments;
  if n<>2 then raise exception 'PRO_B_COVERAGE_SCOPE: %',n; end if;
  select count(*) into n from public.homecare_shift_handovers;
  if n<>1 then raise exception 'PRO_B_HANDOVER_SCOPE: %',n; end if;
  select count(*) into n from public.visits;
  if n<>0 then raise exception 'PRO_B_CAN_READ_PRO_A_VISIT'; end if;
  select count(*) into n from public.clinical_records;
  if n<>0 then raise exception 'PRO_B_CAN_READ_PRO_A_NOTES'; end if;
  select count(*) into n from public.patients;
  if n<>2 then raise exception 'PRO_B_PATIENT_SCOPE: %',n; end if;
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $$
declare n integer;
begin
  select count(*) into n from public.homecare_coverage_assignments;
  if n<>4 then raise exception 'COORDINATOR_COVERAGE_SCOPE: %',n; end if;
  select count(*) into n from public.homecare_shift_handovers;
  if n<>1 then raise exception 'COORDINATOR_HANDOVER_SCOPE: %',n; end if;
  select count(*) into n from public.clinical_records;
  if n<>0 then raise exception 'COORDINATOR_READS_CLINICAL_NOTES'; end if;
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
do $$
declare n integer;
begin
  select count(*) into n from public.homecare_coverage_assignments;
  if n<>1 then raise exception 'CROSS_ORG_COVERAGE_SCOPE: %',n; end if;
  select count(*) into n from public.homecare_shift_handovers;
  if n<>0 then raise exception 'CROSS_ORG_HANDOVER_LEAK'; end if;
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
do $$
declare n integer;
begin
  select count(*) into n from public.homecare_coverage_assignments;
  if n<>0 then raise exception 'AUDITOR_COVERAGE_READ'; end if;
  select count(*) into n from public.homecare_shift_handovers;
  if n<>0 then raise exception 'AUDITOR_HANDOVER_READ'; end if;
end $$;
commit;

-- Direct writes are forbidden even to app ADMIN, and to backend service_role
-- until HC-02B creates an authenticated, audited and versioned command layer.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$
declare blocked_coverage boolean := false;
  blocked_handover boolean := false;
begin
  begin
    update public.homecare_coverage_assignments set coverage_state='CANCELLED';
  exception when insufficient_privilege then blocked_coverage:=true;
  end;
  begin
    update public.homecare_shift_handovers set handover_state='DECLINED';
  exception when insufficient_privilege then blocked_handover:=true;
  end;
  if not (blocked_coverage and blocked_handover) then
    raise exception 'CLIENT_MUTATED_COVERAGE_OR_HANDOVER';
  end if;
end $$;
commit;

begin;
set local role service_role;
do $$
declare blocked boolean := false;
begin
  begin
    update public.homecare_coverage_assignments set coverage_state='CANCELLED';
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'BACKEND_UNAUDITED_COVERAGE_MUTATION'; end if;
end $$;
commit;

-- No scheduling overlap within the CANONICAL shared ledger, regardless
-- of VISIT vs SHIFT; half-open adjacent shifts remain valid.
do $$
declare rejected boolean := false;
begin
  begin
    insert into public.homecare_coverage_assignments(
      organization_id,episode_id,patient_id,professional_id,care_plan_version,
      service_kind,coverage_state,scheduled_start,scheduled_end)
    values(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'e1000000-0000-4000-8000-000000000001',
      'aaaa0000-0000-4000-8000-000000000001',
      '1111aaaa-0000-4000-8000-000000000001',
      1,'VISIT','ASSIGNED','2026-10-20T10:00:00Z','2026-10-20T11:00:00Z');
  exception when exclusion_violation then rejected:=true;
  end;
  if not rejected then raise exception 'DOUBLE_BOOKED_VISIT_DURING_SHIFT'; end if;
end $$;

-- A plan in DRAFT or a professional outside the active case cannot staff it.
do $$
declare rejected_plan boolean := false;
  rejected_team boolean := false;
begin
  begin
    insert into public.homecare_coverage_assignments(
      organization_id,episode_id,patient_id,professional_id,care_plan_version,
      service_kind,scheduled_start,scheduled_end)
    values(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'e1000000-0000-4000-8000-000000000001',
      'aaaa0000-0000-4000-8000-000000000001',
      '1111aaaa-0000-4000-8000-000000000001',2,'SHIFT',
      '2026-10-25T06:00:00Z','2026-10-25T12:00:00Z');
  exception when insufficient_privilege then rejected_plan:=true;
  end;
  begin
    insert into public.homecare_coverage_assignments(
      organization_id,episode_id,patient_id,professional_id,care_plan_version,
      service_kind,scheduled_start,scheduled_end)
    values(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'e2000000-0000-4000-8000-000000000002',
      'aaaa0000-0000-4000-8000-000000000002',
      '1111aaaa-0000-4000-8000-000000000001',1,'SHIFT',
      '2026-10-25T12:00:00Z','2026-10-25T18:00:00Z');
  exception when insufficient_privilege then rejected_team:=true;
  end;
  if not rejected_plan or not rejected_team then
    raise exception 'INVALID_CARE_PLAN_OR_TEAM_ACCEPTED';
  end if;
end $$;

-- Handovers require SHIFT -> SHIFT, same episode, and outgoing != incoming.
do $$
declare rejected_mode boolean := false;
  rejected_case boolean := false;
  rejected_ack boolean := false;
begin
  begin
    insert into public.homecare_shift_handovers(
      organization_id,episode_id,from_assignment_id,to_assignment_id)
    values(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'e1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000003');
  exception when insufficient_privilege then rejected_mode:=true;
  end;
  begin
    insert into public.homecare_shift_handovers(
      organization_id,episode_id,from_assignment_id,to_assignment_id)
    values(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'e1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000002',
      'd1000000-0000-4000-8000-000000000004');
  exception when foreign_key_violation then rejected_case:=true;
  end;
  begin
    insert into public.homecare_shift_handovers(
      organization_id,episode_id,from_assignment_id,to_assignment_id,
      handover_state,acknowledged_by_user_id,acknowledged_at)
    values(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'e1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000002',
      'd1000000-0000-4000-8000-000000000003',
      'ACKNOWLEDGED','11111111-1111-4111-8111-111111111111',
      '2026-10-20T18:05:00Z');
  exception when insufficient_privilege then rejected_ack:=true;
  end;
  if not (rejected_mode and rejected_case and rejected_ack) then
    raise exception 'INVALID_HANDOVER_ACCEPTED % % %',
      rejected_mode,rejected_case,rejected_ack;
  end if;
end $$;

-- A routine VISIT must reference a matching VISIT assignment, not a SHIFT,
-- not an unrelated time window or another child's episode.
do $$
declare no_roster boolean := false;
  wrong_mode boolean := false;
  wrong_interval boolean := false;
begin
  begin
    insert into public.visits(
      organization_id,patient_id,professional_id,homecare_episode_id,
      care_plan_version,scheduled_start,scheduled_end,state)
    values(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaa0000-0000-4000-8000-000000000001',
      '1111aaaa-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001',1,
      '2026-10-26T10:00:00Z','2026-10-26T11:00:00Z','ASSIGNED');
  exception when check_violation or insufficient_privilege then no_roster:=true;
  end;
  begin
    insert into public.visits(
      organization_id,patient_id,professional_id,homecare_episode_id,
      care_plan_version,homecare_coverage_id,scheduled_start,scheduled_end,state)
    values(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaa0000-0000-4000-8000-000000000001',
      '1111aaaa-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001',1,
      'd1000000-0000-4000-8000-000000000002',
      '2026-10-20T06:00:00Z','2026-10-20T18:00:00Z','ASSIGNED');
  exception when insufficient_privilege then wrong_mode:=true;
  end;
  begin
    insert into public.visits(
      organization_id,patient_id,professional_id,homecare_episode_id,
      care_plan_version,homecare_coverage_id,scheduled_start,scheduled_end,state)
    values(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaa0000-0000-4000-8000-000000000001',
      '1111aaaa-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001',1,
      'd1000000-0000-4000-8000-000000000001',
      '2026-10-19T12:00:00Z','2026-10-19T13:00:00Z','ASSIGNED');
  exception when insufficient_privilege then wrong_interval:=true;
  end;
  if not(no_roster and wrong_mode and wrong_interval) then
    raise exception 'VISIT_ROSTER_LINK_NOT_ENFORCED: % % %',
      no_roster,wrong_mode,wrong_interval;
  end if;
end $$;

-- No false "visit" presentation for the older case-bound demo rows.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$
declare n integer;
begin
  select count(*) into n from public.visits where homecare_coverage_id is null;
  if n<>0 then raise exception 'LEGACY_UNLINKED_VISITS_VISIBLE'; end if;
  select count(*) into n from public.clinical_records;
  if n<>0 then raise exception 'ADMIN_READS_CLINICAL_RECORDS'; end if;
end $$;
commit;

select 'HC-02A: CANONICAL ROSTER / HANDOVERS / RLS PASSED' as test_result;
