-- HC-02B integration: trusted commands with synthetic actors and fake homecare patients.
-- Run after HC-02A tests. No clinical approval or real patient is created.
\set ON_ERROR_STOP on

-- 1. Unprivileged users cannot call SECURITY DEFINER RPCs with a forged admin UUID.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare denied boolean := false;
begin
  begin
    perform public.api_hc_create_episode_draft(
      '44444444-4444-4444-8444-444444444444',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaa0000-0000-4000-8000-000000000001',
      '00000000-0200-4000-8000-000000000001');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'AUTHENTICATED_CAN_CALL_PRIVILEGED_HC_RPC'; end if;
end $$;
commit;

begin;
set local role anon;
do $$
declare denied boolean := false;
begin
  begin
    perform public.api_hc_schedule_coverage(
      '44444444-4444-4444-8444-444444444444',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'e1000000-0000-4000-8000-000000000001',
      '1111aaaa-0000-4000-8000-000000000001',
      1,'VISIT','2026-10-29T09:00:00Z','2026-10-29T10:00:00Z',
      '00000000-0200-4000-8000-000000000002');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'ANON_CAN_SCHEDULE_CARE'; end if;
end $$;
commit;

-- 2. Neither mobile nor service_role has direct mutation on the new tables.
begin;
set local role service_role;
do $$
declare denied boolean := false;
begin
  begin
    insert into public.homecare_episodes(organization_id,patient_id)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'aaaa0000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'SERVICE_ROLE_CAN_DIRECTLY_MODIFY_EPISODES'; end if;
end $$;
commit;

-- 3. Commands use a trusted backend actor and enforce actual membership
-- and case scope, not a "role" declared in request JSON.
begin;
set local role service_role;
do $$
declare
  org_a constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  org_b constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  admin constant uuid := '44444444-4444-4444-8444-444444444444';
  coor constant uuid := '33333333-3333-4333-8333-333333333333';
  nurse_a constant uuid := '11111111-1111-4111-8111-111111111111';
  nurse_b constant uuid := '22222222-2222-4222-8222-222222222222';
  patient_a constant uuid := 'aaaa0000-0000-4000-8000-000000000001';
  patient_b constant uuid := 'aaaa0000-0000-4000-8000-000000000002';
  professional_a constant uuid := '1111aaaa-0000-4000-8000-000000000001';
  professional_b constant uuid := '2222aaaa-0000-4000-8000-000000000002';
  episode_a constant uuid := 'e1000000-0000-4000-8000-000000000001';
  epi_key constant uuid := '00000000-0200-4000-8000-000000000003';
  plan_key constant uuid := '00000000-0200-4000-8000-000000000004';
  cov_key constant uuid := '00000000-0200-4000-8000-000000000005';
  episode_new uuid;
  coverage_visit uuid;
  shift_out uuid;
  shift_in uuid;
  handover uuid;
  version integer;
  n integer;
  denied boolean;
