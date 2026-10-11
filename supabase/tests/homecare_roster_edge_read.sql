-- HC-READ-01 synthetic PostgreSQL security test; no real health records.
-- Execute after 000800 migration, after all preceding homecare suites.
\set ON_ERROR_STOP on

-- 1. Direct PostgREST table access is closed regardless of an otherwise
-- still-valid authenticated JWT, and the privileged read RPC is service-only.
do $$
begin
  if pg_catalog.has_table_privilege('authenticated',
      'public.homecare_coverage_assignments','SELECT')
    or pg_catalog.has_table_privilege('authenticated',
      'public.homecare_shift_handovers','SELECT')
    or pg_catalog.has_table_privilege('anon',
      'public.homecare_coverage_assignments','SELECT')
    or pg_catalog.has_table_privilege('anon',
      'public.homecare_shift_handovers','SELECT') then
    raise exception 'HC_READ_DIRECT_CLIENT_TABLE_GRANT';
  end if;
  if pg_catalog.has_function_privilege('anon',
      'public.api_hc_list_my_coverages(uuid)','EXECUTE')
    or pg_catalog.has_function_privilege('authenticated',
      'public.api_hc_list_my_coverages(uuid)','EXECUTE')
    or not pg_catalog.has_function_privilege('service_role',
      'public.api_hc_list_my_coverages(uuid)','EXECUTE') then
    raise exception 'HC_READ_RPC_EXECUTE_GRANTS_WRONG';
  end if;
end $$;

begin;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',true);
do $$
declare denied_coverage boolean := false;
  denied_handover boolean := false;
  denied_rpc boolean := false;
  n bigint;
  j jsonb;
begin
  begin
    select count(*) into n from public.homecare_coverage_assignments;
  exception when insufficient_privilege then denied_coverage := true;
  end;
  begin
    select count(*) into n from public.homecare_shift_handovers;
  exception when insufficient_privilege then denied_handover := true;
  end;
  begin
    select public.api_hc_list_my_coverages(
      '44444444-4444-4444-8444-444444444444') into j;
  exception when insufficient_privilege then denied_rpc := true;
  end;
  if not (denied_coverage and denied_handover and denied_rpc) then
    raise exception 'HC_READ_AUTHENTICATED_BYPASS: % % %',
      denied_coverage,denied_handover,denied_rpc;
  end if;
end $$;
commit;

begin;
set local role anon;
do $$
declare denied boolean := false; j jsonb;
begin
  begin
    select public.api_hc_list_my_coverages(
      '11111111-1111-4111-8111-111111111111') into j;
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'HC_READ_ANON_FORGED_ACTOR'; end if;
end $$;
commit;

-- 2. Even though service_role bypasses RLS, SQL explicitly joins the real
-- professional, organization, active membership and active care team.
begin;
set local role service_role;
do $$
declare
  v_a jsonb; v_b jsonb; v_c jsonb; v_one jsonb;
  j jsonb;
  denied boolean;
  record_count integer;
