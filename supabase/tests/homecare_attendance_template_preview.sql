-- HC-UX-04B1: synthetic-only PG16 authorization + specialty source tests.
-- This file runs after migration 13 on disposable GitHub PostgreSQL only.
\set ON_ERROR_STOP on

do $$
begin
  if not pg_catalog.has_function_privilege('service_role',
      'public.api_hc_resolve_my_attendance_template(uuid,uuid)','EXECUTE')
    or pg_catalog.has_function_privilege('anon',
      'public.api_hc_resolve_my_attendance_template(uuid,uuid)','EXECUTE')
    or pg_catalog.has_function_privilege('authenticated',
      'public.api_hc_resolve_my_attendance_template(uuid,uuid)','EXECUTE')
  then raise exception 'HC_UX04B1_UNSAFE_FUNCTION_GRANTS'; end if;
end $$;

begin;
set local role authenticated;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template(
      '11111111-1111-4111-8111-111111111111',
      'd1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_DIRECT_AUTHENTICATED_RPC'; end if;
end $$;
rollback;

begin;
set local role anon;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template(
      '11111111-1111-4111-8111-111111111111',
      'd1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_DIRECT_ANON_RPC'; end if;
end $$;
rollback;

begin;
set local role service_role;
do $$
declare j jsonb; denied boolean; uid uuid;
begin
  j:=public.api_hc_resolve_my_attendance_template(
    '11111111-1111-4111-8111-111111111111',
    'd1000000-0000-4000-8000-000000000001');
  if j<> '{"templateId":"NURSING_CAREGIVER_ATTENDANCE",
    "mode":"READ_ONLY_STRUCTURE_PREVIEW"}'::jsonb
    or (select count(*) from pg_catalog.jsonb_object_keys(j))<>2 then
    raise exception 'HC_UX04B1_MINIMAL_SOURCE_PROJECTION'; end if;
  j:=public.api_hc_resolve_my_attendance_template(
    '11111111-1111-4111-8111-111111111111',
    'd1000000-0000-4000-8000-000000000002');
  if j->>'templateId'<>'NURSING_CAREGIVER_ATTENDANCE' then
    raise exception 'HC_UX04B1_NURSING_SHIFT_NOT_ALLOWED'; end if;

  -- Same tenant, other clinician, other tenant, admin, revoked/admin/no
  -- assignment and null identities are deliberately indistinguishable.
  for uid in select v.u from (values
    ('22222222-2222-4222-8222-222222222222'::uuid),
    ('66666666-6666-4666-8666-666666666666'::uuid),
    ('44444444-4444-4444-8444-444444444444'::uuid),
    ('55555555-5555-4555-8555-555555555555'::uuid)
  ) v(u) loop
    denied:=false;
    begin
      perform public.api_hc_resolve_my_attendance_template(
        uid,'d1000000-0000-4000-8000-000000000001');
    exception when insufficient_privilege then denied:=true; end;
    if not denied then raise exception 'HC_UX04B1_CROSS_ACTOR_LEAK'; end if;
  end loop;
  denied:=false;
  begin perform public.api_hc_resolve_my_attendance_template(
    '11111111-1111-4111-8111-111111111111',
    'd1000000-0000-4000-8000-000000000005');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_FOREIGN_TENANT_COVERAGE'; end if;

  denied:=false;
  begin perform public.api_hc_resolve_my_attendance_template(
    '22222222-2222-4222-8222-222222222222',
    'd1000000-0000-4000-8000-000000000003');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_KINESIO_SHIFT_ALLOWED'; end if;
  denied:=false;
  begin perform public.api_hc_resolve_my_attendance_template(
    null,'d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_NULL_ACTOR'; end if;
  denied:=false;
  begin perform public.api_hc_resolve_my_attendance_template(
    '11111111-1111-4111-8111-111111111111',null);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_NULL_COVERAGE'; end if;
  denied:=false;
  begin perform public.api_hc_resolve_my_attendance_template(
    '11111111-1111-4111-8111-111111111111',
    'd0000000-0000-4000-8000-000000000000');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_UNKNOWN_COVERAGE'; end if;
end $$;
rollback;

-- Same authorized VISIT, switching only a PostgreSQL synthetic professional
-- specialty within a rolled-back transaction. No additional patient rows.
begin;
update public.professionals set specialty='MEDICINA'
 where id='1111aaaa-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare j jsonb;
begin
  j:=public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  if j->>'templateId'<>'MEDICAL_ATTENDANCE' or j->>'mode'<>'READ_ONLY_STRUCTURE_PREVIEW'
  then raise exception 'HC_UX04B1_WRONG_SOURCE_TEMPLATE'; end if;
end $$;
rollback;

-- Same authorized VISIT, switching only a PostgreSQL synthetic professional
-- specialty within a rolled-back transaction. No additional patient rows.
begin;
update public.professionals set specialty='ENFERMERIA'
 where id='1111aaaa-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare j jsonb;
begin
  j:=public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  if j->>'templateId'<>'NURSING_CAREGIVER_ATTENDANCE' or j->>'mode'<>'READ_ONLY_STRUCTURE_PREVIEW'
  then raise exception 'HC_UX04B1_WRONG_SOURCE_TEMPLATE'; end if;
end $$;
rollback;

-- Same authorized VISIT, switching only a PostgreSQL synthetic professional
-- specialty within a rolled-back transaction. No additional patient rows.
begin;
update public.professionals set specialty='KINESIOLOGIA'
 where id='1111aaaa-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare j jsonb;
begin
  j:=public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  if j->>'templateId'<>'PHYSIOTHERAPY_ATTENDANCE' or j->>'mode'<>'READ_ONLY_STRUCTURE_PREVIEW'
  then raise exception 'HC_UX04B1_WRONG_SOURCE_TEMPLATE'; end if;
end $$;
rollback;

-- Same authorized VISIT, switching only a PostgreSQL synthetic professional
-- specialty within a rolled-back transaction. No additional patient rows.
begin;
update public.professionals set specialty='FONOAUDIOLOGIA'
 where id='1111aaaa-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare j jsonb;
begin
  j:=public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  if j->>'templateId'<>'SPEECH_ATTENDANCE' or j->>'mode'<>'READ_ONLY_STRUCTURE_PREVIEW'
  then raise exception 'HC_UX04B1_WRONG_SOURCE_TEMPLATE'; end if;
end $$;
rollback;

-- Same authorized VISIT, switching only a PostgreSQL synthetic professional
-- specialty within a rolled-back transaction. No additional patient rows.
begin;
update public.professionals set specialty='TERAPIA OCUPACIONAL'
 where id='1111aaaa-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare j jsonb;
begin
  j:=public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  if j->>'templateId'<>'OCCUPATIONAL_THERAPY_ATTENDANCE' or j->>'mode'<>'READ_ONLY_STRUCTURE_PREVIEW'
  then raise exception 'HC_UX04B1_WRONG_SOURCE_TEMPLATE'; end if;
end $$;
rollback;

-- Same authorized VISIT, switching only a PostgreSQL synthetic professional
-- specialty within a rolled-back transaction. No additional patient rows.
begin;
update public.professionals set specialty='NUTRICION'
 where id='1111aaaa-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare j jsonb;
begin
  j:=public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  if j->>'templateId'<>'NUTRITION_ATTENDANCE' or j->>'mode'<>'READ_ONLY_STRUCTURE_PREVIEW'
  then raise exception 'HC_UX04B1_WRONG_SOURCE_TEMPLATE'; end if;
end $$;
rollback;

-- Same authorized VISIT, switching only a PostgreSQL synthetic professional
-- specialty within a rolled-back transaction. No additional patient rows.
begin;
update public.professionals set specialty='Enfermería'
 where id='1111aaaa-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare j jsonb;
begin
  j:=public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  if j->>'templateId'<>'NURSING_CAREGIVER_ATTENDANCE' or j->>'mode'<>'READ_ONLY_STRUCTURE_PREVIEW'
  then raise exception 'HC_UX04B1_WRONG_SOURCE_TEMPLATE'; end if;
end $$;
rollback;

-- Same authorized VISIT, switching only a PostgreSQL synthetic professional
-- specialty within a rolled-back transaction. No additional patient rows.
begin;
update public.professionals set specialty='Cuidadora'
 where id='1111aaaa-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare j jsonb;
begin
  j:=public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  if j->>'templateId'<>'NURSING_CAREGIVER_ATTENDANCE' or j->>'mode'<>'READ_ONLY_STRUCTURE_PREVIEW'
  then raise exception 'HC_UX04B1_WRONG_SOURCE_TEMPLATE'; end if;
end $$;
rollback;

-- Fail closed: unknown_specialty, no mutation survives this block.
begin;
update public.professionals set specialty='Pediatría' where id='1111aaaa-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_INVALID_STATE_ALLOWED'; end if;
end $$;
rollback;

-- Fail closed: non_nursing_shift, no mutation survives this block.
begin;
update public.professionals set specialty='MEDICINA' where id='1111aaaa-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000002');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_INVALID_STATE_ALLOWED'; end if;
end $$;
rollback;

-- Fail closed: inactive_membership, no mutation survives this block.
begin;
update public.memberships set active=false where organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id='11111111-1111-4111-8111-111111111111';
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_INVALID_STATE_ALLOWED'; end if;
end $$;
rollback;

-- Fail closed: inactive_professional, no mutation survives this block.
begin;
update public.professionals set active=false where id='1111aaaa-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_INVALID_STATE_ALLOWED'; end if;
end $$;
rollback;

-- Fail closed: inactive_team, no mutation survives this block.
begin;
update public.homecare_care_team set active=false where episode_id='e1000000-0000-4000-8000-000000000001' and professional_id='1111aaaa-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_INVALID_STATE_ALLOWED'; end if;
end $$;
rollback;

-- Fail closed: ended_team, no mutation survives this block.
begin;
update public.homecare_care_team set active=false,ended_at='2026-10-18T00:00:00Z' where episode_id='e1000000-0000-4000-8000-000000000001' and professional_id='1111aaaa-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_INVALID_STATE_ALLOWED'; end if;
end $$;
rollback;

-- Fail closed: inactive_org, no mutation survives this block.
begin;
update public.organizations set active=false where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_INVALID_STATE_ALLOWED'; end if;
end $$;
rollback;

-- Fail closed: suspended_episode, no mutation survives this block.
begin;
update public.homecare_episodes set episode_state='SUSPENDED' where id='e1000000-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_INVALID_STATE_ALLOWED'; end if;
end $$;
rollback;

-- Fail closed: draft_plan, no mutation survives this block.
begin;
update public.homecare_care_plan_versions set plan_state='DRAFT' where episode_id='e1000000-0000-4000-8000-000000000001' and version_number=1;
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_INVALID_STATE_ALLOWED'; end if;
end $$;
rollback;

-- Fail closed: expired_plan, no mutation survives this block.
begin;
update public.homecare_care_plan_versions set valid_until='2026-10-18T00:00:00Z' where episode_id='e1000000-0000-4000-8000-000000000001' and version_number=1;
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_INVALID_STATE_ALLOWED'; end if;
end $$;
rollback;

-- Fail closed: cancelled_coverage, no mutation survives this block.
begin;
update public.homecare_coverage_assignments set coverage_state='CANCELLED' where id='d1000000-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_INVALID_STATE_ALLOWED'; end if;
end $$;
rollback;

-- Fail closed: completed_coverage, no mutation survives this block.
begin;
update public.homecare_coverage_assignments set coverage_state='COMPLETED' where id='d1000000-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_INVALID_STATE_ALLOWED'; end if;
end $$;
rollback;

-- An ACTIVE VISIT retains only structural preview availability.
begin;
update public.homecare_coverage_assignments set coverage_state='ACTIVE'
 where id='d1000000-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare j jsonb;
begin
  j:=public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111','d1000000-0000-4000-8000-000000000001');
  if j->>'templateId'<>'NURSING_CAREGIVER_ATTENDANCE'
    then raise exception 'HC_UX04B1_ACTIVE_OWN_VISIT_DENIED'; end if;
end $$;
rollback;

-- Other organization, own synthetic medical VISIT. Test does not fabricate
-- any approval: uses the previously created SQL-only fixture metadata.
begin;
insert into public.homecare_coverage_assignments(
  id,organization_id,episode_id,patient_id,professional_id,
  care_plan_version,service_kind,coverage_state,scheduled_start,scheduled_end
) values(
  'd2000000-0000-4000-8000-000000000006',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'e3000000-0000-4000-8000-000000000003',
  'bbbb0000-0000-4000-8000-000000000003',
  '6666aaaa-0000-4000-8000-000000000003',
  1,'VISIT','ASSIGNED',
  '2026-12-20T10:00:00Z','2026-12-20T11:00:00Z'
);
set local role service_role;
do $$
declare j jsonb; denied boolean:=false;
begin
  j:=public.api_hc_resolve_my_attendance_template('66666666-6666-4666-8666-666666666666',
    'd2000000-0000-4000-8000-000000000006');
  if j->>'templateId'<>'MEDICAL_ATTENDANCE' then
    raise exception 'HC_UX04B1_OTHER_TENANT_OWN_VISIT_WRONG_TEMPLATE'; end if;
  begin
    perform public.api_hc_resolve_my_attendance_template('11111111-1111-4111-8111-111111111111',
      'd2000000-0000-4000-8000-000000000006');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_UX04B1_OTHER_TENANT_LEAK'; end if;
end $$;
rollback;

select 'HC_UX04B1_SIX_SPECIALTIES_SHIFT_TENANT_REVOCATION_NO_PHI_PASS' as test_result;