begin
  -- DRAFT episode is created only inside this organisation, without medical approval.
  episode_new := public.api_hc_create_episode_draft(coor,org_a,patient_a,epi_key);
  if public.api_hc_create_episode_draft(coor,org_a,patient_a,epi_key) <> episode_new then
    raise exception 'EPISODE_IDEMPOTENT_RETRY_MISMATCH';
  end if;
  select count(*) into n from public.homecare_episodes
    where id=episode_new and patient_id=patient_a and episode_state='DRAFT'
      and lead_professional_id is null and activated_at is null;
  if n <> 1 then raise exception 'EPISODE_DRAFT_NOT_CREATED_CORRECTLY'; end if;
  denied := false;
  begin
    perform public.api_hc_create_episode_draft(coor,org_a,patient_b,epi_key);
  exception when unique_violation then denied := true;
  end;
  if not denied then raise exception 'EPISODE_REQUEST_KEY_REUSED_WITH_DIFFERENT_PATIENT'; end if;
  denied := false;
  begin
    perform public.api_hc_create_episode_draft(nurse_a,org_a,patient_a,
      '00000000-0200-4000-8000-000000000006');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'UNAUTHORIZED_PROFESSIONAL_ADMITTED_EPISODE'; end if;
  denied := false;
  begin
    perform public.api_hc_create_episode_draft(admin,org_b,patient_a,
      '00000000-0200-4000-8000-000000000007');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'CROSS_TENANT_EPISODE_CREATED'; end if;

  -- Coordination may add an active team member, without forging a medical lead.
  perform public.api_hc_assign_team_member(coor,org_a,episode_new,professional_a);
  perform public.api_hc_assign_team_member(coor,org_a,episode_new,professional_a);
  select count(*) into n from public.homecare_care_team
    where episode_id=episode_new and professional_id=professional_a
      and active and team_function='CARE_TEAM';
  if n<>1 then raise exception 'TEAM_MEMBER_NOT_IDEMPOTENT'; end if;
  denied := false;
  begin
    perform public.api_hc_assign_team_member(coor,org_a,episode_new,
      '6666aaaa-0000-4000-8000-000000000003');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'CROSS_TENANT_TEAM_ASSIGNMENT'; end if;
  denied := false;
  begin
    perform public.api_hc_assign_team_member(nurse_a,org_a,episode_new,professional_b);
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'PROFESSIONAL_MUTATED_TEAM'; end if;

  -- Multiple metadata drafts are versioned, yet never marked APPROVED automatically.
  version := public.api_hc_create_plan_draft(coor,org_a,episode_new,plan_key);
  if version<>1 or public.api_hc_create_plan_draft(coor,org_a,episode_new,plan_key)<>1 then
    raise exception 'PLAN_METADATA_DRAFT_VERSION_RETRY';
  end if;
  version := public.api_hc_create_plan_draft(coor,org_a,episode_new,
    '00000000-0200-4000-8000-000000000008');
  if version<>2 then raise exception 'PLAN_DRAFT_SEQUENCE_INCORRECT'; end if;
  select count(*) into n from public.homecare_care_plan_versions
    where episode_id=episode_new and plan_state='DRAFT'
      and approved_by_user_id is null and approved_at is null;
  if n<>2 then raise exception 'PLAN_METADATA_BECAME_CLINICALLY_APPROVED'; end if;
  denied := false;
  begin
    perform public.api_hc_create_plan_draft(nurse_a,org_a,episode_new,
      '00000000-0200-4000-8000-000000000009');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'PROFESSIONAL_CREATED_ADMIN_PLAN_DRAFT'; end if;

  -- A DRAFT case cannot be staffed, even if its member has role PROFESSIONAL.
  denied := false;
  begin
    perform public.api_hc_schedule_coverage(coor,org_a,episode_new,professional_a,
      1,'SHIFT','2026-10-29T06:00:00Z','2026-10-29T08:00:00Z',
      '00000000-0200-4000-8000-000000000010');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'DRAFT_EPISODE_SCHEDULED'; end if;

  -- Existing APPROVED plan fixtures are synthetic. They permit testing schedule
  -- atomicity without inventing approval/medical licensing code.
  coverage_visit := public.api_hc_schedule_coverage(coor,org_a,episode_a,professional_a,
    1,'VISIT','2026-10-29T09:00:00Z','2026-10-29T10:00:00Z',cov_key);
  if coverage_visit <> public.api_hc_schedule_coverage(
    coor,org_a,episode_a,professional_a,1,'VISIT',
    '2026-10-29T09:00:00Z','2026-10-29T10:00:00Z',cov_key) then
    raise exception 'COVERAGE_IDEMPOTENCY_RETRY_MISMATCH';
  end if;
  select count(*) into n from public.homecare_coverage_assignments c
    join public.visits v on v.homecare_coverage_id=c.id
    where c.id=coverage_visit and c.service_kind='VISIT'
      and c.episode_id=v.homecare_episode_id and c.patient_id=v.patient_id
      and c.professional_id=v.professional_id
      and c.scheduled_start=v.scheduled_start
      and c.scheduled_end=v.scheduled_end and c.coverage_state='ASSIGNED'
      and v.state='ASSIGNED';
  if n<>1 then raise exception 'ATOMIC_VISIT_AND_CANONICAL_COVERAGE_NOT_CREATED'; end if;
  denied := false;
  begin
    perform public.api_hc_schedule_coverage(coor,org_a,episode_a,professional_a,
      1,'VISIT','2026-10-29T12:00:00Z','2026-10-29T13:00:00Z',cov_key);
  exception when unique_violation then denied := true;
  end;
  if not denied then raise exception 'COVERAGE_IDEMPOTENCY_KEY_PAYLOAD_CHANGED'; end if;
  denied := false;
  begin
    perform public.api_hc_schedule_coverage(coor,org_a,episode_a,professional_a,
      1,'SHIFT','2026-10-29T09:30:00Z','2026-10-29T10:30:00Z',
      '00000000-0200-4000-8000-000000000011');
  exception when exclusion_violation then denied := true;
  end;
  if not denied then raise exception 'SHIFT_AND_VISIT_OVERLAP_NOT_REJECTED'; end if;

  -- Non-team, inactive, other-tenant actors cannot insert a coverage.
  denied := false;
  begin
    perform public.api_hc_schedule_coverage(nurse_a,org_a,episode_a,professional_a,
      1,'SHIFT','2026-10-29T13:00:00Z','2026-10-29T18:00:00Z',
      '00000000-0200-4000-8000-000000000012');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'NURSE_SELF_SCHEDULED_UNAUTHORIZED_SHIFT'; end if;
  denied := false;
  begin
    perform public.api_hc_schedule_coverage(coor,org_a,
      'e2000000-0000-4000-8000-000000000002',professional_a,
      1,'SHIFT','2026-10-29T13:00:00Z','2026-10-29T18:00:00Z',
      '00000000-0200-4000-8000-000000000013');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'UNASSIGNED_PROFESSIONAL_SCHEDULED_OTHER_EPISODE'; end if;

  -- Create adjacent 12h and 5h SHIFTs. No VISIT row must be created for either.
  shift_out := public.api_hc_schedule_coverage(coor,org_a,episode_a,professional_a,
    1,'SHIFT','2026-10-30T06:00:00Z','2026-10-30T18:00:00Z',
    '00000000-0200-4000-8000-000000000014');
  shift_in := public.api_hc_schedule_coverage(coor,org_a,episode_a,professional_b,
    1,'SHIFT','2026-10-30T18:00:00Z','2026-10-30T23:00:00Z',
    '00000000-0200-4000-8000-000000000015');
  select count(*) into n from public.visits
    where homecare_coverage_id in (shift_out,shift_in);
  if n<>0 then raise exception 'SHIFT_WRONGLY_CREATED_VISIT_RECORD'; end if;

  -- Handover request must join two adjacent SHIFTs in same homecare episode.
  handover := public.api_hc_request_handover(coor,org_a,shift_out,shift_in);
  if public.api_hc_request_handover(coor,org_a,shift_out,shift_in) <> handover then
    raise exception 'HANDOVER_REQUEST_NOT_IDEMPOTENT';
  end if;
  denied := false;
  begin
    perform public.api_hc_request_handover(coor,org_a,coverage_visit,shift_in);
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'VISIT_USED_AS_SHIFT_HANDOVER'; end if;
  denied := false;
  begin
    perform public.api_hc_request_handover(coor,org_a,
      'd1000000-0000-4000-8000-000000000004',shift_in);
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'DIFFERENT_EPISODES_LINKED_BY_HANDOVER'; end if;

  -- Incoming clinician only, via server-verified actor, may acknowledge receipt.
  denied := false;
  begin
    perform public.api_hc_ack_handover(nurse_a,org_a,handover);
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'OUTGOING_CLINICIAN_ACKED_FOR_INCOMING'; end if;
  perform public.api_hc_ack_handover(nurse_b,org_a,handover);
  perform public.api_hc_ack_handover(nurse_b,org_a,handover);
  select count(*) into n from public.homecare_shift_handovers
    where id=handover and handover_state='ACKNOWLEDGED'
      and acknowledged_by_user_id=nurse_b and acknowledged_at is not null;
  if n<>1 then raise exception 'HANDOVER_ACK_WRONG_ACTOR_OR_NOT_RECORDED'; end if;

  -- Idempotent retries do not inflate audit; no notes, diagnoses or actual
  -- bedside Kardex are inserted into event metadata.
  select count(*) into n from public.audit_events
    where organization_id=org_a and event_type='HC_COVERAGE_ASSIGNED'
      and resource_id=coverage_visit;
  if n<>1 then raise exception 'COVERAGE_AUDIT_DUPLICATED_OR_MISSING'; end if;
  select count(*) into n from public.audit_events
    where organization_id=org_a and event_type='HC_HANDOVER_RECEIPT_ACK'
      and resource_id=handover;
  if n<>1 then raise exception 'HANDOVER_ACK_AUDIT_DUPLICATED_OR_MISSING'; end if;
  select count(*) into n from public.audit_events
    where organization_id=org_a and event_type='HC_EPISODE_DRAFT_CREATED'
      and resource_id=episode_new;
  if n<>1 then raise exception 'EPISODE_DRAFT_AUDIT_DUPLICATED_OR_MISSING'; end if;
