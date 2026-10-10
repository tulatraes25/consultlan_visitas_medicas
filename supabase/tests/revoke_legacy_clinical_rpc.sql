-- SUPA-04B: permissions on obsolete SQL clinical RPCs are revoked.
-- Runs AFTER earlier SUPA-02 integration fixtures and HC-02C1B review tests.
\set ON_ERROR_STOP on

do $$
declare
  fn text;
  retired text[] := array[
    'public.api_schedule_visit(uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid)',
    'public.api_begin_visit(uuid,uuid,uuid)',
    'public.api_add_clinical_note(uuid,uuid,uuid,text,uuid)',
    'public.api_submit_visit_review(uuid,uuid,uuid)',
    'public.api_cancel_visit(uuid,uuid,uuid,text)'
  ];
begin
  foreach fn in array retired loop
    if pg_catalog.has_function_privilege('service_role',fn,'EXECUTE') then
      raise exception 'LEGACY_RPC_STILL_EXECUTABLE_BY_SERVICE_ROLE: %', fn;
    end if;
    if pg_catalog.has_function_privilege('authenticated',fn,'EXECUTE') then
      raise exception 'LEGACY_RPC_EXPOSED_TO_AUTHENTICATED: %', fn;
    end if;
    if pg_catalog.has_function_privilege('anon',fn,'EXECUTE') then
      raise exception 'LEGACY_RPC_EXPOSED_TO_ANON: %', fn;
    end if;
  end loop;
  if not pg_catalog.has_function_privilege('service_role',
    'public.api_create_patient(uuid,uuid,text,uuid)','EXECUTE') then
    raise exception 'ADMINISTRATIVE_PATIENT_PROVISIONING_BROKEN';
  end if;
  if not pg_catalog.has_function_privilege('service_role',
    'public.api_register_professional(uuid,uuid,uuid,text)','EXECUTE') then
    raise exception 'ADMINISTRATIVE_PROFESSIONAL_PROVISIONING_BROKEN';
  end if;
  if not pg_catalog.has_function_privilege('service_role',
    'public.api_hc_request_plan_review(uuid,uuid,uuid,integer,uuid)','EXECUTE') then
    raise exception 'PENDING_PLAN_REVIEW_REQUEST_BROKEN';
  end if;
end $$;

begin;
set local role service_role;
do $$
declare blocked boolean := false;
begin
  begin
    perform public.api_begin_visit(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '1111bbbb-0000-4000-8000-000000000001');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'EX_SERVICE_ROLE_COULD_BEGIN_CLINICAL_VISIT'; end if;
end $$;
commit;

select 'SUPA-04B: LEGACY CLINICAL RPC EXECUTE REVOKED; ADMIN PATHS PRESERVED' as result;
