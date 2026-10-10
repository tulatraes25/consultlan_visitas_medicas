-- SUPA-02 integration suite, executed AFTER rls_isolation.sql on synthetic CI DB.
\set ON_ERROR_STOP on

insert into auth.users(id) values ('88888888-8888-4888-8888-888888888888');
-- SUPA-01 test ends by revoking professional A: restore ONLY as a synthetic fixture.
update public.memberships set active=true where
  organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id='11111111-1111-4111-8111-111111111111';

-- Ensure RPCs cannot be called by mobile roles, including with a forged admin UUID.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare rejected boolean := false;
begin
  begin
    perform public.api_create_patient(
      '44444444-4444-4444-8444-444444444444',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Victima simulada',
      '10000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'AUTHENTICATED_CAN_CALL_ADMIN_RPC'; end if;
end $$;
commit;

begin;
set local role anon;
do $$
declare rejected boolean := false;
begin
  begin
    perform public.api_begin_visit(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '1111bbbb-0000-4000-8000-000000000001');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'ANON_CAN_CALL_PROFESSIONAL_RPC'; end if;
end $$;
commit;

-- Trusted server role with genuine verified actor (emulated) can call commands,
-- but each command must STILL check actor's membership and scope.
begin;
set local role service_role;
do $$
declare
  org_a constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  org_b constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  admin_a constant uuid := '44444444-4444-4444-8444-444444444444';
  coor_a constant uuid := '33333333-3333-4333-8333-333333333333';
  prof_a constant uuid := '11111111-1111-4111-8111-111111111111';
  prof_b constant uuid := '22222222-2222-4222-8222-222222222222';
  user_new constant uuid := '88888888-8888-4888-8888-888888888888';
  original_visit constant uuid := '1111bbbb-0000-4000-8000-000000000001';
  original_prof constant uuid := '1111aaaa-0000-4000-8000-000000000001';
  patient_key constant uuid := '10000000-0000-4000-8000-000000000002';
  visit_key constant uuid := '10000000-0000-4000-8000-000000000003';
  note_key constant uuid := '10000000-0000-4000-8000-000000000004';
  new_patient uuid;
  new_prof uuid;
  new_visit uuid;
  n integer;
  rejected boolean;
begin
  -- Coordinator can create patient. Same key = same resource; different body is denied.
  new_patient:=public.api_create_patient(coor_a,org_a,'Paciente sintético nuevo',patient_key);
  if new_patient is null or
    public.api_create_patient(coor_a,org_a,'Paciente sintético nuevo',patient_key)<>new_patient then
    raise exception 'PATIENT_IDEMPOTENCY_FAILED';
  end if;
  select count(*) into n from public.patients where organization_id=org_a and request_key=patient_key;
  if n<>1 then raise exception 'PATIENT_DUPLICATE_CREATED'; end if;
  rejected:=false;
  begin
    perform public.api_create_patient(coor_a,org_a,'Otro nombre sintético',patient_key);
  exception when unique_violation then rejected:=true;
  end;
  if not rejected then raise exception 'REUSED_PATIENT_KEY_NOT_REJECTED'; end if;
  rejected:=false;
  begin
    perform public.api_create_patient(prof_b,org_a,'Escalada ficticia',
      '10000000-0000-4000-8000-000000000005');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'PROFESSIONAL_CREATED_PATIENT'; end if;
  rejected:=false;
  begin
    perform public.api_create_patient(admin_a,org_b,'Cross organization',
      '10000000-0000-4000-8000-000000000006');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'CROSS_ORG_ADMIN_CREATED_PATIENT'; end if;

  -- Only ADMIN can register a user ALREADY created in this Supabase Auth.
  rejected:=false;
  begin
    perform public.api_register_professional(coor_a,org_a,user_new,'MEDICINA');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'COORDINATOR_REGISTERED_PROFESSIONAL'; end if;
  new_prof:=public.api_register_professional(admin_a,org_a,user_new,'MEDICINA');
  if new_prof is null or not exists(
     select 1 from public.memberships where organization_id=org_a
      and user_id=user_new and app_role='PROFESSIONAL' and active
  ) then raise exception 'PROFESSIONAL_INVITATION_LINK_FAILED'; end if;
  rejected:=false;
  begin
    perform public.api_register_professional(admin_a,org_a,user_new,'MEDICINA');
  exception when unique_violation then rejected:=true;
  end;
  if not rejected then raise exception 'EXISTING_ROLE_OVERWRITTEN'; end if;

  -- A non-overlapping scheduled visit may be created once; retries return same id.
  new_visit:=public.api_schedule_visit(
    coor_a,org_a,new_patient,original_prof,
    '2026-10-11T18:00:00Z','2026-10-11T19:00:00Z',visit_key);
  if public.api_schedule_visit(
    coor_a,org_a,new_patient,original_prof,
    '2026-10-11T18:00:00Z','2026-10-11T19:00:00Z',visit_key)<>new_visit then
    raise exception 'VISIT_IDEMPOTENCY_FAILED';
  end if;
  rejected:=false;
  begin
    perform public.api_schedule_visit(
      coor_a,org_a,new_patient,original_prof,
      '2026-10-11T20:00:00Z','2026-10-11T21:00:00Z',visit_key);
  exception when unique_violation then rejected:=true;
  end;
  if not rejected then raise exception 'REUSED_VISIT_KEY_WITH_CHANGED_PAYLOAD'; end if;

  -- Concurrency-safe exclusion: two different requests cannot double-book a professional.
  rejected:=false;
  begin
    perform public.api_schedule_visit(
      coor_a,org_a,new_patient,original_prof,
      '2026-10-11T18:30:00Z','2026-10-11T19:30:00Z',
      '10000000-0000-4000-8000-000000000007');
  exception when exclusion_violation then rejected:=true;
  end;
  if not rejected then raise exception 'OVERLAPPING_PROFESSIONAL_ASSIGNMENT'; end if;

  -- Every backend action validates authenticated actor membership (never user_metadata).
  rejected:=false;
  begin
    perform public.api_schedule_visit(
      admin_a,org_b,new_patient,original_prof,
      '2026-10-11T22:00:00Z','2026-10-11T23:00:00Z',
      '10000000-0000-4000-8000-000000000008');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'SERVICE_ROLE_ACTOR_SCOPE_BROKEN'; end if;

  -- Assigned professional only: start, version clinical note, then request review.
  rejected:=false;
  begin
    perform public.api_begin_visit(prof_b,org_a,original_visit);
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'OTHER_PROFESSIONAL_STARTED_VISIT'; end if;

  perform public.api_begin_visit(prof_a,org_a,original_visit);
  if not exists(select 1 from public.visits
      where id=original_visit and state='IN_PROGRESS' and started_at is not null) then
    raise exception 'VISIT_START_NOT_RECORDED';
  end if;
  rejected:=false;
  begin
    perform public.api_begin_visit(prof_a,org_a,original_visit);
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'DUPLICATE_START_ALLOWED'; end if;

  n:=public.api_add_clinical_note(prof_a,org_a,original_visit,'Nota ficticia versión 2',note_key);
  if n<>2 or public.api_add_clinical_note(
    prof_a,org_a,original_visit,'Nota ficticia versión 2',note_key)<>2 then
    raise exception 'NOTE_VERSION_IDEMPOTENCY_FAILED';
  end if;
  rejected:=false;
  begin
    perform public.api_add_clinical_note(
      prof_a,org_a,original_visit,'Otro contenido ficticio',note_key);
  exception when unique_violation then rejected:=true;
  end;
  if not rejected then raise exception 'NOTE_RETRY_CHANGED_CONTENT'; end if;
  rejected:=false;
  begin
    perform public.api_add_clinical_note(prof_b,org_a,original_visit,
      'Intrusión ficticia','10000000-0000-4000-8000-000000000009');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'OTHER_PROFESSIONAL_WROTE_NOTE'; end if;
  select count(*) into n from public.clinical_records where visit_id=original_visit;
  if n<>2 then raise exception 'CLINICAL_VERSION_COUNT_INVALID'; end if;

  perform public.api_submit_visit_review(prof_a,org_a,original_visit);
  if not exists(select 1 from public.visits
    where id=original_visit and state='PENDING_REVIEW'
      and submitted_for_review_at is not null) then
    raise exception 'REVIEW_STATE_NOT_SET';
  end if;
  rejected:=false;
  begin
    perform public.api_add_clinical_note(prof_a,org_a,original_visit,
      'Edición prohibida','10000000-0000-4000-8000-000000000010');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'REVIEWED_RECORD_MUTATED'; end if;

  -- Cancel before execution: coordination/admin only, structured reason.
  rejected:=false;
  begin
    perform public.api_cancel_visit(prof_a,org_a,new_visit,'PATIENT_UNAVAILABLE');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'PROFESSIONAL_CANCELLED_VISIT'; end if;
  perform public.api_cancel_visit(coor_a,org_a,new_visit,'PATIENT_UNAVAILABLE');
  if not exists(select 1 from public.visits where id=new_visit and state='CANCELLED') then
    raise exception 'CANCEL_STATE_NOT_RECORDED';
  end if;
  rejected:=false;
  begin
    perform public.api_cancel_visit(coor_a,org_a,original_visit,'OTHER');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'REVIEWED_VISIT_CANCELLED'; end if;

  -- Structured audit holds IDs, versions and reason codes but not narratives.
  if exists (select 1 from public.audit_events
    where safe_metadata::text like '%Nota ficticia%') then
      raise exception 'CLINICAL_TEXT_LEAKED_IN_AUDIT';
  end if;
  if not exists(select 1 from public.audit_events
    where resource_id=new_visit and event_type='VISIT_CANCELLED'
      and safe_metadata->>'reason_code'='PATIENT_UNAVAILABLE') then
    raise exception 'STRUCTURED_CANCELLATION_AUDIT_MISSING';
  end if;
end $$;
commit;

-- Revocation must take effect even for server-only commands without stale JWT reliance.
update public.memberships set active=false where
  organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id='11111111-1111-4111-8111-111111111111';
begin;
set local role service_role;
do $$
declare rejected boolean := false;
begin
  begin
    perform public.api_add_clinical_note(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '1111bbbb-0000-4000-8000-000000000001',
      'No debe aceptarse','10000000-0000-4000-8000-000000000011');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'REVOKED_PROFESSIONAL_ACCEPTED'; end if;
end $$;
commit;

select 'SUPA-02: ALL OPERATIONAL COMMANDS TESTS PASSED' as result;
