-- HC-02B: controlled planning commands (NO clinical approval/discharge/signature).
-- All functions use SECURITY DEFINER with pinned empty search_path.
-- Only service_role may EXECUTE; Edge derives p_actor from verified Supabase Auth.
-- Neither mobile clients nor service_role receive direct write grants on care tables.

alter table public.homecare_episodes
  add column created_by_user_id uuid references auth.users(id) on delete restrict,
  add column request_key uuid,
  add constraint hc_episode_org_request_key unique (organization_id,request_key);

alter table public.homecare_care_plan_versions
  add column created_by_user_id uuid references auth.users(id) on delete restrict,
  add column request_key uuid,
  add constraint hc_plan_episode_request_key unique (episode_id,request_key);

alter table public.homecare_coverage_assignments
  add column request_key uuid,
  add constraint hc_coverage_org_request_key unique (organization_id,request_key);

alter table public.homecare_shift_handovers
  add constraint hc_handover_pair_unique unique (from_assignment_id,to_assignment_id);

-- Prevent a coverage from extending beyond plan expiry. HC-02A validated
-- start only; a visit ending after expiry must also fail closed.
create or replace function private.validate_homecare_coverage()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op='INSERT' and new.coverage_state in ('CANCELLED','NOT_PERFORMED') then
    raise exception 'NEW_COVERAGE_MUST_BE_PLANNED' using errcode='42501';
  end if;
  if new.coverage_state not in ('CANCELLED','NOT_PERFORMED') and not exists (
    select 1 from public.homecare_episodes e
    join public.homecare_care_plan_versions plan
      on plan.episode_id=e.id and plan.organization_id=e.organization_id
      and plan.version_number=new.care_plan_version
    join public.homecare_care_team team
      on team.episode_id=e.id and team.organization_id=e.organization_id
      and team.professional_id=new.professional_id
    join public.professionals p
      on p.id=team.professional_id and p.organization_id=team.organization_id
    join public.memberships m
      on m.organization_id=p.organization_id and m.user_id=p.user_id
    where e.id=new.episode_id and e.organization_id=new.organization_id
      and e.patient_id=new.patient_id and e.episode_state='ACTIVE'
      and plan.plan_state='APPROVED'
      and (plan.valid_from is null or new.scheduled_start >= plan.valid_from)
      and (plan.valid_until is null or new.scheduled_end <= plan.valid_until)
      and team.active and p.active and m.active and m.app_role='PROFESSIONAL'
  ) then
    raise exception 'COVERAGE_PLAN_OR_TEAM_DENIED' using errcode='42501';
  end if;
  return new;
end;
$$;

-- Planned VISITs and care shifts are not the same activity type.
-- The medical lead is NOT assigned or approved through these administrative commands.
create function public.api_hc_create_episode_draft(
  p_actor uuid,p_org uuid,p_patient uuid,p_request_key uuid
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_prev public.homecare_episodes%rowtype;
begin
  perform private.assert_actor_role(p_actor,p_org,array['ADMIN','COORDINATOR']::text[]);
  if p_patient is null or p_request_key is null
    or not exists(select 1 from public.patients p where p.id=p_patient
      and p.organization_id=p_org and p.active) then
    raise exception 'INVALID_HOMECARE_PATIENT' using errcode='22023';
  end if;
  -- Same request key is serialized to avoid duplicates during retries/races.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_org::text||'episode'||p_request_key::text,0));
  select * into v_prev from public.homecare_episodes
    where organization_id=p_org and request_key=p_request_key;
  if found then
    if v_prev.patient_id is distinct from p_patient
      or v_prev.created_by_user_id is distinct from p_actor then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505';
    end if;
    return v_prev.id;
  end if;
  insert into public.homecare_episodes(
    organization_id,patient_id,episode_state,created_by_user_id,request_key)
    values(p_org,p_patient,'DRAFT',p_actor,p_request_key) returning id into v_id;
  insert into public.audit_events(
    organization_id,actor_user_id,event_type,resource_id,safe_metadata)
    values(p_org,p_actor,'HC_EPISODE_DRAFT_CREATED',v_id,'{}'::jsonb);
  return v_id;
end; $$;

