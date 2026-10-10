-- SUPA-02. Backend-only operational commands, independently owned Supabase.
-- All RPCs are SECURITY INVOKER and ONLY executable by service_role.
-- A trusted Edge Function must validate Supabase Auth JWT and pass its REAL actor ID.
-- Never put service_role in a mobile app; no live Supabase connections in CI.
create extension if not exists btree_gist;

-- Transactions reject overlapping noncancelled visits for the same professional.
alter table public.visits add constraint no_overlapping_professional_visits
  exclude using gist (
    professional_id with =,
    tstzrange(scheduled_start,scheduled_end,'[)') with &&
  )
  where (state not in ('CANCELLED','NOT_PERFORMED'));

alter table public.visits
  add column created_by_user_id uuid references auth.users(id) on delete restrict,
  add column request_key uuid,
  add column started_at timestamptz,
  add column submitted_for_review_at timestamptz,
  add constraint visits_request_unique unique (organization_id,request_key);

alter table public.patients
  add column created_by_user_id uuid references auth.users(id) on delete restrict,
  add column request_key uuid,
  add constraint patients_request_unique unique (organization_id,request_key);

alter table public.clinical_records
  add column request_key uuid,
  add constraint clinical_request_unique unique (visit_id,request_key);

-- Narrow explicit database privileges for backend role only.
grant usage on schema private to service_role;
-- AUTH is a private schema: only this backend role can check account existence.
grant usage on schema auth to service_role;
grant select on auth.users to service_role;
grant select,insert,update on public.organizations,public.memberships,public.professionals,
  public.patients,public.visits,public.clinical_records,public.attendance_evidence,
  public.audit_events to service_role;
-- Do not grant DELETE; medical records/audit events are append-only in this gate.

-- Server-only gate for active membership, effective immediately even after token revocation.
create function private.assert_actor_role(p_actor uuid,p_org uuid,p_roles text[])
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if p_actor is null or p_org is null or p_roles is null or not exists (
    select 1 from public.memberships m
      join public.organizations o on o.id=m.organization_id
    where m.user_id=p_actor and m.organization_id=p_org
      and m.active and o.active and m.app_role=any(p_roles)
  ) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
end; $$;

create function private.assert_assigned_professional(p_actor uuid,p_visit uuid,p_org uuid,p_expected_state text)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  perform private.assert_actor_role(p_actor,p_org,array['PROFESSIONAL']::text[]);
  if not exists(
    select 1 from public.visits v
      join public.professionals p
        on p.id=v.professional_id and p.organization_id=v.organization_id
    where v.id=p_visit and v.organization_id=p_org
      and p.user_id=p_actor and p.active
      and v.state=p_expected_state
  ) then
    raise exception 'FORBIDDEN_OR_INVALID_STATE' using errcode='42501';
  end if;
end; $$;

-- Idempotent administrative patient creation (minimal directory; no clinical notes).
create function public.api_create_patient(
  p_actor uuid,p_org uuid,p_display_name text,p_request_key uuid
) returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
  v_id uuid;
  v_previous public.patients%rowtype;
begin
  perform private.assert_actor_role(p_actor,p_org,array['ADMIN','COORDINATOR']::text[]);
  if p_request_key is null or p_display_name is null
    or length(btrim(p_display_name)) not between 2 and 160 then
    raise exception 'INVALID_PATIENT_INPUT' using errcode='22023';
  end if;
  insert into public.patients(organization_id,display_name,created_by_user_id,request_key)
  values (p_org,btrim(p_display_name),p_actor,p_request_key)
  on conflict (organization_id,request_key) do nothing
  returning id into v_id;
  if v_id is null then
    select * into v_previous from public.patients
      where organization_id=p_org and request_key=p_request_key;
    if not found or v_previous.created_by_user_id is distinct from p_actor
      or v_previous.display_name is distinct from btrim(p_display_name) then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505';
    end if;
    return v_previous.id;
  end if;
  insert into public.audit_events(organization_id,actor_user_id,event_type,resource_id,safe_metadata)
    values(p_org,p_actor,'PATIENT_CREATED',v_id,'{}'::jsonb);
  return v_id;
end; $$;

