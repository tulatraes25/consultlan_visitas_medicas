-- HC-02C1B: plan-review REQUESTS ONLY. No clinical approval, signatures,
-- medical orders, episode activation, prescription or patient information.
-- Source is standalone Supabase, unrelated to CONSULTLAN ambulatory patients.
create table public.homecare_plan_review_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  episode_id uuid not null,
  plan_version integer not null check (plan_version >= 1),
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  request_key uuid not null,
  review_state text not null default 'PENDING'
    constraint homecare_plan_review_pending_only check (review_state = 'PENDING'),
  requested_at timestamptz not null default now(),
  constraint hc_review_episode_scope foreign key (episode_id,organization_id)
    references public.homecare_episodes(id,organization_id) on delete restrict,
  constraint hc_review_exact_plan foreign key (episode_id,plan_version)
    references public.homecare_care_plan_versions(episode_id,version_number) on delete restrict,
  constraint hc_review_idempotency unique (organization_id,request_key),
  constraint hc_review_one_per_version unique (episode_id,plan_version)
);
create index hc_review_queue_by_org
  on public.homecare_plan_review_requests (organization_id,requested_at desc);

alter table public.homecare_plan_review_requests enable row level security;
create policy hc_review_metadata_admin_read
  on public.homecare_plan_review_requests for select to authenticated
  using (private.has_membership(organization_id,array['ADMIN','COORDINATOR']::text[]));

-- This table deliberately has no approval transition and no direct write grant,
-- including for service_role (which otherwise bypasses RLS).
revoke all on table public.homecare_plan_review_requests
  from public,anon,authenticated,service_role;
grant select on table public.homecare_plan_review_requests
  to authenticated,service_role;

create function public.api_hc_request_plan_review(
  p_actor uuid,p_org uuid,p_episode uuid,p_version integer,p_request_key uuid
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_existing public.homecare_plan_review_requests%rowtype;
begin
  perform private.assert_actor_role(p_actor,p_org,array['ADMIN','COORDINATOR']::text[]);
  if p_episode is null or p_version is null or p_version < 1
    or p_request_key is null then
    raise exception 'INVALID_REVIEW_REQUEST' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_org::text||'plan-review'||p_request_key::text,0));
  select * into v_existing from public.homecare_plan_review_requests
    where organization_id=p_org and request_key=p_request_key;
  if found then
    if v_existing.episode_id is distinct from p_episode
      or v_existing.plan_version is distinct from p_version
      or v_existing.requested_by_user_id is distinct from p_actor then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505';
    end if;
    return v_existing.id;
  end if;
  -- Both episode and plan must still be administrative DRAFT. This is not
  -- evidence of medical authorization; no contents of a plan are accepted.
  perform 1 from public.homecare_episodes e
    join public.homecare_care_plan_versions p
      on p.episode_id=e.id and p.organization_id=e.organization_id
    where e.id=p_episode and e.organization_id=p_org
      and p.version_number=p_version
      and e.episode_state='DRAFT' and p.plan_state='DRAFT'
    for update of e,p;
  if not found then
    raise exception 'REVIEW_REQUIRES_DRAFT_PLAN_AND_EPISODE' using errcode='42501';
  end if;
  insert into public.homecare_plan_review_requests(
    organization_id,episode_id,plan_version,requested_by_user_id,request_key
  ) values(p_org,p_episode,p_version,p_actor,p_request_key)
    returning id into v_id;
  insert into public.audit_events(
    organization_id,actor_user_id,event_type,resource_id,safe_metadata
  ) values(p_org,p_actor,'HC_PLAN_REVIEW_REQUESTED',v_id,
    pg_catalog.jsonb_build_object('plan_version',p_version));
  return v_id;
end; $$;

revoke all on function public.api_hc_request_plan_review(uuid,uuid,uuid,integer,uuid)
  from public,anon,authenticated;
grant execute on function public.api_hc_request_plan_review(uuid,uuid,uuid,integer,uuid)
  to service_role;

comment on table public.homecare_plan_review_requests is
  'Pending logistics requests only: NOT medical review approval, consent or signature';
comment on function public.api_hc_request_plan_review(uuid,uuid,uuid,integer,uuid)
  is 'Records an idempotent review request for draft plan metadata; NO activation or clinical approval';
