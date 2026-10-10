#!/usr/bin/env node
/**
 * STAGING-01A: offline by default. No database writes, no service keys,
 * no login, no user records, no CLI linking or Supabase deploys.
 */
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import {
  REQUIRED_MIGRATIONS, checkStagingSource,
  validateStagingEnvironment, negativeStagingProbe, StagingGateError,
} from "../src/operations/staging-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFile(resolve(root, path), "utf8");

async function inspectOffline() {
  const [config, edgeHandler, revokeMigration] = await Promise.all([
    read("supabase/config.toml"),
    read("supabase/functions/visits/handler.ts"),
    read("supabase/migrations/20261010060000_revoke_legacy_clinical_rpc.sql"),
  ]);
  for (const migration of REQUIRED_MIGRATIONS) {
    await access(resolve(root, "supabase/migrations", migration));
  }
  const inspection = checkStagingSource({ config, edgeHandler, revokeMigration });
  if (!inspection.ok) throw new StagingGateError(inspection.issues[0]);
}

async function main() {
  const mode = process.argv[2] ?? "--ci";
  if (!["--ci", "--check-env", "--probe"].includes(mode) || process.argv.length > 3) {
    throw new StagingGateError("INVALID_PREFLIGHT_MODE");
  }
  await inspectOffline();
  if (mode === "--ci") {
    console.log("STAGING01A_REPOSITORY_OFFLINE_PASS");
    return;
  }
  const environment = validateStagingEnvironment(process.env, { live: mode === "--probe" });
  if (!environment.ok) {
    // A fixed code only: never echo project refs, variables or tokens.
    throw new StagingGateError("STAGING_CONFIG_REJECTED");
  }
  if (mode === "--check-env") {
    console.log("STAGING01A_ENV_DECLARATIONS_ACCEPTED_NOT_INDEPENDENTLY_VERIFIED");
    return;
  }
  await negativeStagingProbe(process.env);
  console.log("STAGING01A_NEGATIVE_PROBES_PASS_NOT_RLS_CERTIFICATION");
}

main().catch(error => {
  // Never print an upstream error, URL, SQL, secret, JWT, or HTTP response.
  const code = error instanceof StagingGateError ? error.code : "STAGING_PREFLIGHT_FAILED";
  console.error("STAGING01A_BLOCKED:" + code);
  process.exitCode = 1;
});