-- Coordination may assign a care-team participant for PLANNING only.
-- LEAD is deliberately blocked until an approved clinical credential process exists.
create function public.api_hc_assign_team_member(
  p_actor uuid,p_org uuid,p_episode uuid,p_professional uuid
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_existing public.homecare_care_team%rowtype;
begin
  perform private.assert_actor_role(p_actor,p_org,array['ADMIN','COORDINATOR']::text[]);
  if p_episode is null or p_professional is null
    or not exists(
      select 1 from public.homecare_episodes e
      where e.id=p_episode and e.organization_id=p_org
        and e.episode_state in ('DRAFT','ACTIVE')
    ) or not exists(
      select 1 from public.professionals p
      join public.memberships m
        on m.user_id=p.user_id and m.organization_id=p.organization_id
      where p.id=p_professional and p.organization_id=p_org
        and p.active and m.active and m.app_role='PROFESSIONAL'
    ) then
    raise exception 'INVALID_CARE_TEAM_ASSIGNMENT' using errcode='42501';
  end if;
  -- Prevent concurrent writes to the episode roster, even by different coordinators.
  perform 1 from public.homecare_episodes where id=p_episode and organization_id=p_org for update;
  select * into v_existing from public.homecare_care_team
    where episode_id=p_episode and professional_id=p_professional;
  if found then
    if not v_existing.active or v_existing.team_function <> 'CARE_TEAM' then
      raise exception 'TEAM_MEMBERSHIP_CONFLICT' using errcode='23505';
    end if;
    return;
  end if;
  insert into public.homecare_care_team(
    episode_id,organization_id,professional_id,team_function,active)
    values(p_episode,p_org,p_professional,'CARE_TEAM',true);
  insert into public.audit_events(
    organization_id,actor_user_id,event_type,resource_id,safe_metadata)
    values(p_org,p_actor,'HC_TEAM_MEMBER_ASSIGNED',p_episode,
      pg_catalog.jsonb_build_object('professional_id',p_professional));
end; $$;

-- Placeholder METADATA draft only: no prescriptions, notes or inferred
-- treatment. Approved plans require a separate clinical authorization gate.
create function public.api_hc_create_plan_draft(
  p_actor uuid,p_org uuid,p_episode uuid,p_request_key uuid
) returns integer language plpgsql security definer set search_path = ''
as $$
declare v_previous public.homecare_care_plan_versions%rowtype; v_version integer;
begin
  perform private.assert_actor_role(p_actor,p_org,array['ADMIN','COORDINATOR']::text[]);
  if p_episode is null or p_request_key is null then
    raise exception 'INVALID_PLAN_DRAFT_INPUT' using errcode='22023';
  end if;
  perform 1 from public.homecare_episodes
    where id=p_episode and organization_id=p_org
      and episode_state in ('DRAFT','ACTIVE') for update;
  if not found then
    raise exception 'EPISODE_UNAVAILABLE' using errcode='42501';
  end if;
  select * into v_previous from public.homecare_care_plan_versions
    where episode_id=p_episode and request_key=p_request_key;
  if found then
    if v_previous.organization_id is distinct from p_org
      or v_previous.created_by_user_id is distinct from p_actor then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505';
    end if;
    return v_previous.version_number;
  end if;
  select coalesce(max(version_number),0)+1 into v_version
    from public.homecare_care_plan_versions where episode_id=p_episode;
  insert into public.homecare_care_plan_versions(
    episode_id,organization_id,version_number,plan_state,
    created_by_user_id,request_key)
    values(p_episode,p_org,v_version,'DRAFT',p_actor,p_request_key);
  insert into public.audit_events(
    organization_id,actor_user_id,event_type,resource_id,safe_metadata)
    values(p_org,p_actor,'HC_PLAN_METADATA_DRAFTED',p_episode,
      pg_catalog.jsonb_build_object('version',v_version));
  return v_version;
end; $$;

-- Canonical VISIT/SHIFT scheduling. Works only for an ACTIVE episode with
-- an already APPROVED plan from a future verified clinical workflow.
-- Creates VISIT detail atomically for VISIT; a SHIFT never creates visits.
create function public.api_hc_schedule_coverage(
  p_actor uuid,p_org uuid,p_episode uuid,p_professional uuid,
  p_plan_version integer,p_kind text,p_start timestamptz,p_end timestamptz,
  p_request_key uuid
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_prev public.homecare_coverage_assignments%rowtype; v_patient uuid;
begin
  perform private.assert_actor_role(p_actor,p_org,array['ADMIN','COORDINATOR']::text[]);
  if p_episode is null or p_professional is null or p_request_key is null
    or p_plan_version is null or p_plan_version < 1
    or p_kind is null or p_kind not in ('VISIT','SHIFT')
    or p_start is null or p_end is null or p_end<=p_start
    or p_end>p_start+interval '24 hours' then
    raise exception 'INVALID_COVERAGE_INPUT' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_org::text||'coverage'||p_request_key::text,0));
  select * into v_prev from public.homecare_coverage_assignments
    where organization_id=p_org and request_key=p_request_key;
  if found then
    if v_prev.assigned_by_user_id is distinct from p_actor
      or v_prev.episode_id is distinct from p_episode
      or v_prev.professional_id is distinct from p_professional
      or v_prev.care_plan_version is distinct from p_plan_version
      or v_prev.service_kind is distinct from p_kind
      or v_prev.scheduled_start is distinct from p_start
      or v_prev.scheduled_end is distinct from p_end then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505';
    end if;
    return v_prev.id;
  end if;
  -- Serialize with team modifications/episode changes and get LOCAL patient.
  select patient_id into v_patient from public.homecare_episodes
    where id=p_episode and organization_id=p_org and episode_state='ACTIVE'
    for update;
  if v_patient is null then
    raise exception 'EPISODE_NOT_ACTIVE' using errcode='42501';
  end if;
  insert into public.homecare_coverage_assignments(
    organization_id,episode_id,patient_id,professional_id,care_plan_version,
    service_kind,coverage_state,scheduled_start,scheduled_end,
    assigned_by_user_id,request_key)
    values(p_org,p_episode,v_patient,p_professional,p_plan_version,
      p_kind,'ASSIGNED',p_start,p_end,p_actor,p_request_key)
    returning id into v_id;
  if p_kind='VISIT' then
    insert into public.visits(
      organization_id,homecare_episode_id,homecare_coverage_id,patient_id,
      professional_id,care_plan_version,scheduled_start,scheduled_end,
      state,created_by_user_id,request_key)
      values(p_org,p_episode,v_id,v_patient,p_professional,p_plan_version,
        p_start,p_end,'ASSIGNED',p_actor,p_request_key);
  end if;
  insert into public.audit_events(
    organization_id,actor_user_id,event_type,resource_id,safe_metadata)
    values(p_org,p_actor,'HC_COVERAGE_ASSIGNED',v_id,
      pg_catalog.jsonb_build_object('kind',p_kind,'episode_id',p_episode));
  return v_id;
