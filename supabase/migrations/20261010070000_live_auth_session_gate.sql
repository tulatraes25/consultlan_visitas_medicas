-- SEC-SESSION-01: require a live Supabase Auth session for backend commands.
-- PostgreSQL CI creates auth.sessions synthetically; on real Supabase this
-- is a managed Auth table. Never create or modify Auth sessions in migrations.
create function public.api_is_live_session(p_user uuid,p_session uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user is not null and p_session is not null and exists (
    select 1 from auth.sessions s
    where s.id = p_session and s.user_id = p_user
  );
$$;

-- This service-only RPC checks *identity session existence* and does NOT
-- grant permission to any clinical or administrative act by itself.
revoke all on function public.api_is_live_session(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.api_is_live_session(uuid,uuid)
  to service_role;

comment on function public.api_is_live_session(uuid,uuid) is
  'SEC-SESSION-01: true only for a current Supabase Auth session of this exact user. Backend only; no clinical authorization.';
