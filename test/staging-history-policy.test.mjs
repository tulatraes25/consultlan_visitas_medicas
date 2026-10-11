import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { REQUIRED_MIGRATIONS } from "../src/operations/staging-policy.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const migrationSql=readFileSync(resolve(root,"supabase/staging/01e_migration_history_readonly.sql"),"utf8");
const fixture=readFileSync(resolve(root,"supabase/tests/ci_only_migration_history_stub.sql"),"utf8");
const ciShell=readFileSync(resolve(root,"scripts/ci-staging-history-verify.sh"),"utf8");
const versionPattern=/'(\d{14})'/g;
function versions(fragment) {
  return [...fragment.matchAll(versionPattern)].map(m=>m[1]);
}

test("STAGING-01E exact expected 11 migrations derive from GitHub's current inventory",()=>{
  const expected=REQUIRED_MIGRATIONS.map(m=>m.slice(0,14));
  assert.equal(expected.length,11);
  const section=migrationSql.split("expected constant text[] := ARRAY[")[1]
    ?.split("];")[0];
  assert.ok(section,"version list present");
  assert.deepEqual(versions(section),expected);
  assert.deepEqual(versions(fixture),expected);
  assert.equal(new Set(expected).size,expected.length);
  assert.deepEqual([...expected].sort(),expected);
});

test("STAGING-01E SQL is a read-only, exact-match guard, not a migrator",()=>{
  assert.match(migrationSql,/BEGIN TRANSACTION READ ONLY;/);
  assert.match(migrationSql,/pg_catalog\.to_regclass\('supabase_migrations\.schema_migrations'\)/);
  assert.match(migrationSql,/observed is distinct from expected/);
  assert.match(migrationSql,/STAGING01E_MIGRATION_HISTORY_MISMATCH/);
  assert.match(migrationSql,/COMMIT;/);
  assert.doesNotMatch(migrationSql,/\b(?:insert\s+into|delete\s+from|update\s+supabase_migrations|drop\s+table|truncate\s+table|create\s+table)\b/i);
  assert.doesNotMatch(migrationSql,/\b(?:patients|clinical_records|auth\.users|auth\.sessions)\b/i);
});

test("STAGING-01E negative harness cannot run without disposable GitHub Postgres",()=>{
  assert.match(ciShell,/GITHUB_ACTIONS/);
  assert.match(ciShell,/visits_synthetic_test/);
  assert.match(ciShell,/127\.0\.0\.1/);
  const r=spawnSync("sh",["scripts/ci-staging-history-verify.sh"],{
    cwd:root,encoding:"utf8",timeout:5000,
    env:{PATH:process.env.PATH, HOME:process.env.HOME},
  });
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/STAGING01E_BLOCKED:CI_ONLY_DISPOSABLE_DATABASE_REQUIRED/);
});

test("STAGING-01E CI harness must challenge extra, missing and substituted versions",()=>{
  assert.match(ciShell,/20990101000000/);
  assert.match(ciShell,/delete from \$ledger where version='20261010060000'/);
  assert.match(ciShell,/update \$ledger set version='20261010061000'/);
  assert.match(ciShell,/expect_rejected/g);
  assert.match(ciShell,/STAGING01E_CI_HISTORY_POSITIVE_AND_THREE_NEGATIVE_TESTS_PASS/);
});
