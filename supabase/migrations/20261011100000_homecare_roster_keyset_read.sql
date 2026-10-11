-- HC-READ-02: standalone, server-only keyset pagination for home-care coverage.
-- Immutable migration: does not edit the 11 preceding migrations or
-- enable clinical approval. All identities come from verified Edge Auth.
-- Windows refer to start instants; long shifts overlapping their START
-- boundary are INCLUDED using scheduled_end > p_window_start.
create index if not exists coverage_professional_start_id
  on public.homecare_coverage_assignments (professional_id, scheduled_start, id);

create function public.api_hc_list_my_coverages_page(
  p_actor uuid,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_after_start timestamptz default null,
  p_after_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_rows jsonb; v_has_more boolean; v_cursor jsonb;
begin
  -- Fail authorization BEFORE retrieving even the count of coverages.
  if p_actor is null or not exists (
    select 1 from public.professionals p
    join public.memberships m
      on m.organization_id=p.organization_id and m.user_id=p.user_id
    join public.organizations o on o.id=p.organization_id
    where p.user_id=p_actor and p.active and m.active
      and m.app_role='PROFESSIONAL' and o.active
  ) then
    raise exception 'HOMECARE_PAGE_ACCESS_DENIED' using errcode='42501';
  end if;

  if p_window_start is null or p_window_end is null
    or p_window_end <= p_window_start
    or p_window_start < '2000-01-01T00:00:00Z'::timestamptz
    or p_window_end > '2100-01-01T00:00:00Z'::timestamptz
    or p_window_end > p_window_start + interval '32 days'
    or ((p_after_start is null) <> (p_after_id is null))
    or (p_after_start is not null and p_after_start >= p_window_end)
  then
    raise exception 'HOMECARE_PAGE_INVALID_WINDOW_OR_CURSOR' using errcode='22023';
  end if;

  with first_101 as materialized (
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
      and a.scheduled_end > p_window_start
      and a.scheduled_start < p_window_end
      and (p_after_start is null
        or (a.scheduled_start,a.id) > (p_after_start,p_after_id))
    order by a.scheduled_start, a.id
    limit 101
  ), page_rows as materialized (
    select * from first_101 order by scheduled_start, id limit 100
  )
  select
    coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id',x.id,'episode_id',x.episode_id,
        'service_kind',x.service_kind,'coverage_state',x.coverage_state,
        'scheduled_start',x.scheduled_start,'scheduled_end',x.scheduled_end
      ) order by x.scheduled_start,x.id
    ) from page_rows x), '[]'::jsonb),
    (select count(*)>100 from first_101),
    case when (select count(*)>100 from first_101) then
      (select pg_catalog.jsonb_build_object(
        'scheduled_start',last.scheduled_start,'id',last.id
      ) from page_rows last
      order by last.scheduled_start desc,last.id desc limit 1)
    else null end
  into v_rows,v_has_more,v_cursor;

  return pg_catalog.jsonb_build_object(
    'rows',v_rows,'hasMore',v_has_more,'nextCursor',v_cursor
  );
end;
$$;

revoke all on function public.api_hc_list_my_coverages_page(
  uuid,timestamptz,timestamptz,timestamptz,uuid
) from public,anon,authenticated;
grant execute on function public.api_hc_list_my_coverages_page(
  uuid,timestamptz,timestamptz,timestamptz,uuid
) to service_role;

comment on function public.api_hc_list_my_coverages_page(
  uuid,timestamptz,timestamptz,timestamptz,uuid
) is
  'HC-READ-02: service-only, authenticated live-session Edge, 100-row keyset windowed roster; no clinical fields; no cross-request snapshot guarantee';
