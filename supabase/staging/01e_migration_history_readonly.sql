-- STAGING-01E: read-only proof of the exact CLI migration history.
-- Run ONLY against independently identified, freshly provisioned Supabase
-- staging after explicit authorization and a supervised migration apply.
-- This query NEVER installs, repairs, deletes or modifies migrations.
-- It reads only supabase_migrations.schema_migrations.version metadata.
--
-- DO NOT use the synthetic fixture from supabase/tests/ on hosted Supabase.
\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

DO $$
declare
  expected constant text[] := ARRAY[
    '20261010000000',
    '20261010010000',
    '20261010020000',
    '20261010030000',
    '20261010040000',
    '20261010050000',
    '20261010060000',
    '20261010070000',
    '20261010080000',
    '20261010090000',
    '20261010100000',
    '20261011100000',
    '20261011110000'
  ];
  observed text[];
  version_column_type oid;
begin
  if pg_catalog.to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'STAGING01E_MIGRATION_LEDGER_MISSING';
  end if;

  select a.atttypid into version_column_type
    from pg_catalog.pg_attribute a
   where a.attrelid = pg_catalog.to_regclass(
       'supabase_migrations.schema_migrations')
     and a.attname='version'
     and a.attnum>0 and not a.attisdropped;
  if version_column_type is distinct from 'text'::pg_catalog.regtype
      and version_column_type is distinct from 'character varying'::pg_catalog.regtype then
    raise exception 'STAGING01E_MIGRATION_LEDGER_SHAPE_INVALID';
  end if;

  -- Exact set + count + order, including a strict failure for unexpected
  -- extra migrations or histories that only partially match the repository.
  select pg_catalog.array_agg(version::text order by version::text)
    into observed
    from supabase_migrations.schema_migrations;

  if observed is distinct from expected then
    raise exception 'STAGING01E_MIGRATION_HISTORY_MISMATCH';
  end if;
end $$;

COMMIT;
select 'STAGING01E_EXACT_13_MIGRATION_VERSIONS_MATCH_NOT_DEPLOYMENT_CERTIFICATE' as result;
