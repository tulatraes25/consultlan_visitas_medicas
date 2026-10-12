-- SEC-SURFACE-01: future-proof grants/EXECUTE regression test for every
-- *currently installed* public relation, sequence and application RPC.
-- Run only in the isolated synthetic GitHub PostgreSQL CI after SEC-READ-02B.
-- No patient data, network, credentials, or changes to persistent state.
\set ON_ERROR_STOP on

do $$
declare
  relation record;
  routine record;
  operation text;
  relation_count integer:=0;
  routine_count integer:=0;
begin
  -- Dynamic catalog enumeration: a future migration adding a NEW table or
  -- view with inherited/default client grants must fail without updating
  -- a hard-coded 14-name inventory in this test.
  for relation in
    select c.oid as object_id, c.relname as object_name, c.relkind as kind
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relkind in ('r','p','v','m','f')
  loop
    relation_count:=relation_count+1;
    foreach operation in array array[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ] loop
      if pg_catalog.has_table_privilege('anon',relation.object_id,operation)
        or pg_catalog.has_table_privilege('authenticated',relation.object_id,operation)
      then
        raise exception 'SEC_SURFACE_CLIENT_TABLE_GRANT: % %',
          relation.object_name,operation;
      end if;
    end loop;
  end loop;
  if relation_count<14 then
    raise exception 'SEC_SURFACE_MISSING_FOUNDATION_TABLES: %',relation_count;
  end if;

  -- Future sequences can leak data or allow side-effecting nextval/setval
  -- via default PUBLIC usage. Assert all mobile sequence rights are absent.
  for relation in
    select c.oid as object_id,c.relname as object_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relkind='S'
  loop
    foreach operation in array array['USAGE','SELECT','UPDATE'] loop
      if pg_catalog.has_sequence_privilege('anon',relation.object_id,operation)
        or pg_catalog.has_sequence_privilege('authenticated',relation.object_id,operation)
      then
        raise exception 'SEC_SURFACE_CLIENT_SEQUENCE_GRANT: % %',
          relation.object_name,operation;
      end if;
    end loop;
  end loop;

  -- Most pgcrypto extension functions are ordinary built-ins in public;
  -- they are not application RPCs. Audit every public api_* routine and any
  -- SECURITY DEFINER routine. These must not execute from anon/authenticated
  -- at SQL or PostgREST level, bypassing the live-session Edge check.
  for routine in
    select p.oid as object_id,p.proname as object_name,
      p.prosecdef as is_definer,p.proconfig as settings
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='public' and
      (p.proname like 'api_%' or p.prosecdef)
  loop
    routine_count:=routine_count+1;
    if pg_catalog.has_function_privilege('anon',routine.object_id,'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated',routine.object_id,'EXECUTE')
    then
      raise exception 'SEC_SURFACE_DIRECT_CLIENT_RPC_EXECUTE: %',
        routine.object_name;
    end if;
    -- PostgreSQL may serialize an explicitly empty search_path as either
    -- search_path= or search_path="" in pg_proc.proconfig. Accept ONLY
    -- these two empty variants, never public, pg_temp, or user-writable paths.
    if routine.is_definer and not exists (
      select 1
      from pg_catalog.unnest(routine.settings) as option(setting)
      where option.setting in ('search_path=', 'search_path=""')
    ) then
      raise exception 'SEC_SURFACE_UNPINNED_DEFINER_SEARCH_PATH: %',
        routine.object_name;
    end if;
  end loop;
  if routine_count<10 then
    raise exception 'SEC_SURFACE_EXPECTED_RPC_INVENTORY_MISSING: %',routine_count;
  end if;

  -- Verify backend-only scope, session and attendance template preview RPCs
  -- remain explicitly callable ONLY by service_role. Earlier legacy RPCs
  -- deliberately revoked from service_role are not reopened here.
  if not pg_catalog.has_function_privilege('service_role',
      'public.api_hc_episode_scope(uuid,uuid)','EXECUTE')
    or not pg_catalog.has_function_privilege('service_role',
      'public.api_hc_list_my_coverages(uuid)','EXECUTE')
    or not pg_catalog.has_function_privilege('service_role',
      'public.api_is_live_session(uuid,uuid)','EXECUTE')
    or not pg_catalog.has_function_privilege('service_role',
      'public.api_hc_resolve_my_attendance_template(uuid,uuid)','EXECUTE') then
    raise exception 'SEC_SURFACE_REQUIRED_BACKEND_ROUTINE_NOT_EXECUTABLE';
  end if;
end $$;

select 'SEC-SURFACE-01: DYNAMIC PUBLIC RELATION/SEQUENCE/RPC PRIVILEGE GUARDS PASS' as test_result;
