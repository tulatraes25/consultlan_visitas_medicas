#!/usr/bin/env node
/**
 * STAGING-01F: operator-only, independent Supabase, synthetic identities.
 * --ci: NO NETWORK, NO SECRETS (GitHub CI)
 * --check-env: validate operator declarations, NO NETWORK, no output values
 * --probe: 30 fixed read-only/negative requests, with explicit opt-ins
 *
 * SQL catalog, migration history, backups and ownership verification remain
 * mandatory separate manual gates. No credentials are written or logged.
 */
import {
  STAGING_01F_EXPECTED_REQUESTS, STAGING_01F_PHASES,
  validateIntegratedStagingEnvironment, verifyIntegratedStagingBoundaries,
} from "../src/operations/staging-integrated-policy.mjs";

async function main() {
  const args=process.argv.slice(2);
  const mode=args[0] ?? "--ci";
  if (args.length > 1 || !["--ci","--check-env","--probe"].includes(mode)) {
    throw Error("STAGING_01F_INVALID_MODE");
  }
  if (mode==="--ci") {
    if (STAGING_01F_EXPECTED_REQUESTS!==30 || STAGING_01F_PHASES.length!==3) {
      throw Error("STAGING_01F_OFFLINE_CONTRACT_CHANGED");
    }
    console.log("STAGING01F_OFFLINE_CONTRACT_PASS_REMOTE_UNVERIFIED");
    return;
  }
  const valid=validateIntegratedStagingEnvironment(process.env,{live:mode==="--probe"});
  if (!valid.ok) throw Error("STAGING_01F_CONFIG_REJECTED");
  if (mode==="--check-env") {
    console.log("STAGING01F_DECLARATIONS_ACCEPTED_REMOTE_UNVERIFIED");
    return;
  }
  await verifyIntegratedStagingBoundaries(process.env);
  console.log("STAGING01F_NETWORK_BOUNDARIES_PASS_REMOTE_SQL_AND_OWNER_AUDIT_PENDING");
}
main().catch(error=>{
  // Only controlled fixed codes. No user-provided exception, JWT, URL,
  // database response, stack, project reference, UUID or environment value.
  const code=["STAGING_01F_INVALID_MODE","STAGING_01F_OFFLINE_CONTRACT_CHANGED",
    "STAGING_01F_CONFIG_REJECTED"].includes(error?.message)
      ? error.message : "STAGING_01F_BLOCKED_OR_PROBE_FAILED";
  console.error("STAGING01F_BLOCKED:"+code);
  process.exitCode=1;
});
