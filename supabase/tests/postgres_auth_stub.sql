-- Synthetic compatibility shim for a vanilla PostgreSQL 16 CI service.
-- This file is NOT a Supabase migration: Supabase already supplies auth.users,
-- auth.uid(), authenticated and anon roles.
\set ON_ERROR_STOP on
create role authenticated nologin;
create role anon nologin;
-- Simulates the trusted backend role provided by Supabase, never a mobile login.
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to authenticated;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant execute on function auth.uid() to authenticated;
