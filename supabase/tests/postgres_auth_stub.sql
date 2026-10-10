-- Synthetic compatibility shim for a vanilla PostgreSQL 16 CI service.
-- This file is NOT a Supabase migration: Supabase already supplies auth.users,
-- auth.uid(), authenticated and anon roles.
\set ON_ERROR_STOP on
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
