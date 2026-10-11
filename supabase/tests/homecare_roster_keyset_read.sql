-- HC-READ-02: synthetic-only PostgreSQL 16 keyset and access tests.
-- Run after all earlier 11 migrations and their tests, never on cloud Supabase.
\set ON_ERROR_STOP on

do $$
begin
  if not pg_catalog.has_function_privilege('service_role',
    'public.api_hc_list_my_coverages_page(uuid,timestamptz,timestamptz,timestamptz,uuid)',
    'EXECUTE')
    or pg_catalog.has_function_privilege('anon',
    'public.api_hc_list_my_coverages_page(uuid,timestamptz,timestamptz,timestamptz,uuid)',
    'EXECUTE')
    or pg_catalog.has_function_privilege('authenticated',
    'public.api_hc_list_my_coverages_page(uuid,timestamptz,timestamptz,timestamptz,uuid)',
    'EXECUTE') then
    raise exception 'HC_READ02_EXECUTE_GRANTS_WRONG';
  end if;
end $$;

-- Only a trusted service actor can call the function. A forged sub is useless.
begin;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',true);
do $$
declare denied boolean := false; j jsonb;
begin
  begin
    j:=public.api_hc_list_my_coverages_page(
      '11111111-1111-4111-8111-111111111111',
      '2026-11-02T00:00:00Z','2026-11-05T00:00:00Z');
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'HC_READ02_JWT_DIRECT_RPC_ACCESS'; end if;
end $$;
commit;

-- 105 nonoverlapping, synthetic VISIT metadata records for professional A.
-- Use a 3-day interval away from existing fixture coverage. No clinical rows.
insert into public.homecare_coverage_assignments(
 id, organization_id, episode_id, patient_id, professional_id,
 care_plan_version, service_kind, coverage_state, scheduled_start, scheduled_end
)
select
 ('c'||pg_catalog.lpad(n::text,7,'0')||'-0000-4000-8000-'||
   pg_catalog.lpad(n::text,12,'0'))::uuid,
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
 'e1000000-0000-4000-8000-000000000001'::uuid,
 'aaaa0000-0000-4000-8000-000000000001'::uuid,
 '1111aaaa-0000-4000-8000-000000000001'::uuid,
 1,'VISIT','ASSIGNED',
 '2026-11-02T00:00:00Z'::timestamptz + n * interval '15 minutes',
 '2026-11-02T00:05:00Z'::timestamptz + n * interval '15 minutes'
from pg_catalog.generate_series(0,104) as n;

begin;
set local role service_role;
do $$
declare first_page jsonb; next_page jsonb; cursor_start timestamptz;
  cursor_id uuid; j jsonb; n integer; denied boolean;
  a uuid:='11111111-1111-4111-8111-111111111111';
