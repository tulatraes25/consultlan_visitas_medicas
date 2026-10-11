-- SEC-READ-02B: no remaining direct JWT SELECT, scoped Edge RPC.
-- PostgreSQL 16; fixtures are completely synthetic. Run AFTER migration 001000.
\set ON_ERROR_STOP on

do $$
declare rel text; rls_enabled boolean; n integer:=0;
begin
  foreach rel in array array[
    'organizations','memberships','professionals','patients','visits',
    'clinical_records','attendance_evidence','audit_events',
    'homecare_episodes','homecare_care_team','homecare_care_plan_versions',
    'homecare_plan_review_requests','homecare_coverage_assignments',
    'homecare_shift_handovers'
  ] loop
    n:=n+1;
    if pg_catalog.has_table_privilege('authenticated','public.'||rel,'SELECT')
       or pg_catalog.has_table_privilege('anon','public.'||rel,'SELECT') then
      raise exception 'DIRECT_JWT_SELECT_REMAINS: %',rel;
    end if;
    select c.relrowsecurity into rls_enabled
    from pg_catalog.pg_class c
      join pg_catalog.pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relname=rel;
    if not coalesce(rls_enabled,false) then
      raise exception 'MISSING_RLS_ON_TABLE: %',rel;
    end if;
  end loop;
  if n<>14 then raise exception 'PUBLIC_TABLE_INVENTORY_INCOMPLETE'; end if;

  if pg_catalog.has_function_privilege('authenticated',
       'public.api_hc_episode_scope(uuid,uuid)','EXECUTE')
     or pg_catalog.has_function_privilege('anon',
       'public.api_hc_episode_scope(uuid,uuid)','EXECUTE')
     or not pg_catalog.has_function_privilege('service_role',
       'public.api_hc_episode_scope(uuid,uuid)','EXECUTE') then
    raise exception 'EPISODE_SCOPE_RPC_GRANTS_INVALID';
  end if;
end $$;

begin;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
 '44444444-4444-4444-8444-444444444444',true);
do $$
declare denied_direct boolean:=false; denied_rpc boolean:=false; n bigint; v jsonb;
begin
  begin
    select count(*) into n from public.homecare_episodes;
  exception when insufficient_privilege then denied_direct:=true;
  end;
  begin
    select public.api_hc_episode_scope(
      '44444444-4444-4444-8444-444444444444',
      'e1000000-0000-4000-8000-000000000001') into v;
  exception when insufficient_privilege then denied_rpc:=true;
  end;
  if not (denied_direct and denied_rpc) then
    raise exception 'AUTHENTICATED_JWT_BYPASSED_FINAL_GRANTS';
  end if;
end $$;
commit;

begin;
set local role anon;
do $$
declare blocked boolean:=false; v jsonb;
begin
  begin
    select public.api_hc_episode_scope(
      '44444444-4444-4444-8444-444444444444',
      'e1000000-0000-4000-8000-000000000001') into v;
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'ANON_FORGED_EPISODE_ACTOR'; end if;
end $$;
commit;

-- SECURITY DEFINER bypasses RLS: SQL must apply the actual actor + role +
-- organization/team checks, never trust actor/organization values from mobile.
begin;
set local role service_role;
do $$
declare
  org_a constant uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  org_b constant uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  epi_a constant uuid:='e1000000-0000-4000-8000-000000000001';
  epi_b constant uuid:='e3000000-0000-4000-8000-000000000003';
  draft_a constant uuid:='e4000000-0000-4000-8000-000000000004';
  actor_admin constant uuid:='44444444-4444-4444-8444-444444444444';
  actor_pro_a constant uuid:='11111111-1111-4111-8111-111111111111';
  actor_pro_b constant uuid:='66666666-6666-4666-8666-666666666666';
  v jsonb; denied boolean; actor uuid;