-- Register an existing user from *this* Supabase Auth; no creation of auth.users here.
-- Edge Function must invite the user with the authenticated admin API first.
create function public.api_register_professional(
  p_actor uuid,p_org uuid,p_auth_user uuid,p_specialty text
) returns uuid language plpgsql security invoker set search_path = ''
as $$
declare v_id uuid;
begin
  perform private.assert_actor_role(p_actor,p_org,array['ADMIN']::text[]);
  if p_auth_user is null or p_specialty is null
     or length(btrim(p_specialty)) not between 2 and 100 then
    raise exception 'INVALID_PROFESSIONAL_INPUT' using errcode='22023';
  end if;
  if not exists (select 1 from auth.users where id=p_auth_user) then
    raise exception 'AUTH_USER_NOT_FOUND' using errcode='22023';
  end if;
  -- Never escalate/overwrite another role or a previously disabled membership.
  if exists(select 1 from public.memberships
            where organization_id=p_org and user_id=p_auth_user)
     or exists(select 1 from public.professionals
            where organization_id=p_org and user_id=p_auth_user) then
    raise exception 'MEMBERSHIP_ALREADY_EXISTS' using errcode='23505';
  end if;
  insert into public.memberships(organization_id,user_id,app_role,active)
    values(p_org,p_auth_user,'PROFESSIONAL',true);
  insert into public.professionals(organization_id,user_id,specialty,active)
    values(p_org,p_auth_user,btrim(p_specialty),true) returning id into v_id;
  insert into public.audit_events(organization_id,actor_user_id,event_type,resource_id,safe_metadata)
    values(p_org,p_actor,'PROFESSIONAL_REGISTERED',v_id,'{}'::jsonb);
  return v_id;
end; $$;

-- Idempotent scheduling plus DB-level overlap exclusion (concurrent-safe).
create function public.api_schedule_visit(
  p_actor uuid,p_org uuid,p_patient uuid,p_professional uuid,
  p_start timestamptz,p_end timestamptz,p_request_key uuid
) returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
  v_id uuid;
  v_previous public.visits%rowtype;
begin
  perform private.assert_actor_role(p_actor,p_org,array['ADMIN','COORDINATOR']::text[]);
  if p_patient is null or p_professional is null or p_start is null
    or p_end is null or p_request_key is null
    or p_end<=p_start or p_end>p_start+interval '24 hours' then
      raise exception 'INVALID_VISIT_INPUT' using errcode='22023';
  end if;
  if not exists (select 1 from public.patients where id=p_patient
                 and organization_id=p_org and active)
    or not exists(
      select 1 from public.professionals p
      join public.memberships m on m.organization_id=p.organization_id
        and m.user_id=p.user_id and m.active and m.app_role='PROFESSIONAL'
      where p.id=p_professional and p.organization_id=p_org and p.active
    ) then
    raise exception 'PATIENT_OR_PROFESSIONAL_UNAVAILABLE' using errcode='42501';
  end if;
  -- Idempotent retry must never create a second visit.
  insert into public.visits(
    organization_id,patient_id,professional_id,scheduled_start,scheduled_end,
    state,created_by_user_id,request_key)
    values(p_org,p_patient,p_professional,p_start,p_end,'ASSIGNED',p_actor,p_request_key)
    on conflict (organization_id,request_key) do nothing
    returning id into v_id;
  if v_id is null then
    select * into v_previous from public.visits
      where organization_id=p_org and request_key=p_request_key;
    if not found or v_previous.created_by_user_id is distinct from p_actor
      or v_previous.patient_id is distinct from p_patient
      or v_previous.professional_id is distinct from p_professional
      or v_previous.scheduled_start is distinct from p_start
      or v_previous.scheduled_end is distinct from p_end then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505';
    end if;
    return v_previous.id;
  end if;
  insert into public.audit_events(organization_id,actor_user_id,event_type,resource_id,safe_metadata)
    values(p_org,p_actor,'VISIT_ASSIGNED',v_id,'{}'::jsonb);
  return v_id;
end; $$;

