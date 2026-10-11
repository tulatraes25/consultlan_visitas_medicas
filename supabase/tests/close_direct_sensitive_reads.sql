-- SEC-READ-02A: defense-in-depth grants test after HC-READ-01.
-- No medical content; PostgreSQL 16 + synthetic Auth only.
\set ON_ERROR_STOP on

-- Inventory of every known public table with client SELECT from migrations.
-- All are now inaccessible to JWT-only authenticated/anon callers except the
-- deliberate homecare_episodes STAGING-01B RLS verification fixture.
do $$
declare
  rel text;
  n integer := 0;
  is_rls_enabled boolean;
begin
  foreach rel in array array[
    'public.organizations',
    'public.memberships',
    'public.professionals',
    'public.patients',
    'public.visits',
    'public.clinical_records',
    'public.attendance_evidence',
    'public.audit_events',
    'public.homecare_care_team',
    'public.homecare_care_plan_versions',
    'public.homecare_plan_review_requests',
    'public.homecare_coverage_assignments',
    'public.homecare_shift_handovers'
  ] loop
    n := n + 1;
    if pg_catalog.has_table_privilege('authenticated', rel, 'SELECT')
      or pg_catalog.has_table_privilege('anon', rel, 'SELECT') then
      raise exception 'SEC_READ_DIRECT_JWT_GRANT_REMAINS: %',rel;
    end if;
    select c.relrowsecurity into is_rls_enabled
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace ns on ns.oid=c.relnamespace
      where ns.nspname='public'
        and c.relname=pg_catalog.split_part(rel,'.',2);
    if not coalesce(is_rls_enabled,false) then
      raise exception 'SEC_READ_RLS_DISABLED: %',rel;
    end if;
  end loop;
  if n<>13 then raise exception 'SEC_READ_INVENTORY_INCOMPLETE'; end if;

  if not pg_catalog.has_table_privilege(
    'authenticated','public.homecare_episodes','SELECT')
    or pg_catalog.has_table_privilege(
    'anon','public.homecare_episodes','SELECT') then
    raise exception 'SEC_READ_STAGING01B_EPISODE_EXCEPTION_BROKEN';
  end if;
  select c.relrowsecurity into is_rls_enabled
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relname='homecare_episodes';
  if not coalesce(is_rls_enabled,false) then
    raise exception 'SEC_READ_EPISODE_RLS_DISABLED';
  end if;
end $$;

-- Verify the actual database role cannot access identifiers, notes or plans
-- through direct table queries, even when an actor sub is present in its JWT.
begin;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',true);
do $$
declare denied_patient boolean := false;
  denied_narrative boolean := false;
  denied_team boolean := false;
  denied_plan boolean := false;
  count_rows integer;
begin
  begin
    select count(*) into count_rows from public.patients;
  exception when insufficient_privilege then denied_patient := true;
  end;
  begin
    select count(*) into count_rows from public.clinical_records;
  exception when insufficient_privilege then denied_narrative := true;
  end;
  begin
    select count(*) into count_rows from public.homecare_care_team;
  exception when insufficient_privilege then denied_team := true;
  end;
  begin
    select count(*) into count_rows from public.homecare_plan_review_requests;
  exception when insufficient_privilege then denied_plan := true;
  end;
  if not (denied_patient and denied_narrative and denied_team and denied_plan) then
    raise exception 'SEC_READ_AUTHENTICATED_DIRECT_SELECT_BYPASS';
  end if;

  -- The one temporary exception is still genuinely nonempty and isolated
  -- by RLS, preserving STAGING-01B's remote synthetic fixture mechanism.
  select count(*) into count_rows
    from public.homecare_episodes
    where id='e1000000-0000-4000-8000-000000000001';
  if count_rows<>1 then raise exception 'SEC_READ_RLS_FIXTURE_OWN_EPISODE_INVISIBLE'; end if;
  select count(*) into count_rows
    from public.homecare_episodes
    where id='e3000000-0000-4000-8000-000000000003';
  if count_rows<>0 then raise exception 'SEC_READ_RLS_FIXTURE_CROSS_ORG_LEAK'; end if;
end $$;
commit;

-- Existing service-only, SECURITY DEFINER APIs must continue to work despite
-- the blanket client revokes. No writes or raw medical content are requested.
do $$
begin
  if not pg_catalog.has_function_privilege(
    'service_role','public.api_hc_list_my_coverages(uuid)','EXECUTE')
    or pg_catalog.has_function_privilege(
    'authenticated','public.api_hc_list_my_coverages(uuid)','EXECUTE')
    or not pg_catalog.has_function_privilege(
    'service_role','public.api_hc_request_plan_review(uuid,uuid,uuid,integer,uuid)','EXECUTE')
    or pg_catalog.has_function_privilege(
    'authenticated','public.api_hc_request_plan_review(uuid,uuid,uuid,integer,uuid)','EXECUTE') then
    raise exception 'SEC_READ_SERVICE_ONLY_RPC_PRIVILEGES_BROKEN';
  end if;
end $$;

begin;
set local role service_role;
do $$
declare rows jsonb;
begin
  rows := public.api_hc_list_my_coverages('11111111-1111-4111-8111-111111111111');
  if pg_catalog.jsonb_typeof(rows)<>'array'
    or pg_catalog.jsonb_array_length(rows)<2 then
    raise exception 'SEC_READ_SERVICE_ONLY_ROSTER_NO_LONGER_WORKS';
  end if;
end $$;
commit;

select 'SEC-READ-02A: THIRTEEN TABLES CLOSED / TEMPORARY EPISODE RLS EXCEPTION VERIFIED' as test_result;
