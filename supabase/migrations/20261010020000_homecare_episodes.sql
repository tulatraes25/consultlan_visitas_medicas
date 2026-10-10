-- HC-01: home-based pediatric inpatient episodes, plans and care-team scoping.
-- Apply AFTER SUPA-01 and SUPA-02. No data is imported from CONSULTLAN/Pediatrics.
-- Transitional migration: prior prototype visits remain UNBOUND and HIDDEN.
-- They are NOT automatically converted to real home-care episodes.
-- No schema creates diagnoses, therapies, doses, crisis thresholds, or clinical orders.

create table public.homecare_episodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  patient_id uuid not null,
  episode_state text not null default 'DRAFT'
    check (episode_state in ('DRAFT','ACTIVE','SUSPENDED','DISCHARGED')),
  lead_professional_id uuid,
  opened_at timestamptz not null default now(),
  activated_at timestamptz,
  discharged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id,organization_id),
  unique (id,organization_id,patient_id),
  constraint homecare_patient_same_organization
    foreign key (patient_id,organization_id)
    references public.patients(id,organization_id) on delete restrict,
  constraint homecare_lead_same_organization
    foreign key (lead_professional_id,organization_id)
    references public.professionals(id,organization_id) on delete restrict,
  constraint homecare_active_has_activation check (
    episode_state = 'DRAFT' or activated_at is not null
  ),
  constraint homecare_discharge_has_timestamp check (
    (episode_state = 'DISCHARGED') = (discharged_at is not null)
  ),
  constraint homecare_date_sequence check (
    (activated_at is null or activated_at >= opened_at)
    and (discharged_at is null or
      (activated_at is not null and discharged_at >= activated_at))
  )
);

-- Team membership authorizes metadata visibility only, not other specialists'
-- clinical narrative or medical orders. Clinical access rules remain narrower.
create table public.homecare_care_team (
  episode_id uuid not null,
  organization_id uuid not null,
  professional_id uuid not null,
  team_function text not null check (team_function in ('LEAD','CARE_TEAM')),
  active boolean not null default false,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  primary key (episode_id,professional_id),
  constraint care_team_episode_same_organization
    foreign key (episode_id,organization_id)
    references public.homecare_episodes(id,organization_id) on delete restrict,
  constraint care_team_professional_same_organization
    foreign key (professional_id,organization_id)
    references public.professionals(id,organization_id) on delete restrict,
  constraint care_team_active_end_consistency
    check (not active or ended_at is null)
);

-- Plan metadata ONLY, not prescriptions or free-text clinical instructions.
-- APPROVED fixture rows in tests do not constitute physician approval.
-- No direct mobile writes, no production approval API in HC-01.
create table public.homecare_care_plan_versions (
  episode_id uuid not null,
  organization_id uuid not null,
  version_number integer not null check (version_number >= 1),
  plan_state text not null default 'DRAFT'
    check (plan_state in ('DRAFT','APPROVED','SUPERSEDED')),
  approved_by_user_id uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (episode_id,version_number),
  constraint care_plan_episode_same_organization
    foreign key (episode_id,organization_id)
    references public.homecare_episodes(id,organization_id) on delete restrict,
  constraint care_plan_approval_metadata check (
    plan_state <> 'APPROVED'
    or (approved_by_user_id is not null and approved_at is not null)
  ),
  constraint care_plan_validity_interval check (
    valid_until is null or (valid_from is not null and valid_until > valid_from)
  )
);
create unique index care_plan_only_one_approved_per_episode
  on public.homecare_care_plan_versions (episode_id)
  where plan_state = 'APPROVED';

create index homecare_episodes_by_patient
  on public.homecare_episodes (organization_id,patient_id,created_at desc);
create index homecare_team_by_professional
  on public.homecare_care_team (organization_id,professional_id,episode_id)
  where active;
create index homecare_team_by_episode
  on public.homecare_care_team (episode_id,organization_id)
  where active;
create index homecare_plans_by_org
  on public.homecare_care_plan_versions (organization_id,episode_id,version_number desc);

-- Prototype visits may exist before HC-01. Do not manufacture case history,
-- plans or doctor authorizations for those rows.
alter table public.visits
  add column homecare_episode_id uuid,
  add column care_plan_version integer,
  add constraint visit_episode_same_patient
    foreign key (homecare_episode_id,organization_id,patient_id)
    references public.homecare_episodes(id,organization_id,patient_id) on delete restrict,
  add constraint visit_plan_version_belongs_to_episode
    foreign key (homecare_episode_id,care_plan_version)
    references public.homecare_care_plan_versions(episode_id,version_number)
    on delete restrict;
-- NOT VALID keeps old synthetic rows from being fabricated as clinical cases;
-- it nevertheless protects ALL NEW inserts and ALL subsequent row updates.
alter table public.visits
  add constraint visit_requires_real_episode_and_plan
    check (homecare_episode_id is not null and care_plan_version is not null)
    not valid;
create index visits_by_homecare_episode
  on public.visits(organization_id,homecare_episode_id,scheduled_start);