end; $$;

-- Handover REQUEST only; adjacent shifts in same episode.
-- It never claims the incoming clinician read or accepted clinical content.
create function public.api_hc_request_handover(
  p_actor uuid,p_org uuid,p_outgoing uuid,p_incoming uuid
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_out public.homecare_coverage_assignments%rowtype;
  v_in public.homecare_coverage_assignments%rowtype;
  v_id uuid;
begin
  perform private.assert_actor_role(p_actor,p_org,array['ADMIN','COORDINATOR']::text[]);
  if p_outgoing is null or p_incoming is null or p_outgoing=p_incoming then
    raise exception 'INVALID_HANDOVER_PAIR' using errcode='22023';
  end if;
  -- Serialize duplicate pair requests and prevent duplicate audit entries.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('handover'||p_outgoing::text||p_incoming::text,0));
  select id into v_id from public.homecare_shift_handovers
    where from_assignment_id=p_outgoing and to_assignment_id=p_incoming;
  if v_id is not null then return v_id; end if;
  select * into v_out from public.homecare_coverage_assignments
    where id=p_outgoing and organization_id=p_org;
  select * into v_in from public.homecare_coverage_assignments
    where id=p_incoming and organization_id=p_org;
  if v_out.id is null or v_in.id is null
    or v_out.episode_id is distinct from v_in.episode_id
    or v_out.service_kind <> 'SHIFT' or v_in.service_kind <> 'SHIFT'
    or v_out.coverage_state in ('CANCELLED','NOT_PERFORMED')
    or v_in.coverage_state in ('CANCELLED','NOT_PERFORMED')
    or v_out.scheduled_end is distinct from v_in.scheduled_start then
    raise exception 'HANDOVER_REQUIRES_ADJACENT_VALID_SHIFTS' using errcode='42501';
  end if;
  insert into public.homecare_shift_handovers(
    organization_id,episode_id,from_assignment_id,to_assignment_id,handover_state)
    values(p_org,v_out.episode_id,p_outgoing,p_incoming,'PENDING')
    returning id into v_id;
  insert into public.audit_events(
    organization_id,actor_user_id,event_type,resource_id,safe_metadata)
    values(p_org,p_actor,'HC_HANDOVER_REQUESTED',v_id,'{}'::jsonb);
  return v_id;