begin
  v_a := public.api_hc_list_my_coverages('11111111-1111-4111-8111-111111111111');
  v_b := public.api_hc_list_my_coverages('22222222-2222-4222-8222-222222222222');
  v_c := public.api_hc_list_my_coverages('66666666-6666-4666-8666-666666666666');

  if pg_catalog.jsonb_typeof(v_a) <> 'array'
    or pg_catalog.jsonb_typeof(v_b) <> 'array'
    or pg_catalog.jsonb_typeof(v_c) <> 'array'
    or pg_catalog.jsonb_array_length(v_a)<2
    or pg_catalog.jsonb_array_length(v_b)<2
    or pg_catalog.jsonb_array_length(v_c)<>1 then
    raise exception 'HC_READ_EXPECTED_SYNTHETIC_ROSTERS_NOT_PRESENT';
  end if;

  if not exists (select 1 from pg_catalog.jsonb_array_elements(v_a) x
      where x->>'id'='d1000000-0000-4000-8000-000000000001')
    or not exists (select 1 from pg_catalog.jsonb_array_elements(v_a) x
      where x->>'id'='d1000000-0000-4000-8000-000000000002')
    or exists (select 1 from pg_catalog.jsonb_array_elements(v_a) x
      where x->>'id' in (
        'd1000000-0000-4000-8000-000000000003',
        'd1000000-0000-4000-8000-000000000004',
        'd1000000-0000-4000-8000-000000000005')) then
    raise exception 'HC_READ_PRO_A_SCOPE_LEAK_OR_MISSING';
  end if;

  if not exists (select 1 from pg_catalog.jsonb_array_elements(v_b) x
      where x->>'id'='d1000000-0000-4000-8000-000000000003')
    or exists (select 1 from pg_catalog.jsonb_array_elements(v_b) x
      where x->>'id' in (
        'd1000000-0000-4000-8000-000000000001',
        'd1000000-0000-4000-8000-000000000002',
        'd1000000-0000-4000-8000-000000000005')) then
    raise exception 'HC_READ_PRO_B_SCOPE_LEAK_OR_MISSING';
  end if;

  if (v_c->0->>'id') <> 'd1000000-0000-4000-8000-000000000005' then
    raise exception 'HC_READ_CROSS_ORG_SCOPE_LEAK';
  end if;

  -- EXACT projection: six metadata keys, never user IDs, patient, note,
  -- member, address, prescription, signature, organization, or free text.
  for j in select x from pg_catalog.jsonb_array_elements(v_a) x loop
    select count(*) into record_count
      from pg_catalog.jsonb_object_keys(j) key;
    if record_count<>6 or not (
      j ? 'id' and j ? 'episode_id' and j ? 'service_kind'
      and j ? 'coverage_state' and j ? 'scheduled_start'
      and j ? 'scheduled_end'
    ) or j ? 'patient_id' or j ? 'organization_id'
      or j ? 'professional_id' or j ? 'narrative'
      or j ? 'diagnosis' or j ? 'signer_identity_verified' then
      raise exception 'HC_READ_EXCESS_OR_MISSING_FIELDS';
    end if;
  end loop;

  -- An active administrator is not a clinician with assignments;
  -- a coordinator with revoked membership cannot impersonate a nurse.
  for j in select pg_catalog.to_jsonb(u.user_id)
    from (values
       ('44444444-4444-4444-8444-444444444444'::uuid),
       ('33333333-3333-4333-8333-333333333333'::uuid),
       ('55555555-5555-4555-8555-555555555555'::uuid),
       ('77777777-7777-4777-8777-777777777777'::uuid)
    ) u(user_id)
  loop
    denied := false;
    begin
      perform public.api_hc_list_my_coverages((j #>> '{}')::uuid);
    exception when insufficient_privilege then denied := true;
    end;
    if not denied then raise exception 'HC_READ_UNAUTHORIZED_ROLE_PERMITTED'; end if;
  end loop;

  denied := false;
  begin perform public.api_hc_list_my_coverages(null);
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'HC_READ_NULL_ACTOR_PERMITTED'; end if;
end $$;
commit;

-- 3. Revocations must be effective WITHOUT changing any JWT claim or
-- requiring a deployed Supabase Auth service. Restore every synthetic fixture.
update public.memberships set active=false
  where organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and user_id='11111111-1111-4111-8111-111111111111';
begin;
set local role service_role;
do $$
declare denied boolean := false;
begin
  begin perform public.api_hc_list_my_coverages(
    '11111111-1111-4111-8111-111111111111');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'HC_READ_REVOKED_MEMBERSHIP_ALLOWED'; end if;
end $$;
commit;
update public.memberships set active=true
  where organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and user_id='11111111-1111-4111-8111-111111111111';

update public.homecare_care_team set active=false
  where episode_id='e1000000-0000-4000-8000-000000000001'
    and professional_id='1111aaaa-0000-4000-8000-000000000001';
begin;
set local role service_role;
do $$
declare j jsonb;
begin
  j := public.api_hc_list_my_coverages('11111111-1111-4111-8111-111111111111');
  if j <> '[]'::jsonb then raise exception 'HC_READ_REVOKED_TEAM_STILL_VISIBLE'; end if;
end $$;
commit;
update public.homecare_care_team set active=true
  where episode_id='e1000000-0000-4000-8000-000000000001'
    and professional_id='1111aaaa-0000-4000-8000-000000000001';

update public.professionals set active=false
  where id='1111aaaa-0000-4000-8000-000000000001';
begin;
set local role service_role;
do $$
declare denied boolean := false;
begin
  begin perform public.api_hc_list_my_coverages(
    '11111111-1111-4111-8111-111111111111');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'HC_READ_INACTIVE_PROFESSIONAL_ALLOWED'; end if;
end $$;
commit;
update public.professionals set active=true
  where id='1111aaaa-0000-4000-8000-000000000001';

update public.organizations set active=false
  where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
begin;
set local role service_role;
do $$
declare denied boolean := false;
begin
  begin perform public.api_hc_list_my_coverages(
    '11111111-1111-4111-8111-111111111111');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'HC_READ_INACTIVE_ORGANIZATION_ALLOWED'; end if;
end $$;
commit;
update public.organizations set active=true
  where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- A valid service-only read must still return the original synthetic shift.
begin;
set local role service_role;
do $$
declare j jsonb;
begin
  j := public.api_hc_list_my_coverages('11111111-1111-4111-8111-111111111111');
  if not exists(select 1 from pg_catalog.jsonb_array_elements(j) x
      where x->>'id'='d1000000-0000-4000-8000-000000000002')
    then raise exception 'HC_READ_ROSTER_NOT_RESTORED'; end if;
end $$;
commit;

select 'HC-READ-01: AUTH SESSION EDGE BOUNDARY / ROLE SCOPING / NO DIRECT CLIENT READ PASSED' as test_result;
