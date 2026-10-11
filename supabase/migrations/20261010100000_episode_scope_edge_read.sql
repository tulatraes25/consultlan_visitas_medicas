-- SEC-READ-02B: remove the final direct SELECT granted to JWT callers.
-- STAGING-01B now uses a server-scoped, session-verified Edge probe instead
-- of reading episode rows via PostgREST.
revoke select on table public.homecare_episodes
  from public, anon, authenticated;

-- The caller may supply only a UUID of a synthetic/known episode. The actor
-- comes from /auth/v1/user plus a LIVE auth.sessions check inside Edge.
-- This function deliberately returns NO patient/name/clinical fields.
-- service_role bypasses RLS, so access is explicitly reconstructed here.
create function public.api_hc_episode_scope(p_actor uuid, p_episode uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if p_actor is null or p_episode is null or not exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id=m.organization_id
    where m.user_id=p_actor and m.active and o.active
      and (
        m.app_role in ('ADMIN','COORDINATOR')
        or (m.app_role='PROFESSIONAL' and exists (
          select 1 from public.professionals p
          where p.organization_id=m.organization_id
            and p.user_id=p_actor and p.active
        ))
      )
  ) then
    raise exception 'EPISODE_SCOPE_ACCESS_DENIED' using errcode='42501';
  end if;

  select pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('id',e.id,'organization_id',e.organization_id)
  ) into v_result
  from public.homecare_episodes e
  join public.organizations o on o.id=e.organization_id and o.active
  where e.id=p_episode and (
    exists (
      select 1 from public.memberships m
      where m.organization_id=e.organization_id and m.user_id=p_actor
        and m.active and m.app_role in ('ADMIN','COORDINATOR')
    )
    or (
      e.episode_state in ('ACTIVE','SUSPENDED')
      and exists (
        select 1
        from public.homecare_care_team t
        join public.professionals p
          on p.id=t.professional_id and p.organization_id=t.organization_id
        join public.memberships m
          on m.organization_id=p.organization_id and m.user_id=p.user_id
        where t.episode_id=e.id and t.organization_id=e.organization_id
          and p.user_id=p_actor
          and t.active and t.ended_at is null and p.active
          and m.active and m.app_role='PROFESSIONAL'
      )
    )
  );

  return pg_catalog.coalesce(v_result,'[]'::jsonb);
end;
$$;

revoke all on function public.api_hc_episode_scope(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.api_hc_episode_scope(uuid,uuid)
  to service_role;

comment on table public.homecare_episodes is
  'SEC-READ-02B: no JWT direct SELECT. Read scope only by server-side Edge with verified Auth session.';
comment on function public.api_hc_episode_scope(uuid,uuid) is
  'SEC-READ-02B: server-only two-field episode scope probe; actor injected after Auth+live session; never exposes patient/clinical content';
