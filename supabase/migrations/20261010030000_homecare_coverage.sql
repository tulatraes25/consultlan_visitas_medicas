-- HC-02A: roster for long-term care shifts AND bounded visits, plus handover metadata.
-- Separate from Pediatrics outpatient schedules and NOT a live nursing order system.
-- The previous visits table is now linked to canonical VISIT coverage rows.
-- All mutation of coverage/handover is blocked for mobile AND backend clients
-- until HC-02B authenticated scheduling and care-plan approval workflows exist.

create table public.homecare_coverage_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  episode_id uuid not null,
  patient_id uuid not null,
  professional_id uuid not null,
  care_plan_version integer not null,
  service_kind text not null check (service_kind in ('VISIT','SHIFT')),
  coverage_state text not null default 'PLANNED' check (
    coverage_state in ('PLANNED','ASSIGNED','ACTIVE','COMPLETED','CANCELLED','NOT_PERFORMED')
  ),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  created_at timestamptz not null default now(),
  assigned_by_user_id uuid references auth.users(id) on delete restrict,
  unique (id,organization_id,episode_id),
  constraint coverage_patient_episode_org
    foreign key (episode_id,organization_id,patient_id)
    references public.homecare_episodes(id,organization_id,patient_id) on delete restrict,
  constraint coverage_professional_org
    foreign key (professional_id,organization_id)
    references public.professionals(id,organization_id) on delete restrict,
  constraint coverage_plan_episode_version
    foreign key (episode_id,care_plan_version)
    references public.homecare_care_plan_versions(episode_id,version_number)
    on delete restrict,
  constraint coverage_window_valid check (scheduled_end > scheduled_start)
);

-- A single professional cannot be double-booked in ANY mode of this ledger:
-- VISIT and SHIFT share the same exclusion constraint.
alter table public.homecare_coverage_assignments
  add constraint coverage_no_overlapping_professional
  exclude using gist (
    professional_id with =,
    tstzrange(scheduled_start,scheduled_end,'[)') with &&
  ) where (coverage_state not in ('CANCELLED','NOT_PERFORMED'));

create index coverage_by_episode_time on public.homecare_coverage_assignments
  (organization_id,episode_id,scheduled_start);
create index coverage_by_professional on public.homecare_coverage_assignments
  (organization_id,professional_id,scheduled_start);
create index coverage_by_patient on public.homecare_coverage_assignments
  (organization_id,patient_id,scheduled_start);

create function private.validate_homecare_coverage()
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
      and (plan.valid_until is null or new.scheduled_start < plan.valid_until)
      and team.active and p.active and m.active and m.app_role='PROFESSIONAL'
  ) then
    raise exception 'COVERAGE_PLAN_OR_TEAM_DENIED' using errcode='42501';
  end if;
  return new;
end; $$;
create trigger validate_homecare_coverage
  before insert or update of organization_id,episode_id,patient_id,
    professional_id,care_plan_version,coverage_state,scheduled_start,scheduled_end
  on public.homecare_coverage_assignments
  for each row execute function private.validate_homecare_coverage();

-- A handover is an auditable REQUEST/ACK metadata record, not the
-- underlying nursing narrative, emergency message, or assumed receipt.
create table public.homecare_shift_handovers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  episode_id uuid not null,
  from_assignment_id uuid not null,
  to_assignment_id uuid not null,
  handover_state text not null default 'PENDING'
    check (handover_state in ('PENDING','ACKNOWLEDGED','DECLINED')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by_user_id uuid references auth.users(id) on delete restrict,
  constraint handover_different_assignments
    check (from_assignment_id <> to_assignment_id),
  constraint handover_from_same_episode
    foreign key (from_assignment_id,organization_id,episode_id)
    references public.homecare_coverage_assignments(id,organization_id,episode_id)
    on delete restrict,
  constraint handover_to_same_episode
    foreign key (to_assignment_id,organization_id,episode_id)
    references public.homecare_coverage_assignments(id,organization_id,episode_id)
    on delete restrict,
  constraint handover_ack_evidence_consistent check (
    (handover_state='ACKNOWLEDGED'
     and acknowledged_by_user_id is not null and acknowledged_at is not null)
    or (handover_state <> 'ACKNOWLEDGED'
      and acknowledged_by_user_id is null and acknowledged_at is null)
  )
);
create index handover_by_episode on public.homecare_shift_handovers
  (organization_id,episode_id,created_at desc);
create index handover_by_from on public.homecare_shift_handovers(from_assignment_id);
create index handover_by_to on public.homecare_shift_handovers(to_assignment_id);

create function private.validate_shift_handover()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare v_receiver uuid;
begin
  -- Handovers exist only BETWEEN long-care shifts, never between routine visits.
  select p.user_id into v_receiver
  from public.homecare_coverage_assignments incoming
  join public.homecare_coverage_assignments outgoing
    on outgoing.id=new.from_assignment_id
  join public.professionals p
    on p.id=incoming.professional_id and p.organization_id=incoming.organization_id
  where incoming.id=new.to_assignment_id
    and outgoing.service_kind='SHIFT'
    and incoming.service_kind='SHIFT';
  if v_receiver is null then
    raise exception 'SHIFT_HANDOVER_REQUIRES_TWO_SHIFTS' using errcode='42501';
  end if;
  -- An acknowledgement can be attributed only to the incoming professional.
  -- Still NOT a verified signature: a later RPC must prove JWT/session/action.
  if new.handover_state='ACKNOWLEDGED'
    and new.acknowledged_by_user_id is distinct from v_receiver then
    raise exception 'HANDOVER_ACK_REQUIRES_INCOMING_PROFESSIONAL'
      using errcode='42501';
  end if;
  return new;
