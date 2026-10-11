-- CI-ONLY fake Supabase CLI history. This is NOT a migration and MUST NOT
-- ever be executed on managed Supabase or a database with actual patients.
\set ON_ERROR_STOP on
begin;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text not null primary key
);
insert into supabase_migrations.schema_migrations(version) values
  ('20261010000000'),
  ('20261010010000'),
  ('20261010020000'),
  ('20261010030000'),
  ('20261010040000'),
  ('20261010050000'),
  ('20261010060000'),
  ('20261010070000'),
  ('20261010080000'),
  ('20261010090000'),
  ('20261010100000');
commit;