end; $$;

-- Only incoming verified Auth professional may attest RECEIPT, not agreement
-- with medical content or safe completion of an emergency response.
create function public.api_hc_ack_handover(
  p_actor uuid,p_org uuid,p_handover uuid
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_h public.homecare_shift_handovers%rowtype;
  v_in public.homecare_coverage_assignments%rowtype;
begin
  perform private.assert_actor_role(p_actor,p_org,array['PROFESSIONAL']::text[]);
  if p_handover is null then
    raise exception 'HANDOVER_ID_REQUIRED' using errcode='22023';
  end if;
  select * into v_h from public.homecare_shift_handovers
    where id=p_handover and organization_id=p_org for update;
  if v_h.id is null or v_h.handover_state not in ('PENDING','ACKNOWLEDGED') then
    raise exception 'HANDOVER_UNAVAILABLE' using errcode='42501';
  end if;
  select * into v_in from public.homecare_coverage_assignments
    where id=v_h.to_assignment_id and organization_id=p_org
      and coverage_state not in ('CANCELLED','NOT_PERFORMED');
  if v_in.id is null or not exists(
    select 1 from public.professionals p
    join public.homecare_care_team team
      on team.episode_id=v_in.episode_id and team.organization_id=v_in.organization_id
      and team.professional_id=p.id
    join public.homecare_episodes e
      on e.id=team.episode_id and e.organization_id=team.organization_id
    where p.id=v_in.professional_id and p.user_id=p_actor
      and p.organization_id=p_org and p.active and team.active
      and e.episode_state='ACTIVE'
  ) then
    raise exception 'HANDOVER_NOT_ASSIGNED_TO_ACTOR' using errcode='42501';
  end if;
  if v_h.handover_state='ACKNOWLEDGED' then
    if v_h.acknowledged_by_user_id is distinct from p_actor then
      raise exception 'HANDOVER_ACK_CONFLICT' using errcode='42501';
    end if;
    return;
  end if;
  update public.homecare_shift_handovers
    set handover_state='ACKNOWLEDGED',
      acknowledged_by_user_id=p_actor,acknowledged_at=now()
    where id=p_handover and organization_id=p_org;
  insert into public.audit_events(
    organization_id,actor_user_id,event_type,resource_id,safe_metadata)
    values(p_org,p_actor,'HC_HANDOVER_RECEIPT_ACK',p_handover,'{}'::jsonb);
end; $$;

-- All APIs use SECURITY DEFINER; their owner (postgres) executes scoped SQL.
-- Explicitly block all mobile roles. service_role only calls these named RPCs.
revoke all on function public.api_hc_create_episode_draft(uuid,uuid,uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.api_hc_assign_team_member(uuid,uuid,uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.api_hc_create_plan_draft(uuid,uuid,uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.api_hc_schedule_coverage(uuid,uuid,uuid,uuid,integer,text,timestamptz,timestamptz,uuid)
  from public,anon,authenticated;
revoke all on function public.api_hc_request_handover(uuid,uuid,uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.api_hc_ack_handover(uuid,uuid,uuid)
  from public,anon,authenticated;

grant execute on function public.api_hc_create_episode_draft(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.api_hc_assign_team_member(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.api_hc_create_plan_draft(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.api_hc_schedule_coverage(uuid,uuid,uuid,uuid,integer,text,timestamptz,timestamptz,uuid) to service_role;
grant execute on function public.api_hc_request_handover(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.api_hc_ack_handover(uuid,uuid,uuid) to service_role;

comment on function public.api_hc_create_plan_draft(uuid,uuid,uuid,uuid)
  is 'Creates empty care-plan metadata DRAFT, NOT a medication order or clinical approval';
comment on function public.api_hc_ack_handover(uuid,uuid,uuid)
  is 'Records receipt by incoming professional, NOT a clinical handover signature';