end; $$;
create trigger validate_shift_handover
  before insert or update of organization_id,episode_id,from_assignment_id,
    to_assignment_id,handover_state,acknowledged_by_user_id,acknowledged_at
  on public.homecare_shift_handovers
  for each row execute function private.validate_shift_handover();

-- Transitional safety: former VISIT rows not linked to canonical coverage
-- are not automatically backfilled or presented as an approved care roster.
alter table public.visits
  add column homecare_coverage_id uuid,
  add constraint visit_coverage_fk
    foreign key (homecare_coverage_id)
    references public.homecare_coverage_assignments(id) on delete restrict;
alter table public.visits
  add constraint visit_coverage_required
    check (homecare_coverage_id is not null) not valid;
create index visits_by_coverage on public.visits(homecare_coverage_id);

create function private.validate_visit_coverage()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.homecare_coverage_assignments c
    where c.id=new.homecare_coverage_id and c.service_kind='VISIT'
      and c.organization_id=new.organization_id
      and c.episode_id=new.homecare_episode_id
      and c.patient_id=new.patient_id
      and c.professional_id=new.professional_id
      and c.care_plan_version=new.care_plan_version
      and c.scheduled_start=new.scheduled_start
      and c.scheduled_end=new.scheduled_end
      and c.coverage_state not in ('CANCELLED','NOT_PERFORMED')
  ) then
    raise exception 'VISIT_WITHOUT_MATCHING_CANONICAL_COVERAGE'
      using errcode='42501';
  end if;
  return new;
end; $$;
create trigger validate_visit_coverage
  before insert or update of homecare_coverage_id,homecare_episode_id,
    patient_id,organization_id,professional_id,care_plan_version,
    scheduled_start,scheduled_end
  on public.visits
  for each row execute function private.validate_visit_coverage();

-- Patient demographics for a shift assignee, without granting any clinical
-- narratives from other professionals. Active care team is checked separately.
create or replace function private.has_patient_assignment(
  p_patient_id uuid,p_organization_id uuid
) returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.homecare_coverage_assignments c
    where c.patient_id=p_patient_id and c.organization_id=p_organization_id
      and c.coverage_state not in ('CANCELLED','NOT_PERFORMED')
      and private.is_assigned_professional(c.professional_id,c.organization_id)
      and private.is_active_homecare_team_member(c.episode_id,c.organization_id)
  );
$$;

-- No one reads narratives attached to pre-roster prototype visits.
create or replace function private.can_read_visit_clinical(
  p_visit_id uuid,p_organization_id uuid
) returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.visits v
    where v.id=p_visit_id and v.organization_id=p_organization_id
      and v.homecare_episode_id is not null
      and v.homecare_coverage_id is not null
      and v.state not in ('CANCELLED','NOT_PERFORMED')
      and private.is_assigned_professional(v.professional_id,v.organization_id)
      and private.is_active_homecare_team_member(v.homecare_episode_id,v.organization_id)
  );
$$;

drop policy "visits_read_only_bound_episode" on public.visits;
create policy "visits_read_only_bound_coverage" on public.visits
for select to authenticated using (
  homecare_episode_id is not null and homecare_coverage_id is not null
  and (
    private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[])
    or (
      private.is_assigned_professional(professional_id,organization_id)
      and private.is_active_homecare_team_member(homecare_episode_id,organization_id)
    )
  )
);
drop policy "attendance_read_only_bound_episode" on public.attendance_evidence;
create policy "attendance_read_only_bound_coverage" on public.attendance_evidence
for select to authenticated using (
  exists (
    select 1 from public.visits v
    where v.id=visit_id and v.organization_id=organization_id
      and v.homecare_episode_id is not null
      and v.homecare_coverage_id is not null
  )
  and (
    private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[])
    or private.can_read_visit_clinical(visit_id,organization_id)
  )
);

alter table public.homecare_coverage_assignments enable row level security;
alter table public.homecare_shift_handovers enable row level security;

create policy "coverage_admin_or_personal_assignment" on public.homecare_coverage_assignments
for select to authenticated using (
  private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[])
  or (
    private.is_active_homecare_team_member(episode_id,organization_id)
    and private.is_assigned_professional(professional_id,organization_id)
  )
);
create policy "handover_admin_or_shift_participant" on public.homecare_shift_handovers
for select to authenticated using (
  private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[])
  or (
    private.is_active_homecare_team_member(episode_id,organization_id)
    and exists (
      select 1 from public.homecare_coverage_assignments c
      where c.id in (from_assignment_id,to_assignment_id)
        and c.episode_id=episode_id and c.organization_id=organization_id
        and private.is_assigned_professional(c.professional_id,c.organization_id)
    )
  )
);

revoke all on public.homecare_coverage_assignments,public.homecare_shift_handovers
  from public,anon,authenticated;
grant select on public.homecare_coverage_assignments,public.homecare_shift_handovers
  to authenticated;
grant select on public.homecare_coverage_assignments,public.homecare_shift_handovers
  to service_role;
revoke all on function private.validate_homecare_coverage() from public,anon,authenticated;
revoke all on function private.validate_shift_handover() from public,anon,authenticated;
revoke all on function private.validate_visit_coverage() from public,anon,authenticated;

comment on table public.homecare_coverage_assignments is
  'Canonical care roster for both VISIT and SHIFT; no clinical orders or realtime emergency monitoring.';
comment on table public.homecare_shift_handovers is
  'Handover metadata only; ACKNOWLEDGED is not signed clinical narrative or guaranteed communication.';