begin
  v:=public.api_hc_episode_scope(actor_admin,epi_a);
  if pg_catalog.jsonb_array_length(v)<>1
    or (v->0->>'id')<>epi_a::text
    or (v->0->>'organization_id')<>org_a::text
    or (select count(*) from pg_catalog.jsonb_object_keys(v->0))<>2 then
    raise exception 'ADMIN_A_EPISODE_SCOPE_NOT_EXACT';
  end if;
  if public.api_hc_episode_scope(actor_admin,epi_b) <> '[]'::jsonb then
    raise exception 'ADMIN_A_CROSS_TENANT_LEAK';
  end if;

  v:=public.api_hc_episode_scope(actor_pro_b,epi_b);
  if pg_catalog.jsonb_array_length(v)<>1
    or (v->0->>'id')<>epi_b::text
    or (v->0->>'organization_id')<>org_b::text then
    raise exception 'PRO_B_OWN_EPISODE_MISSING';
  end if;
  if public.api_hc_episode_scope(actor_pro_b,epi_a) <> '[]'::jsonb then
    raise exception 'PRO_B_CROSS_TENANT_LEAK';
  end if;

  v:=public.api_hc_episode_scope(actor_pro_a,epi_a);
  if pg_catalog.jsonb_array_length(v)<>1 then
    raise exception 'PRO_A_ACTIVE_TEAM_EPISODE_MISSING';
  end if;
  if public.api_hc_episode_scope(actor_pro_a,draft_a) <> '[]'::jsonb then
    raise exception 'PRO_A_DRAFT_OR_NON_TEAM_LEAK';
  end if;
  v:=public.api_hc_episode_scope(actor_admin,draft_a);
  if pg_catalog.jsonb_array_length(v)<>1 then
    raise exception 'ADMIN_DRAFT_METADATA_NOT_VISIBLE';
  end if;

  foreach actor in array array[
    '55555555-5555-4555-8555-555555555555'::uuid,
    '77777777-7777-4777-8777-777777777777'::uuid,
    '99999999-9999-4999-8999-999999999999'::uuid
  ] loop
    denied:=false;
    begin
      perform public.api_hc_episode_scope(actor,epi_a);
    exception when insufficient_privilege then denied:=true;
    end;
    if not denied then raise exception 'AUDITOR_INACTIVE_OR_UNKNOWN_ACTOR_ALLOWED'; end if;
  end loop;
  denied:=false;
  begin perform public.api_hc_episode_scope(null,epi_a);
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'NULL_ACTOR_ALLOWED'; end if;
  denied:=false;
  begin perform public.api_hc_episode_scope(actor_admin,null);
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'NULL_EPISODE_ALLOWED'; end if;
end $$;
commit;

-- Membership, team and organization revocations are visible immediately to
-- server reads, independently of any JWT cache. Restore synthetic fixtures.
update public.homecare_care_team set active=false
where episode_id='e1000000-0000-4000-8000-000000000001'
  and professional_id='1111aaaa-0000-4000-8000-000000000001';
begin;
set local role service_role;
do $$
declare v jsonb;
begin
  v:=public.api_hc_episode_scope(
    '11111111-1111-4111-8111-111111111111',
    'e1000000-0000-4000-8000-000000000001');
  if v<>'[]'::jsonb then raise exception 'REVOKED_TEAM_STILL_CAN_SEE_EPISODE'; end if;
end $$;
commit;
update public.homecare_care_team set active=true
where episode_id='e1000000-0000-4000-8000-000000000001'
  and professional_id='1111aaaa-0000-4000-8000-000000000001';

update public.memberships set active=false
where user_id='44444444-4444-4444-8444-444444444444'
  and organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
begin;
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin perform public.api_hc_episode_scope(
    '44444444-4444-4444-8444-444444444444',
    'e1000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'REVOKED_ADMIN_STILL_CAN_SEE_EPISODE'; end if;
end $$;
commit;
update public.memberships set active=true
where user_id='44444444-4444-4444-8444-444444444444'
  and organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

update public.organizations set active=false
where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
begin;
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin perform public.api_hc_episode_scope(
    '66666666-6666-4666-8666-666666666666',
    'e3000000-0000-4000-8000-000000000003');
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'INACTIVE_ORGANIZATION_STILL_VISIBLE'; end if;
end $$;
commit;
update public.organizations set active=true
where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select 'SEC-READ-02B: ALL FOURTEEN JWT TABLE GRANTS REVOKED / SESSION-SCOPED EPISODE RPC OK' as test_result;