end $$;
commit;

-- 4. A plan with end-time expiry before coverage FINISH cannot authorize a shift.
update public.homecare_care_plan_versions set
  valid_until='2026-11-01T09:30:00Z'
where episode_id='e1000000-0000-4000-8000-000000000001'
  and version_number=1;
begin;
set local role service_role;
do $$
declare denied boolean := false;
begin
  begin
    perform public.api_hc_schedule_coverage(
      '33333333-3333-4333-8333-333333333333',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'e1000000-0000-4000-8000-000000000001',
      '1111aaaa-0000-4000-8000-000000000001',1,'SHIFT',
      '2026-11-01T09:00:00Z','2026-11-01T10:00:00Z',
      '00000000-0200-4000-8000-000000000016');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'COVERAGE_OUTLIVES_APPROVED_PLAN'; end if;
end $$;
commit;
update public.homecare_care_plan_versions set valid_until=null
where episode_id='e1000000-0000-4000-8000-000000000001'
  and version_number=1;

-- 5. Revoking coordinator membership instantly blocks server-only commands.
update public.memberships set active=false where
  organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id='33333333-3333-4333-8333-333333333333';
begin;
set local role service_role;
do $$
declare denied boolean := false;
begin
  begin
    perform public.api_hc_create_episode_draft(
      '33333333-3333-4333-8333-333333333333',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaa0000-0000-4000-8000-000000000001',
      '00000000-0200-4000-8000-000000000017');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'REVOKED_COORDINATOR_STILL_AUTHORIZED'; end if;
end $$;
commit;

-- Existing direct modifications remain forbidden after new privileged RPCs.
begin;
set local role service_role;
do $$
declare denied boolean := false;
begin
  begin
    update public.homecare_shift_handovers set handover_state='DECLINED';
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'DIRECT_SERVICE_ROLE_HANDOVER_MUTATION'; end if;
end $$;
commit;

select 'HC-02B: CONTROLLED HOMECARE OPERATIONS / AUDIT / AUTHZ PASSED' as result;