begin
  first_page:=public.api_hc_list_my_coverages_page(a,
    '2026-11-02T00:00:00Z','2026-11-05T00:00:00Z');
  if pg_catalog.jsonb_array_length(first_page->'rows')<>100
    or first_page->>'hasMore'<>'true'
    or first_page->'nextCursor' is null
    or pg_catalog.jsonb_typeof(first_page->'nextCursor')<>'object'
    then raise exception 'HC_READ02_FIRST_PAGE_CONTRACT'; end if;
  for j in select x.item from pg_catalog.jsonb_array_elements(first_page->'rows') x(item) loop
    if (select count(*) from pg_catalog.jsonb_object_keys(j))<>6
      or not (j ? 'id' and j ? 'episode_id' and j ? 'service_kind'
      and j ? 'coverage_state' and j ? 'scheduled_start'
      and j ? 'scheduled_end') then
      raise exception 'HC_READ02_EXCESS_CLINICAL_FIELDS';
    end if;
  end loop;
  cursor_start:=(first_page->'nextCursor'->>'scheduled_start')::timestamptz;
  cursor_id:=(first_page->'nextCursor'->>'id')::uuid;
  next_page:=public.api_hc_list_my_coverages_page(a,
    '2026-11-02T00:00:00Z','2026-11-05T00:00:00Z',
    cursor_start,cursor_id);
  if pg_catalog.jsonb_array_length(next_page->'rows')<>5
    or next_page->>'hasMore'<>'false'
    or next_page->'nextCursor'<>'null'::jsonb then
    raise exception 'HC_READ02_SECOND_PAGE_CONTRACT';
  end if;
  if exists(
    select 1 from pg_catalog.jsonb_array_elements(first_page->'rows') x
    join pg_catalog.jsonb_array_elements(next_page->'rows') y
      on x->>'id'=y->>'id'
  ) then raise exception 'HC_READ02_PAGE_OVERLAP'; end if;

  -- Other professionals and tenants may not see A's data or 105-row count.
  for a in select u.actor_id from (values
    ('22222222-2222-4222-8222-222222222222'::uuid),
    ('66666666-6666-4666-8666-666666666666'::uuid)
  ) u(actor_id) loop
    j:=public.api_hc_list_my_coverages_page(a,
      '2026-11-02T00:00:00Z','2026-11-05T00:00:00Z');
    if pg_catalog.jsonb_array_length(j->'rows')<>0
      or j->>'hasMore'<>'false' then
      raise exception 'HC_READ02_OTHER_PROFESSIONAL_LEAK'; end if;
  end loop;

  -- Existing shift overlaps the window boundary and must be included.
  j:=public.api_hc_list_my_coverages_page(
    '11111111-1111-4111-8111-111111111111',
    '2026-10-20T10:00:00Z','2026-10-21T10:00:00Z');
  if not exists(select 1 from pg_catalog.jsonb_array_elements(j->'rows') x
    where x->>'id'='d1000000-0000-4000-8000-000000000002') then
    raise exception 'HC_READ02_OVERNIGHT_SHIFT_WINDOW_OMISSION'; end if;

  -- Reject malformed windows, overlong lookups, cursor halves, cursor >= end.
  denied:=false;
  begin
    perform public.api_hc_list_my_coverages_page(
      '11111111-1111-4111-8111-111111111111',
      '2026-11-02T00:00:00Z','2026-11-01T00:00:00Z');
  exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'HC_READ02_INVERTED_WINDOW_ALLOWED'; end if;
  denied:=false;
  begin
    perform public.api_hc_list_my_coverages_page(
      '11111111-1111-4111-8111-111111111111',
      '2026-11-02T00:00:00Z','2026-12-30T00:00:00Z');
  exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'HC_READ02_UNBOUNDED_WINDOW_ALLOWED'; end if;
  denied:=false;
  begin
    perform public.api_hc_list_my_coverages_page(
      '11111111-1111-4111-8111-111111111111',
      '2026-11-02T00:00:00Z','2026-11-05T00:00:00Z',
      '2026-11-02T00:00:00Z',null);
  exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'HC_READ02_PARTIAL_CURSOR_ALLOWED'; end if;
  denied:=false;
  begin
    perform public.api_hc_list_my_coverages_page(
      '11111111-1111-4111-8111-111111111111',
      '2026-11-02T00:00:00Z','2026-11-05T00:00:00Z',
      '2026-11-05T00:00:00Z','c0000000-0000-4000-8000-000000000000');
  exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'HC_READ02_INVALID_CURSOR_ALLOWED'; end if;

  denied:=false;
  begin
    perform public.api_hc_list_my_coverages_page(
      '44444444-4444-4444-8444-444444444444',
      '2026-11-02T00:00:00Z','2026-11-05T00:00:00Z');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_READ02_ADMIN_ACCESS_ALLOWED'; end if;
end $$;
commit;

-- Revocation between pages re-evaluates membership on EVERY SQL call.
update public.memberships set active=false
 where organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   and user_id='11111111-1111-4111-8111-111111111111';
begin;
set local role service_role;
do $$
declare denied boolean:=false;
begin
  begin
    perform public.api_hc_list_my_coverages_page(
      '11111111-1111-4111-8111-111111111111',
      '2026-11-02T00:00:00Z','2026-11-05T00:00:00Z');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'HC_READ02_REVOKED_MEMBERSHIP_ALLOWED'; end if;
end $$;
commit;
update public.memberships set active=true
 where organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   and user_id='11111111-1111-4111-8111-111111111111';

select 'HC_READ02_KEYSET_105_ROWS_CROSS_TENANT_REVOCATION_PASS' as test_result;
