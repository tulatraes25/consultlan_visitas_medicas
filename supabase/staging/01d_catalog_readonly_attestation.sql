-- STAGING-01D: standalone read-only PostgreSQL catalog attestation.
-- Run ONLY after all 11 versioned migrations are applied on an independently
-- verified Supabase STAGING project. It reads NO rows from patient tables,
-- auth.users, auth.sessions, clinical notes or other application content.
--
-- Also executed against the CI-only PostgreSQL 16 Auth shim as a structural
-- test. PASS on CI is NOT proof of managed Supabase compatibility.
--
-- Expected output is one constant PASS marker. No secrets or schema values.
BEGIN TRANSACTION READ ONLY;

DO $$
DECLARE
  rel text;
  col text;
  oid_found oid;
  is_rls boolean;
  type_found oid;
  scanned integer:=0;
  routine record;
BEGIN
  -- Validate the managed Auth column contract without querying identities.
  FOR rel IN SELECT unnest(ARRAY['auth.users','auth.sessions']) LOOP
    IF pg_catalog.to_regclass(rel) IS NULL THEN
      RAISE EXCEPTION 'STAGING01D_AUTH_OBJECT_MISSING';
    END IF;
  END LOOP;
  FOR rel,col IN SELECT x.rel,x.col
    FROM (VALUES
      ('auth.users','id'),
      ('auth.sessions','id'),
      ('auth.sessions','user_id')
    ) AS x(rel,col)
  LOOP
    SELECT a.atttypid INTO type_found
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid=pg_catalog.to_regclass(rel)
      AND a.attname=col AND a.attnum>0 AND NOT a.attisdropped;
    IF type_found IS DISTINCT FROM 'uuid'::pg_catalog.regtype THEN
      RAISE EXCEPTION 'STAGING01D_AUTH_COLUMN_INCOMPATIBLE';
    END IF;
  END LOOP;
  IF pg_catalog.to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'STAGING01D_AUTH_UID_MISSING';
  END IF;

  -- A missing public table cannot pass as safe just because there are no
  -- client grants in an empty database.
  FOREACH rel IN ARRAY ARRAY[
    'organizations','memberships','professionals','patients','visits',
    'clinical_records','attendance_evidence','audit_events',
    'homecare_episodes','homecare_care_team','homecare_care_plan_versions',
    'homecare_plan_review_requests','homecare_coverage_assignments',
    'homecare_shift_handovers'
  ] LOOP
    scanned:=scanned+1;
    oid_found:=pg_catalog.to_regclass('public.'||rel);
    IF oid_found IS NULL THEN
      RAISE EXCEPTION 'STAGING01D_REQUIRED_TABLE_MISSING';
    END IF;
    SELECT c.relrowsecurity INTO is_rls
    FROM pg_catalog.pg_class c WHERE c.oid=oid_found;
    IF is_rls IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'STAGING01D_TABLE_RLS_DISABLED';
    END IF;
  END LOOP;
  IF scanned<>14 THEN
    RAISE EXCEPTION 'STAGING01D_EXPECTED_TABLE_COUNT_INVALID';
  END IF;

  -- Check every public table/view, including FUTURE objects, for any of
  -- seven direct mobile privileges. Client roles inherit PUBLIC grants.
  IF EXISTS(
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
      ('TRUNCATE'),('REFERENCES'),('TRIGGER')) ops(operation)
    WHERE ns.nspname='public' AND c.relkind IN ('r','p','v','m','f')
      AND (pg_catalog.has_table_privilege('anon',c.oid,ops.operation)
        OR pg_catalog.has_table_privilege(
          'authenticated',c.oid,ops.operation))
  ) THEN
    RAISE EXCEPTION 'STAGING01D_DIRECT_TABLE_PRIVILEGE_FOUND';
  END IF;

  -- Check all app RPCs and SECURITY DEFINER routines for accidental client
  -- EXECUTE; service-only Edge must remain the sole public-schema gateway.
  FOR routine IN
    SELECT p.oid,p.prosecdef,p.proconfig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace
    WHERE ns.nspname='public' AND
      (p.proname LIKE 'api_%' OR p.prosecdef)
  LOOP
    IF pg_catalog.has_function_privilege('anon',routine.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege(
        'authenticated',routine.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'STAGING01D_DIRECT_RPC_EXECUTE_FOUND';
    END IF;
    IF routine.prosecdef AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.unnest(routine.proconfig) AS x(setting)
      WHERE x.setting IN ('search_path=', 'search_path=""')
    ) THEN
      RAISE EXCEPTION 'STAGING01D_DEFINER_SEARCH_PATH_UNSAFE';
    END IF;
  END LOOP;

  IF NOT pg_catalog.has_function_privilege(
      'service_role','public.api_is_live_session(uuid,uuid)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege(
      'service_role','public.api_hc_list_my_coverages(uuid)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege(
      'service_role','public.api_hc_episode_scope(uuid,uuid)','EXECUTE')
     OR pg_catalog.has_function_privilege(
      'authenticated','public.api_is_live_session(uuid,uuid)','EXECUTE')
     OR pg_catalog.has_function_privilege(
      'anon','public.api_hc_episode_scope(uuid,uuid)','EXECUTE')
  THEN
    RAISE EXCEPTION 'STAGING01D_REQUIRED_BACKEND_GATE_INVALID';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_extension e
    WHERE e.extname='pgcrypto') THEN
    RAISE EXCEPTION 'STAGING01D_CRYPTO_EXTENSION_MISSING';
  END IF;
END $$;

COMMIT;
SELECT 'STAGING01D_CATALOG_READONLY_PASS_NOT_DEPLOYMENT_CERTIFICATE' AS result;
