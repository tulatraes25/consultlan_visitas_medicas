#!/usr/bin/env node
/**
 * STAGING-01B — separate, read-only end-to-end RLS verifier.
 * No network unless --probe AND operator opt-in; no JWT logging, no writes.
 */
import { validateRlsStagingEnvironment, verifySyntheticCrossTenantRls } from
  "../src/operations/staging-rls-policy.mjs";
import { StagingGateError } from "../src/operations/staging-policy.mjs";

async function main() {
  const mode = process.argv[2] ?? "--ci";
  if (!["--ci", "--check-env", "--probe"].includes(mode) || process.argv.length > 3) {
    throw new StagingGateError("INVALID_RLS_PREFLIGHT_MODE");
  }
  if (mode === "--ci") {
    // Actual negative/positive transport tests are in test/staging-rls-policy.test.mjs.
    // This mode deliberately has no network or environment dependencies.
    console.log("STAGING01B_OFFLINE_MODE_READY_NO_REMOTE_CLAIM");
    return;
  }
  if (!validateRlsStagingEnvironment(process.env, { live: mode === "--probe" }).ok) {
    throw new StagingGateError("STAGING_RLS_CONFIG_REJECTED");
  }
  if (mode === "--check-env") {
    console.log("STAGING01B_ENV_DECLARATIONS_OK_NOT_RLS_CERTIFICATION");
    return;
  }
  await verifySyntheticCrossTenantRls(process.env);
  console.log("STAGING01B_TWO_TENANT_READONLY_RLS_PROBE_PASS_REQUIRES_INDEPENDENT_AUDIT");
}

main().catch(error => {
  // Do not include exception detail or stack containing potentially sensitive data.
  const code = error instanceof StagingGateError ? error.code : "STAGING_RLS_VERIFICATION_FAILED";
  console.error("STAGING01B_BLOCKED:" + code);
  process.exitCode = 1;
});
