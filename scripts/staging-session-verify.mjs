#!/usr/bin/env node
/**
 * STAGING-01C — No network by default. The optional live session challenge
 * uses only malformed, non-mutating requests to a separately approved staging.
 */
import {
  validateSessionStagingEnvironment, verifySyntheticSessionRevocation,
} from "../src/operations/staging-session-policy.mjs";
import { StagingGateError } from "../src/operations/staging-policy.mjs";

async function main() {
  const mode = process.argv[2] ?? "--ci";
  if (!["--ci", "--check-env", "--probe"].includes(mode) || process.argv.length > 3) {
    throw new StagingGateError("INVALID_SESSION_PREFLIGHT_MODE");
  }
  if (mode === "--ci") {
    console.log("STAGING01C_OFFLINE_READY_REMOTE_NOT_VERIFIED");
    return;
  }
  if (!validateSessionStagingEnvironment(process.env, { live: mode === "--probe" }).ok) {
    throw new StagingGateError("STAGING_SESSION_CONFIG_REJECTED");
  }
  if (mode === "--check-env") {
    console.log("STAGING01C_SYNTHETIC_ENV_DECLARATIONS_ACCEPTED_NOT_VERIFIED");
    return;
  }
  await verifySyntheticSessionRevocation(process.env);
  console.log("STAGING01C_READONLY_SESSION_PROBE_PASS_PENDING_INDEPENDENT_AUDIT");
}

main().catch(error => {
  // Fixed error code only; no origin, user, JWT, stack or upstream response.
  const code = error instanceof StagingGateError ? error.code : "STAGING_SESSION_VERIFICATION_FAILED";
  console.error("STAGING01C_BLOCKED:" + code);
  process.exitCode = 1;
});
