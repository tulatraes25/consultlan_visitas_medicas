-- SEC-SESSION-01: actual PostgreSQL grants and active-session check.
-- Runs only after earlier homecare migrations and tests in synthetic CI.
\set ON_ERROR_STOP on

insert into auth.users(id) values
  ('99999999-9999-4999-8999-999999999999'),
  ('88888888-8888-4888-8888-888888888888')
on conflict do nothing;

insert into auth.sessions(id,user_id) values
  ('77777777-7777-4777-8777-777777777777',
   '99999999-9999-4999-8999-999999999999');

do $$
begin
  if pg_catalog.has_function_privilege(
    'anon','public.api_is_live_session(uuid,uuid)','EXECUTE')
    or pg_catalog.has_function_privilege(
      'authenticated','public.api_is_live_session(uuid,uuid)','EXECUTE') then
    raise exception 'MOBILE_CAN_EXECUTE_LIVE_SESSION_CHECK';
  end if;
  if not pg_catalog.has_function_privilege(
    'service_role','public.api_is_live_session(uuid,uuid)','EXECUTE') then
    raise exception 'BACKEND_CANNOT_EXECUTE_SESSION_CHECK';
  end if;
end $$;

begin;
set local role service_role;
do $$
declare
  user_a constant uuid := '99999999-9999-4999-8999-999999999999';
  user_b constant uuid := '88888888-8888-4888-8888-888888888888';
  session_a constant uuid := '77777777-7777-4777-8777-777777777777';
begin
  if not public.api_is_live_session(user_a,session_a) then
    raise exception 'LIVE_SESSION_INCORRECTLY_DENIED';
  end if;
  if public.api_is_live_session(user_b,session_a) then
    raise exception 'CROSS_USER_SESSION_SPOOFING';
  end if;
  if public.api_is_live_session(user_a,'66666666-6666-4666-8666-666666666666') then
    raise exception 'NONEXISTENT_SESSION_ACCEPTED';
  end if;
  if public.api_is_live_session(null,session_a)
     or public.api_is_live_session(user_a,null) then
    raise exception 'NULL_SESSION_OR_USER_ACCEPTED';
  end if;
end $$;
commit;

-- Termination: backend must fail closed once the Auth session row disappears.
delete from auth.sessions
where id='77777777-7777-4777-8777-777777777777';

begin;
set local role service_role;
do $$
begin
  if public.api_is_live_session(
    '99999999-9999-4999-8999-999999999999',
    '77777777-7777-4777-8777-777777777777') then
    raise exception 'TERMINATED_SESSION_STILL_AUTHORIZED';
  end if;
end $$;
commit;

-- Verify all old retired clinical RPCs remain inaccessible to backend.
do $$
begin
  if pg_catalog.has_function_privilege(
    'service_role','public.api_begin_visit(uuid,uuid,uuid)','EXECUTE') then
    raise exception 'SESSION_MIGRATION_REENABLED_CLINICAL_RPC';
  end if;
end $$;
select 'SEC-SESSION-01: LIVE AUTH SESSION GATE PASS (SYNTHETIC PG)' as result;