-- New actionable visits require an ACTIVE case, an APPROVED plan version
-- effective at service time, and an active team member matching this patient.
-- No automatic clinical approval is inferred from these checks.
create function private.assert_homecare_visit_safety()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.state not in ('CANCELLED','NOT_PERFORMED') and not exists (
    select 1 from public.homecare_episodes e
      join public.homecare_care_plan_versions p
        on p.episode_id=e.id and p.organization_id=e.organization_id
          and p.version_number=new.care_plan_version
      join public.homecare_care_team t
        on t.episode_id=e.id and t.organization_id=e.organization_id
          and t.professional_id=new.professional_id
      join public.professionals pro
        on pro.id=t.professional_id and pro.organization_id=t.organization_id
      join public.memberships m
        on m.user_id=pro.user_id and m.organization_id=pro.organization_id
    where e.id=new.homecare_episode_id
      and e.organization_id=new.organization_id
      and e.patient_id=new.patient_id
      and e.episode_state='ACTIVE'
      and p.plan_state='APPROVED'
      and (p.valid_from is null or new.scheduled_start >= p.valid_from)
      and (p.valid_until is null or new.scheduled_start < p.valid_until)
      and t.active and pro.active and m.active and m.app_role='PROFESSIONAL'
  ) then
    raise exception 'EPISODE_PLAN_OR_TEAM_NOT_AUTHORIZED' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger homecare_visit_authorization
  before insert or update of organization_id,patient_id,professional_id,
    homecare_episode_id,care_plan_version,scheduled_start,state
  on public.visits
  for each row execute function private.assert_homecare_visit_safety();

-- Fail-closed team scope helper: it is evaluated against server-owned rows,
-- not user-supplied claims or JWT user_metadata.
create function private.is_active_homecare_team_member(p_episode uuid,p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.homecare_care_team t
    join public.homecare_episodes e
      on e.id=t.episode_id and e.organization_id=t.organization_id
    join public.professionals p
      on p.id=t.professional_id and p.organization_id=t.organization_id
    join public.memberships m
      on m.organization_id=p.organization_id and m.user_id=p.user_id
    join public.organizations o on o.id=t.organization_id
    where t.episode_id=p_episode and t.organization_id=p_org
      and p.user_id=(select auth.uid())
      and t.active and p.active and m.active
      and m.app_role='PROFESSIONAL' and o.active
      and e.episode_state in ('ACTIVE','SUSPENDED')
  );
$$;
revoke all on function private.is_active_homecare_team_member(uuid,uuid)
  from public,anon,authenticated;
grant execute on function private.is_active_homecare_team_member(uuid,uuid)
  to authenticated;

-- Existing patient/clinical helpers must also reject legacy unbound visits.
create or replace function private.has_patient_assignment(p_patient_id uuid,p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.visits v
    where v.patient_id=p_patient_id and v.organization_id=p_organization_id
      and v.homecare_episode_id is not null
      and v.state not in ('CANCELLED','NOT_PERFORMED')
      and private.is_assigned_professional(v.professional_id,v.organization_id)
      and private.is_active_homecare_team_member(v.homecare_episode_id,v.organization_id)
  );
$$;

create or replace function private.can_read_visit_clinical(p_visit_id uuid,p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.visits v
    where v.id=p_visit_id and v.organization_id=p_organization_id
      and v.homecare_episode_id is not null
      and v.state not in ('CANCELLED','NOT_PERFORMED')
      and private.is_assigned_professional(v.professional_id,v.organization_id)
      and private.is_active_homecare_team_member(v.homecare_episode_id,v.organization_id)
  );
$$;

alter table public.homecare_episodes enable row level security;
alter table public.homecare_care_team enable row level security;
alter table public.homecare_care_plan_versions enable row level security;

create policy "episode_read_admin_or_active_team" on public.homecare_episodes
for select to authenticated using (
  private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[])
  or private.is_active_homecare_team_member(id,organization_id)
);
create policy "team_metadata_read_admin_or_active_team" on public.homecare_care_team
for select to authenticated using (
  private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[])
  or private.is_active_homecare_team_member(episode_id,organization_id)
);
create policy "plan_metadata_read_admin_or_active_team" on public.homecare_care_plan_versions
for select to authenticated using (
  private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[])
  or private.is_active_homecare_team_member(episode_id,organization_id)
);

drop policy "visits_read_admin_or_assigned_professional" on public.visits;
create policy "visits_read_only_bound_episode" on public.visits
for select to authenticated using (
  homecare_episode_id is not null
  and (
    private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[])
    or (
      private.is_assigned_professional(professional_id,organization_id)
      and private.is_active_homecare_team_member(homecare_episode_id,organization_id)
    )
  )
);

drop policy "attendance_read_admin_or_assigned_professional" on public.attendance_evidence;
create policy "attendance_read_only_bound_episode" on public.attendance_evidence
for select to authenticated using (
  exists (
    select 1 from public.visits v
    where v.id=visit_id and v.organization_id=organization_id
      and v.homecare_episode_id is not null
  )
  and (
    private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[])
    or private.can_read_visit_clinical(visit_id,organization_id)
  )
);

-- Mobile (authenticated) clients read only the permitted minimal metadata.
-- No new RLS policy for INSERT, UPDATE, DELETE. Privileged workflow HC-02.
revoke all on public.homecare_episodes,public.homecare_care_team,
  public.homecare_care_plan_versions from public,anon,authenticated;
grant select on public.homecare_episodes,public.homecare_care_team,
  public.homecare_care_plan_versions to authenticated;
grant select on public.homecare_episodes,public.homecare_care_team,
  public.homecare_care_plan_versions to service_role;

-- Trigger function is not callable directly by a mobile role.
revoke all on function private.assert_homecare_visit_safety()
  from public,anon,authenticated;

comment on table public.homecare_episodes is
  'Independent pediatric homecare episodes, no CONSULTLAN clinic patient references.';
comment on table public.homecare_care_team is
  'Active care team roster; not blanket access to other clinicians clinical notes.';
comment on table public.homecare_care_plan_versions is
  'Plan lifecycle metadata ONLY; NOT prescriptions or medical approval workflow.';
comment on column public.visits.homecare_episode_id is
  'Required for all new visits (CHECK NOT VALID only to keep legacy rows unbound and hidden).';