-- The professional starts only their own assigned visit; timestamp from DB.
create function public.api_begin_visit(p_actor uuid,p_org uuid,p_visit uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  -- Serialize against cancellation and other state transitions.
  perform 1 from public.visits where id=p_visit and organization_id=p_org for update;
  perform private.assert_assigned_professional(p_actor,p_visit,p_org,'ASSIGNED');
  update public.visits set state='IN_PROGRESS',started_at=now()
    where id=p_visit and organization_id=p_org;
  insert into public.audit_events(organization_id,actor_user_id,event_type,resource_id,safe_metadata)
    values(p_org,p_actor,'VISIT_STARTED',p_visit,'{}'::jsonb);
end; $$;

-- Versioned clinical note. Lock the visit to serialize version numbers.
-- Never let coordination / administration write another user's clinical notes.
create function public.api_add_clinical_note(
  p_actor uuid,p_org uuid,p_visit uuid,p_narrative text,p_request_key uuid
) returns integer language plpgsql security invoker set search_path = ''
as $$
declare v_previous public.clinical_records%rowtype; v_version integer;
begin
  perform 1 from public.visits where id=p_visit and organization_id=p_org for update;
  perform private.assert_assigned_professional(p_actor,p_visit,p_org,'IN_PROGRESS');
  if p_request_key is null or p_narrative is null
     or length(btrim(p_narrative)) not between 1 and 20000 then
      raise exception 'INVALID_CLINICAL_INPUT' using errcode='22023';
  end if;
  select * into v_previous from public.clinical_records
    where visit_id=p_visit and request_key=p_request_key;
  if found then
    if v_previous.author_user_id is distinct from p_actor
      or v_previous.narrative is distinct from btrim(p_narrative) then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505';
    end if;
    return v_previous.version_number;
  end if;
  select coalesce(max(version_number),0)+1 into v_version
    from public.clinical_records where visit_id=p_visit;
  insert into public.clinical_records(
    organization_id,visit_id,author_user_id,version_number,narrative,request_key)
    values (p_org,p_visit,p_actor,v_version,btrim(p_narrative),p_request_key);
  -- No clinical narrative in the audit log.
  insert into public.audit_events(organization_id,actor_user_id,event_type,resource_id,safe_metadata)
    values(p_org,p_actor,'CLINICAL_VERSION_ADDED',p_visit,
      jsonb_build_object('version',v_version));
  return v_version;
end; $$;

-- Note existence required before review; still not a signed clinical document.
create function public.api_submit_visit_review(p_actor uuid,p_org uuid,p_visit uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  perform 1 from public.visits where id=p_visit and organization_id=p_org for update;
  perform private.assert_assigned_professional(p_actor,p_visit,p_org,'IN_PROGRESS');
  if not exists(select 1 from public.clinical_records
                where visit_id=p_visit and organization_id=p_org) then
    raise exception 'CLINICAL_NOTE_REQUIRED' using errcode='22023';
  end if;
  update public.visits set state='PENDING_REVIEW',submitted_for_review_at=now()
    where id=p_visit and organization_id=p_org;
  insert into public.audit_events(organization_id,actor_user_id,event_type,resource_id,safe_metadata)
    values(p_org,p_actor,'VISIT_REVIEW_REQUESTED',p_visit,'{}'::jsonb);
end; $$;

-- Cancellation is an administrative action with structured reason code only.
create function public.api_cancel_visit(
  p_actor uuid,p_org uuid,p_visit uuid,p_reason_code text
) returns void language plpgsql security invoker set search_path = ''
as $$
declare v_state text;
begin
  perform private.assert_actor_role(p_actor,p_org,array['ADMIN','COORDINATOR']::text[]);
  if p_reason_code is null or p_reason_code not in
    ('SERVICE_NOT_REQUIRED','PATIENT_UNAVAILABLE','PROFESSIONAL_UNAVAILABLE','OTHER') then
    raise exception 'INVALID_REASON' using errcode='22023';
  end if;
  select state into v_state from public.visits
    where id=p_visit and organization_id=p_org for update;
  if v_state is null or v_state not in ('PLANNED','ASSIGNED') then
    raise exception 'CANCELLATION_FORBIDDEN' using errcode='42501';
  end if;
  update public.visits set state='CANCELLED'
    where id=p_visit and organization_id=p_org;
  insert into public.audit_events(organization_id,actor_user_id,event_type,resource_id,safe_metadata)
    values(p_org,p_actor,'VISIT_CANCELLED',p_visit,
      jsonb_build_object('reason_code',p_reason_code));
end; $$;

-- Default PostgreSQL EXECUTE is PUBLIC. Restrict explicitly.
revoke all on function private.assert_actor_role(uuid,uuid,text[]) from public,anon,authenticated;
revoke all on function private.assert_assigned_professional(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.api_create_patient(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.api_register_professional(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.api_schedule_visit(uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.api_begin_visit(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.api_add_clinical_note(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.api_submit_visit_review(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.api_cancel_visit(uuid,uuid,uuid,text) from public,anon,authenticated;

grant execute on function private.assert_actor_role(uuid,uuid,text[]) to service_role;
grant execute on function private.assert_assigned_professional(uuid,uuid,uuid,text) to service_role;
grant execute on function public.api_create_patient(uuid,uuid,text,uuid) to service_role;
grant execute on function public.api_register_professional(uuid,uuid,uuid,text) to service_role;
grant execute on function public.api_schedule_visit(uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid) to service_role;
grant execute on function public.api_begin_visit(uuid,uuid,uuid) to service_role;
grant execute on function public.api_add_clinical_note(uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.api_submit_visit_review(uuid,uuid,uuid) to service_role;
grant execute on function public.api_cancel_visit(uuid,uuid,uuid,text) to service_role;
