-- HC-UX-04B1: service-only READ_ONLY_STRUCTURE_PREVIEW template resolver.
-- Only for the independent homecare Supabase project; no PHI, write,
-- clinical attestation, document issuance or new access to signed JWTs.
-- Edge MUST verify project Auth + live session, then inject p_actor.
create function public.api_hc_resolve_my_attendance_template(
  p_actor uuid,
  p_coverage uuid
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_template text;
  v_kind text;
begin
  if p_actor is null or p_coverage is null then
    raise exception 'HOMECARE_FORM_PREVIEW_DENIED' using errcode='42501';
  end if;

  -- service_role bypasses table RLS: authorize from relational facts HERE.
  -- Reject draft/suspended/discharged episodes, unapproved/out-of-window
  -- plan versions, revoked staff/team/org and cancelled/completed coverages.
  -- The client must NEVER supply organization, professional, episode,
  -- specialty, plan or template identifiers to this resolver.
  select
    case
      when p.specialty in ('MEDICINA','Medicina')
        then 'MEDICAL_ATTENDANCE'
      when p.specialty in (
        'ENFERMERIA','ENFERMERÍA','Enfermería','Enfermeria',
        'ENFERMERIA/CUIDADORAS','Enfermería/cuidadoras',
        'CUIDADOR','CUIDADORA','CUIDADORES','CUIDADORAS',
        'Cuidador','Cuidadora','Cuidadoras'
      ) then 'NURSING_CAREGIVER_ATTENDANCE'
      when p.specialty in ('KINESIOLOGIA','KINESIOLOGÍA','Kinesiología','Kinesiologia')
        then 'PHYSIOTHERAPY_ATTENDANCE'
      when p.specialty in ('FONOAUDIOLOGIA','FONOAUDIOLOGÍA','Fonoaudiología','Fonoaudiologia')
        then 'SPEECH_ATTENDANCE'
      when p.specialty in ('TERAPIA OCUPACIONAL','Terapia ocupacional')
        then 'OCCUPATIONAL_THERAPY_ATTENDANCE'
      when p.specialty in ('NUTRICION','NUTRICIÓN','Nutrición','Nutricion')
        then 'NUTRITION_ATTENDANCE'
      else null
    end,
    c.service_kind
  into v_template,v_kind
  from public.homecare_coverage_assignments c
  join public.professionals p
    on p.id=c.professional_id and p.organization_id=c.organization_id
  join public.memberships m
    on m.organization_id=c.organization_id and m.user_id=p.user_id
  join public.organizations org on org.id=c.organization_id
  join public.homecare_episodes e
    on e.id=c.episode_id and e.organization_id=c.organization_id
    and e.patient_id=c.patient_id
  join public.homecare_care_team team
    on team.episode_id=c.episode_id and team.organization_id=c.organization_id
    and team.professional_id=c.professional_id
  join public.homecare_care_plan_versions plan
    on plan.episode_id=c.episode_id and plan.organization_id=c.organization_id
    and plan.version_number=c.care_plan_version
  where c.id=p_coverage
    and p.user_id=p_actor
    and p.active and m.active and m.app_role='PROFESSIONAL' and org.active
    and team.active and team.ended_at is null
    and e.episode_state='ACTIVE'
    and e.activated_at is not null
    and e.activated_at<=c.scheduled_start
    and plan.plan_state='APPROVED'
    and plan.approved_by_user_id is not null
    and plan.approved_at is not null
    and plan.valid_from is not null
    and plan.valid_from<=c.scheduled_start
    and (plan.valid_until is null or plan.valid_until>=c.scheduled_end)
    and c.coverage_state in ('ASSIGNED','ACTIVE');

  if v_template is null
    or (v_kind='SHIFT' and v_template<>'NURSING_CAREGIVER_ATTENDANCE')
  then
    -- Same code for not found, other tenant, wrong actor, unsupported
    -- specialty and forbidden shift. Do not reveal any patient or staff ID.
    raise exception 'HOMECARE_FORM_PREVIEW_DENIED' using errcode='42501';
  end if;

  return pg_catalog.jsonb_build_object(
    'templateId',v_template,
    'mode','READ_ONLY_STRUCTURE_PREVIEW'
  );
end;
$$;

revoke all on function public.api_hc_resolve_my_attendance_template(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.api_hc_resolve_my_attendance_template(uuid,uuid)
  to service_role;

comment on function public.api_hc_resolve_my_attendance_template(uuid,uuid) is
  'HC-UX-04B1: Edge-only verified actor + coverage; active episode, team, professional, plan and membership; fixed six attendance templates; preview-only, never clinical authorization';
