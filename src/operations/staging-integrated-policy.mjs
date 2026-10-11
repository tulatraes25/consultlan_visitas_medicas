/**
 * STAGING-01F: one guarded, non-mutating run over one independently approved
 * Supabase STAGING project and a linked synthetic identity cohort.
 *
 * Never provisions accounts, runs SQL, writes rows, calls allowed mutations,
 * captures tokens, or claims hosted project ownership/deployment certification.
 */
import { validateStagingEnvironment, negativeStagingProbe, StagingGateError } from "./staging-policy.mjs";
import { validateRlsStagingEnvironment, verifySyntheticCrossTenantRls } from "./staging-rls-policy.mjs";
import { validateSessionStagingEnvironment, verifySyntheticSessionRevocation } from "./staging-session-policy.mjs";

const v = (env, key) => typeof env?.[key] === "string" ? env[key].trim() : "";

export const STAGING_01F_EXPECTED_REQUESTS = 30;
export const STAGING_01F_PHASES = Object.freeze([
  "STAGING_01A_NEGATIVE_UNAUTHENTICATED",
  "STAGING_01B_TWO_ORGANIZATIONS_EDGE_AND_DIRECT_TABLE_DENIAL",
  "STAGING_01C_LIVE_VS_REVOKED_AUTH_SESSION",
]);

/**
 * Cohort cross-binding matters: a successful JWT RLS probe from user A and
 * a successful session-revocation probe from some other actor do NOT prove
 * that user A's own live session is enforced by the same Edge.
 *
 * The same unexpired USER A token is used for 01B and 01C live probes, and
 * the same expired JWT is used for both checks. Tokens are compared only
 * in memory; they are never returned or printed.
 */
export function validateIntegratedStagingEnvironment(env, { live = false } = {}) {
  if (!env || typeof env !== "object") {
    return {ok:false,issues:["STAGING_01F_ENVIRONMENT_MISSING"]};
  }
  const issues = [
    ...validateStagingEnvironment(env,{live}).issues,
    ...validateRlsStagingEnvironment(env,{live}).issues,
    ...validateSessionStagingEnvironment(env,{live}).issues,
  ];
  if (!v(env,"STAGING_USER_A_ID") ||
    v(env,"STAGING_USER_A_ID").toLowerCase() !==
      v(env,"STAGING_SESSION_USER_ID").toLowerCase()) {
    issues.push("STAGING_01F_SESSION_ACTOR_NOT_SAME_AS_TENANT_A");
  }
  if (!v(env,"STAGING_USER_A_JWT") ||
    v(env,"STAGING_USER_A_JWT") !== v(env,"STAGING_SESSION_ACTIVE_JWT")) {
    issues.push("STAGING_01F_ACTIVE_TOKEN_NOT_SHARED");
  }
  if (!v(env,"STAGING_EXPIRED_USER_JWT") ||
    v(env,"STAGING_EXPIRED_USER_JWT") !== v(env,"STAGING_SESSION_EXPIRED_JWT")) {
    issues.push("STAGING_01F_EXPIRED_TOKEN_NOT_SHARED");
  }
  if (v(env,"STAGING_OPERATOR_PROJECT_IDENTITY_VERIFIED") !== "YES") {
    issues.push("STAGING_01F_PROJECT_IDENTITY_DECLARATION_REQUIRED");
  }
  return {ok:issues.length===0,issues:[...new Set(issues)]};
}

/**
 * A single transport is used for every phase; no changes of target or
 * credential environment between checks. Fail on first unsuccessful probe.
 *
 * A successful response is NOT evidence of owner/region, remote SQL ledger,
 * backup restoration, clinical authorization or regulatory compliance.
 */
export async function verifyIntegratedStagingBoundaries(env, request = fetch) {
  const valid = validateIntegratedStagingEnvironment(env,{live:true});
  if (!valid.ok) throw new StagingGateError("STAGING_01F_CONFIG_REJECTED");
  // Capture env once for all phases, so changes to the caller's environment
  // object during the asynchronous process cannot alter the target/token.
  const lockedEnv = Object.freeze({...env});
  await negativeStagingProbe(lockedEnv,request);
  await verifySyntheticCrossTenantRls(lockedEnv,request);
  await verifySyntheticSessionRevocation(lockedEnv,request);
  return Object.freeze({
    result:"STAGING_01F_NETWORK_BOUNDARIES_PASS_NOT_CERTIFICATION",
    steps:STAGING_01F_PHASES,
    expectedRequestCount:STAGING_01F_EXPECTED_REQUESTS,
    identityCrossBound:"TENANT_A_ACTIVE_AND_EXPIRED_TOKENS_SHARED",
    remoteSqlCatalogVerified:false,
    remoteMigrationHistoryVerified:false,
    institutionalProjectOwnershipVerified:false,
    clinicallyReady:false,
  });
}
