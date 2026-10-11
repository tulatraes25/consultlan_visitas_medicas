-- HC-READ-01: service-only minimal coverage metadata read.
-- Migration for a NEW, independent Supabase project; no clinical data, inserts
-- or changes to Auth are made here. Edge must verify Auth and live session first.
--
-- Earlier HC-02A granted direct SELECT to authenticated for RLS exploration.
-- A signed but revoked-session JWT may remain usable through PostgREST until
-- expiration, bypassing the separate session verifier in Edge.
-- Block direct client SELECT on the coverage and handover metadata tables.
revoke select on table public.homecare_coverage_assignments,
  public.homecare_shift_handovers from public, anon, authenticated;

-- The Edge runtime uses the privileged service key internally. It may execute
-- this exact RPC, but never receives an arbitrary SQL name from a mobile user.
-- The function owner checks organization, membership, professional and case
-- explicitly: service_role bypasses RLS, so reliance on RLS here is incorrect.
create function public.api_hc_list_my_coverages(p_actor uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_rows jsonb;
begin
  -- The caller identity is injected by Edge AFTER Auth + active-session
  -- verification. Only an active, non-anonymous professional may use this
  -- roster endpoint; administrative reporting is a separate future gate.
  if p_actor is null or not exists (
    select 1
    from public.professionals p
    join public.memberships m
      on m.organization_id=p.organization_id and m.user_id=p.user_id
    join public.organizations o on o.id=p.organization_id
    where p.user_id=p_actor
      and p.active and m.active and m.app_role='PROFESSIONAL' and o.active
  ) then
    raise exception 'HOMECARE_ROSTER_ACCESS_DENIED' using errcode='42501';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', c.id,
        'episode_id', c.episode_id,
        'service_kind', c.service_kind,
        'coverage_state', c.coverage_state,
        'scheduled_start', c.scheduled_start,
        'scheduled_end', c.scheduled_end
      ) order by c.scheduled_start, c.id
    ),
    '[]'::jsonb
  ) into v_rows
  from (
    select a.id, a.episode_id, a.service_kind, a.coverage_state,
      a.scheduled_start, a.scheduled_end
    from public.homecare_coverage_assignments a
    join public.professionals p
      on p.id=a.professional_id and p.organization_id=a.organization_id
    join public.memberships m
      on m.user_id=p.user_id and m.organization_id=a.organization_id
    join public.organizations o on o.id=a.organization_id
    join public.homecare_episodes e
      on e.id=a.episode_id and e.organization_id=a.organization_id
      and e.patient_id=a.patient_id
    join public.homecare_care_team t
      on t.episode_id=a.episode_id and t.organization_id=a.organization_id
      and t.professional_id=a.professional_id
    where p.user_id=p_actor
      and p.active and m.active and m.app_role='PROFESSIONAL'
      and o.active and t.active and t.ended_at is null
      and e.episode_state in ('ACTIVE','SUSPENDED')
    order by a.scheduled_start asc, a.id asc
    limit 100
  ) c;

  return v_rows;
end;
$$;

revoke all on function public.api_hc_list_my_coverages(uuid)
  from public, anon, authenticated;
grant execute on function public.api_hc_list_my_coverages(uuid)
  to service_role;

comment on function public.api_hc_list_my_coverages(uuid) is
  'HC-READ-01: service-only six-field professional roster, max 100; Auth and live session verified by Edge; no patient or clinical payload';
