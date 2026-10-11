#!/bin/sh
# STAGING-01E CI-ONLY. May mutate ONLY disposable local PostgreSQL fixtures.
# It must NEVER be run against Supabase hosted or a non-CI database.
set -eu

if [ "${GITHUB_ACTIONS:-}" != "true" ] ||
   [ "${PGDATABASE:-}" != "visits_synthetic_test" ] ||
   [ "${PGHOST:-}" != "127.0.0.1" ] ||
   [ "${PGPORT:-}" != "5432" ] ||
   [ "${PGUSER:-}" != "postgres" ]; then
  printf '%s\n' "STAGING01E_BLOCKED:CI_ONLY_DISPOSABLE_DATABASE_REQUIRED" >&2
  exit 1
fi

ledger="supabase_migrations.schema_migrations"
check="supabase/staging/01e_migration_history_readonly.sql"

psql -v ON_ERROR_STOP=1 -f supabase/tests/ci_only_migration_history_stub.sql >/dev/null
psql -v ON_ERROR_STOP=1 -f "$check" >/dev/null

expect_rejected() {
  if psql -v ON_ERROR_STOP=1 -f "$check" >/dev/null 2>&1; then
    printf '%s\n' "STAGING01E_TEST_FAILED:UNSAFE_HISTORY_ACCEPTED" >&2
    exit 1
  fi
}

# One unexpected version: no false PASS because expected versions are present.
psql -v ON_ERROR_STOP=1 -c "insert into $ledger(version) values ('20990101000000')" >/dev/null
expect_rejected
psql -v ON_ERROR_STOP=1 -c "delete from $ledger where version='20990101000000'" >/dev/null

# A missing version, even with the other ten still applied, MUST fail.
psql -v ON_ERROR_STOP=1 -c "delete from $ledger where version='20261010060000'" >/dev/null
expect_rejected
psql -v ON_ERROR_STOP=1 -c "insert into $ledger(version) values ('20261010060000')" >/dev/null

# An unauthorized replacement with the same number of versions MUST fail.
psql -v ON_ERROR_STOP=1 -c "update $ledger set version='20261010061000' where version='20261010060000'" >/dev/null
expect_rejected
psql -v ON_ERROR_STOP=1 -c "update $ledger set version='20261010060000' where version='20261010061000'" >/dev/null

# Restore and prove 11/11 exact match, with a constant public-safe marker.
psql -v ON_ERROR_STOP=1 -f "$check" >/dev/null
printf '%s\n' "STAGING01E_CI_HISTORY_POSITIVE_AND_THREE_NEGATIVE_TESTS_PASS"
