-- GATE SUPA-01: Standalone Supabase database foundation. No Pediatrics/CONSULTLAN dependency.
-- Expected environment: fresh Supabase project (auth.users and roles authenticated/anon already exist).
-- This migration intentionally exposes read-only tables to authenticated users.
-- All writes/management are DENIED until separately audited Edge Functions/RPC are added.
create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  app_role text not null check (app_role in ('ADMIN','COORDINATOR','PROFESSIONAL','AUDITOR')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  specialty text not null check (length(trim(specialty)) between 2 and 100),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id,organization_id),
  unique (organization_id,user_id)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 2 and 160),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id,organization_id)
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  patient_id uuid not null,
  professional_id uuid not null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  state text not null default 'PLANNED' check (
    state in ('PLANNED','ASSIGNED','IN_PROGRESS','PENDING_REVIEW',
              'PENDING_SIGNATURE','CLOSED_VERIFIED','CANCELLED','NOT_PERFORMED')
  ),
  created_at timestamptz not null default now(),
  unique (id,organization_id),
  constraint visits_patient_same_organization foreign key (patient_id,organization_id)
    references public.patients (id,organization_id) on delete restrict,
  constraint visits_professional_same_organization foreign key (professional_id,organization_id)
    references public.professionals (id,organization_id) on delete restrict,
  constraint visit_schedule_window check (scheduled_end > scheduled_start)
);

-- Clinical content is NOT exposed to ADMIN/COORDINATOR by role.
-- Only an active assigned professional with active membership can read it.
create table public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  visit_id uuid not null,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  narrative text not null check (length(trim(narrative)) between 1 and 20000),
  created_at timestamptz not null default now(),
  unique (visit_id,version_number),
  constraint clinical_record_visit_same_organization foreign key (visit_id,organization_id)
    references public.visits(id,organization_id) on delete restrict
);

-- Administrative attendance evidence: NOT a digital signature, not informed consent.
-- No raw ink image is stored here and only verified server-side code may write records.
create table public.attendance_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  visit_id uuid not null,
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-fA-F]{64}$'),
  outcome text not null check (outcome in ('PENDING','SIGNED_ELECTRONIC','REFUSED','UNAVAILABLE')),
  signer_relationship text check (signer_relationship in ('PARENT','LEGAL_GUARDIAN','AUTHORIZED_CAREGIVER')),
  signer_identity_verified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint attendance_evidence_visit_same_organization foreign key (visit_id,organization_id)
    references public.visits(id,organization_id) on delete restrict,
  constraint signed_evidence_requires_identity check (
    outcome <> 'SIGNED_ELECTRONIC'
    or (signer_identity_verified and signer_relationship is not null)
  )
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  event_type text not null check (length(trim(event_type)) between 2 and 80),
  resource_id uuid,
  -- Never put raw patient notes or unredacted signatures in audit metadata.
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index memberships_by_user_active on public.memberships(user_id,organization_id) where active;
create index professionals_by_user_org on public.professionals(user_id,organization_id) where active;
create index visits_by_professional on public.visits(organization_id,professional_id,scheduled_start);
create index visits_by_patient on public.visits(organization_id,patient_id,scheduled_start);
create index clinical_by_visit on public.clinical_records(organization_id,visit_id);
create index attendance_by_visit on public.attendance_evidence(organization_id,visit_id);
create index audit_by_organization_time on public.audit_events(organization_id,created_at desc);

-- Helper functions deliberately live in an UNEXPOSED schema.
-- SQL function bodies use fully qualified names and pinned empty search_path.
create function private.has_membership(p_organization_id uuid, p_roles text[] default null)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.active and o.active
      and (p_roles is null or m.app_role = any(p_roles))
  );
$$;

create function private.is_assigned_professional(p_professional_id uuid, p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.professionals p
    join public.memberships m
      on m.user_id = p.user_id and m.organization_id = p.organization_id
    join public.organizations o on o.id = p.organization_id
    where p.id = p_professional_id and p.organization_id = p_organization_id
      and p.user_id = (select auth.uid())
      and p.active and m.active and o.active and m.app_role = 'PROFESSIONAL'
  );
$$;

create function private.can_read_visit_clinical(p_visit_id uuid, p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.visits v
    where v.id = p_visit_id and v.organization_id = p_organization_id
      and v.state not in ('CANCELLED','NOT_PERFORMED')
      and private.is_assigned_professional(v.professional_id,v.organization_id)
  );
$$;

create function private.has_patient_assignment(p_patient_id uuid, p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.visits v
    where v.patient_id = p_patient_id and v.organization_id = p_organization_id
      and v.state not in ('CANCELLED','NOT_PERFORMED')
      and private.is_assigned_professional(v.professional_id,v.organization_id)
  );
$$;

revoke all on function private.has_membership(uuid,text[]) from public,anon,authenticated;
revoke all on function private.is_assigned_professional(uuid,uuid) from public,anon,authenticated;
revoke all on function private.can_read_visit_clinical(uuid,uuid) from public,anon,authenticated;
revoke all on function private.has_patient_assignment(uuid,uuid) from public,anon,authenticated;
grant execute on function private.has_membership(uuid,text[]) to authenticated;
grant execute on function private.is_assigned_professional(uuid,uuid) to authenticated;
grant execute on function private.can_read_visit_clinical(uuid,uuid) to authenticated;
grant execute on function private.has_patient_assignment(uuid,uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.professionals enable row level security;
alter table public.patients enable row level security;
alter table public.visits enable row level security;
alter table public.clinical_records enable row level security;
alter table public.attendance_evidence enable row level security;
alter table public.audit_events enable row level security;

create policy "org_read_members_only" on public.organizations
for select to authenticated using (private.has_membership(id, null));
create policy "membership_read_self_only" on public.memberships
for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()) and active);
create policy "professionals_read_admin_or_self" on public.professionals
for select to authenticated
using (private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[])
  or private.is_assigned_professional(id,organization_id));
create policy "patients_read_admin_or_assigned_professional" on public.patients
for select to authenticated
using (private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[])
  or private.has_patient_assignment(id,organization_id));
create policy "visits_read_admin_or_assigned_professional" on public.visits
for select to authenticated
using (private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[])
  or private.is_assigned_professional(professional_id,organization_id));
create policy "clinical_read_assigned_professional_only" on public.clinical_records
for select to authenticated
using (private.can_read_visit_clinical(visit_id,organization_id));
create policy "attendance_read_admin_or_assigned_professional" on public.attendance_evidence
for select to authenticated
using (private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[])
  or private.can_read_visit_clinical(visit_id,organization_id));
create policy "audit_read_authorized_auditors" on public.audit_events
for select to authenticated
using (private.has_membership(organization_id,array['ADMIN','AUDITOR']::text[]));

-- Intentionally DENY ALL direct client writes (including by ADMIN).
-- Membership/user management, signature requests and scheduling mutation will
-- be implemented as audited Edge Functions/transactional RPC in a later gate.
revoke all on public.organizations,public.memberships,public.professionals,
  public.patients,public.visits,public.clinical_records,
  public.attendance_evidence,public.audit_events from public,anon,authenticated;
grant usage on schema public to authenticated;
grant select on public.organizations,public.memberships,public.professionals,
  public.patients,public.visits,public.clinical_records,
  public.attendance_evidence,public.audit_events to authenticated;

comment on table public.patients is 'Standalone home-visits patient directory. Sensitive health information: RLS mandatory.';
comment on table public.clinical_records is 'Notes readable only by assigned active professional; no direct client writes.';
comment on table public.attendance_evidence is 'Administrative electronic conformity evidence metadata, NOT a certified digital signature.';
