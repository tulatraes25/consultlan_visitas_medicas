-- HC-02C1B: synthetic review intake is PENDING ONLY.
-- Must run after HC-02B SQL tests and the HC-02C1B migration.
\set ON_ERROR_STOP on

-- Real request through the trusted service role; no patient fields accepted.
begin;
set local role service_role;
do $$
declare
  org_a constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  org_b constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  admin_a constant uuid := '44444444-4444-4444-8444-444444444444';
  clinician constant uuid := '11111111-1111-4111-8111-111111111111';
  draft_id uuid;
  first_id uuid;
  idempotency_key constant uuid := '00000000-0200-4000-8000-000000000091';
  n integer;
  rejected boolean;
begin
  select id into draft_id from public.homecare_episodes
    where organization_id=org_a
      and request_key='00000000-0200-4000-8000-000000000003';
  if draft_id is null then raise exception 'HC02C1B_REQUIRED_DRAFT_NOT_FOUND'; end if;

  first_id := public.api_hc_request_plan_review(
    admin_a,org_a,draft_id,1,idempotency_key);
  if first_id is distinct from public.api_hc_request_plan_review(
    admin_a,org_a,draft_id,1,idempotency_key) then
    raise exception 'REVIEW_IDEMPOTENCY_FAILED';
  end if;
  select count(*) into n from public.homecare_plan_review_requests
    where id=first_id and organization_id=org_a and review_state='PENDING';
  if n<>1 then raise exception 'PENDING_REVIEW_RECORD_MISSING'; end if;
  select count(*) into n from public.audit_events
    where event_type='HC_PLAN_REVIEW_REQUESTED' and resource_id=first_id;
  if n<>1 then raise exception 'REVIEW_AUDIT_DUPLICATED_OR_MISSING'; end if;

  rejected:=false;
  begin
    perform public.api_hc_request_plan_review(
      admin_a,org_a,draft_id,2,idempotency_key);
  exception when unique_violation then rejected:=true;
  end;
  if not rejected then raise exception 'REVIEW_IDEMPOTENCY_REUSE_NOT_BLOCKED'; end if;

  rejected:=false;
  begin
    perform public.api_hc_request_plan_review(
      admin_a,org_a,draft_id,1,'00000000-0200-4000-8000-000000000092');
  exception when unique_violation then rejected:=true;
  end;
  if not rejected then raise exception 'DUPLICATE_REVIEW_PER_VERSION_NOT_BLOCKED'; end if;

  rejected:=false;
  begin
    perform public.api_hc_request_plan_review(
      clinician,org_a,draft_id,2,'00000000-0200-4000-8000-000000000093');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'PROFESSIONAL_REQUESTED_LOGISTIC_REVIEW'; end if;

  rejected:=false;
  begin
    perform public.api_hc_request_plan_review(
      admin_a,org_b,draft_id,2,'00000000-0200-4000-8000-000000000094');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'CROSS_ORGANIZATION_REVIEW_REQUEST'; end if;

  rejected:=false;
  begin
    perform public.api_hc_request_plan_review(
      admin_a,org_a,'e1000000-0000-4000-8000-000000000001',1,
      '00000000-0200-4000-8000-000000000095');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'ACTIVE_EPISODE_REVIEW_ALLOWED'; end if;

  select count(*) into n from public.homecare_episodes e
    join public.homecare_care_plan_versions p on p.episode_id=e.id
    where e.id=draft_id and e.episode_state='DRAFT'
      and p.version_number=1 and p.plan_state='DRAFT'
      and p.approved_at is null and p.approved_by_user_id is null;
  if n<>1 then raise exception 'REVIEW_REQUEST_CHANGED_CLINICAL_STATE'; end if;

  rejected:=false;
  begin
    update public.homecare_plan_review_requests set review_state='APPROVED'
      where id=first_id;
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'SERVICE_ROLE_DIRECT_APPROVAL_WRITE'; end if;

  rejected:=false;
  begin
    insert into public.homecare_plan_review_requests(
      organization_id,episode_id,plan_version,requested_by_user_id,request_key)
    values (org_a,draft_id,2,admin_a,
      '00000000-0200-4000-8000-000000000096');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'SERVICE_ROLE_BYPASSED_REVIEW_RPC'; end if;
end $$;
commit;

-- RLS permits only authorized coordinators/admins to read review metadata.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$
declare n integer; rejected boolean:=false;
begin
  select count(*) into n from public.homecare_plan_review_requests
    where request_key='00000000-0200-4000-8000-000000000091';
  if n<>1 then raise exception 'ACTIVE_ADMIN_CANNOT_READ_REVIEW_METADATA'; end if;
  begin
    perform public.api_hc_request_plan_review(
      '44444444-4444-4444-8444-444444444444',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'e1000000-0000-4000-8000-000000000001',1,
      '00000000-0200-4000-8000-000000000097');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'MOBILE_CAN_INVOKE_REVIEW_RPC'; end if;
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare n integer;
begin
  select count(*) into n from public.homecare_plan_review_requests;
  if n<>0 then raise exception 'PROFESSIONAL_COULD_READ_ADMIN_REVIEW_QUEUE'; end if;
end $$;
commit;

begin;
set local role anon;
do $$
declare rejected boolean:=false;
begin
  begin
    perform public.api_hc_request_plan_review(
      '44444444-4444-4444-8444-444444444444',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'e1000000-0000-4000-8000-000000000001',1,
      '00000000-0200-4000-8000-000000000098');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'ANON_REVIEW_RPC_ACCESS'; end if;
end $$;
commit;

select 'HC-02C1B PENDING PLAN REVIEW: ALL SYNTHETIC SQL ASSERTIONS PASS' as result;
