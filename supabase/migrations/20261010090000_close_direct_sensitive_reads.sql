-- SEC-READ-02A: remove residual direct JWT table reads before staging.
-- All write APIs remain service-only. SECURITY DEFINER backend routines keep
-- their existing table-owner rights; no patient/clinical rows are modified.
--
-- Reason: PostgREST validates a signed access JWT but cannot by itself enforce
-- the independent auth.sessions presence check required by SEC-SESSION-01.
-- Keep precisely one temporary RLS-testing exception:
--   public.homecare_episodes SELECT to authenticated
-- for STAGING-01B's positive nonempty, cross-org RLS verifier. This exception
-- MUST be closed in SEC-READ-02B before any real patient or clinical use.
revoke select on table
  public.organizations,
  public.memberships,
  public.professionals,
  public.patients,
  public.visits,
  public.clinical_records,
  public.attendance_evidence,
  public.audit_events,
  public.homecare_care_team,
  public.homecare_care_plan_versions,
  public.homecare_plan_review_requests
from public, anon, authenticated;

comment on table public.homecare_episodes is
  'SEC-READ-02A: TEMPORARY authenticated SELECT for synthetic STAGING-01B RLS verification ONLY. Must revoke in SEC-READ-02B before any real patient.';
