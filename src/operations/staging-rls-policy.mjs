/**
 * STAGING-01B / SEC-READ-02B: Edge-scoped, two-organization, nonempty
 * episode verification + explicit denial of direct PostgREST SELECT.
 * All fixtures are synthetic. No SQL writes, patient names or content.
 * Requires operator-approved, fully isolated Supabase staging to use network.
 */
import { validateStagingEnvironment, StagingGateError } from "./staging-policy.mjs";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const USER_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const SCOPE_ACTION = "inspectMyHomecareEpisodeScope";
export const DIRECT_READ_TABLES = Object.freeze([
  "organizations", "memberships", "professionals", "patients", "visits",
  "clinical_records", "attendance_evidence", "audit_events",
  "homecare_episodes", "homecare_care_team", "homecare_care_plan_versions",
  "homecare_plan_review_requests", "homecare_coverage_assignments",
  "homecare_shift_handovers",
]);

function envValue(env, name) {
  return typeof env?.[name] === "string" ? env[name].trim() : "";
}
function block(code) { throw new StagingGateError(code); }

// Offline guard only: the real issuer, validity and live session are checked
// by Supabase Auth + Edge at execution time, never by decoding untrusted claims.
function hasPastExpClaim(token) {
  if (!USER_JWT.test(token) || token.length > 8192) return false;
  try {
    const raw = Buffer.from(token.split(".")[1], "base64url");
    if (!raw.length || raw.length > 4096) return false;
    const payload = JSON.parse(raw.toString("utf8"));
    return Number.isSafeInteger(payload?.exp) &&
      payload.exp > 0 && payload.exp < Math.floor(Date.now()/1000)-120;
  } catch { return false; }
}

export function validateRlsStagingEnvironment(env, { live = false } = {}) {
  if (!env || typeof env !== "object") {
    return { ok: false, issues: ["STAGING_RLS_CONFIG_MISSING"] };
  }
  const target = validateStagingEnvironment(env, { live });
  const issues = [...target.issues];
  if (envValue(env,"STAGING_RLS_E2E") !== "YES") {
    issues.push("RLS_E2E_EXPLICIT_OPT_IN_REQUIRED");
  }
  if (envValue(env,"STAGING_SYNTHETIC_FIXTURES") !== "YES") {
    issues.push("SYNTHETIC_FIXTURES_REQUIRED");
  }
  for (const field of [
    "STAGING_USER_A_ID","STAGING_USER_B_ID",
    "STAGING_ORGANIZATION_A_ID","STAGING_ORGANIZATION_B_ID",
    "STAGING_EPISODE_A_ID","STAGING_EPISODE_B_ID",
  ]) {
    if (!UUID.test(envValue(env,field))) issues.push("SYNTHETIC_UUID_INVALID");
  }
  if (envValue(env,"STAGING_USER_A_ID") === envValue(env,"STAGING_USER_B_ID") ||
    envValue(env,"STAGING_ORGANIZATION_A_ID") === envValue(env,"STAGING_ORGANIZATION_B_ID") ||
    envValue(env,"STAGING_EPISODE_A_ID") === envValue(env,"STAGING_EPISODE_B_ID")) {
    issues.push("CROSS_TENANT_FIXTURES_NOT_DISTINCT");
  }
  const tokens = [
    envValue(env,"STAGING_USER_A_JWT"),
    envValue(env,"STAGING_USER_B_JWT"),
    envValue(env,"STAGING_EXPIRED_USER_JWT"),
  ];
  if (tokens.some(t => t.length > 8192 || !USER_JWT.test(t)) ||
      new Set(tokens).size !== 3) issues.push("DISTINCT_SYNTHETIC_JWTS_REQUIRED");
  if (!hasPastExpClaim(tokens[2])) issues.push("EXPIRED_JWT_EXP_CLAIM_REQUIRED");
  return { ok: issues.length === 0, issues };
}

function requestOptions(key, token, body = null) {
  const headers = { apikey:key, accept:"application/json" };
  if (token) headers.authorization = "Bearer " + token;
  if (body !== null) headers["content-type"] = "application/json";
  return {
    method: body === null ? "GET" : "POST", headers,
    redirect:"error", cache:"no-store", signal: AbortSignal.timeout(8000),
    ...(body === null ? {} : {body}),
  };
}
async function safeFetch(fetcher, url, options) {
  try { return await fetcher(url, options); }
  catch { block("STAGING_RLS_TRANSPORT_FAILED"); }
}

async function checkIdentity(fetcher, base, key, token, id) {
  const result = await safeFetch(fetcher, base+"/auth/v1/user",
    requestOptions(key,token));
  if (result.status !== 200) block("STAGING_AUTH_USER_NOT_VERIFIED");
  let user;
  try { user = await result.json(); }
  catch { block("STAGING_AUTH_RESPONSE_INVALID"); }
  if (!user || typeof user !== "object" || Array.isArray(user) ||
    user.id !== id || user.is_anonymous === true) {
    block("STAGING_AUTH_USER_ID_MISMATCH");
  }
}

async function rowsFor(fetcher, base, key, token, episode) {
  const body = JSON.stringify({action:SCOPE_ACTION,episodeId:episode});
  const result = await safeFetch(fetcher, base+"/functions/v1/visits",
    requestOptions(key,token,body));
  if (result.status !== 200) block("STAGING_SCOPE_EDGE_DENIED_OR_UNAVAILABLE");
  let payload;
  try { payload = await result.json(); }
  catch { block("STAGING_SCOPE_EDGE_INVALID_RESPONSE"); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      Object.keys(payload).sort().join(",") !== "ok,result" ||
      payload.ok !== true || !Array.isArray(payload.result) ||
      payload.result.length > 1 ||
      payload.result.some(row =>
        !row || typeof row !== "object" || Array.isArray(row) ||
        Object.keys(row).sort().join(",") !== "id,organization_id" ||
        !UUID.test(row.id) || !UUID.test(row.organization_id))) {
    block("STAGING_SCOPE_UNEXPECTED_DATA_SHAPE");
  }
  return payload.result;
}

/**
 * Exactly 22 requests, none reading any clinical row or modifying data:
 * 2 Auth GET identities; 4 Edge POST (known episode UUIDs, read-only RPC);
 * 1 denied no-JWT Edge POST; 1 expired-JWT Auth GET;
 * 14 direct PostgREST GETs selecting ZERO rows, requiring strict 401/403.
 *
 * This proves Edge/SQL tenant scope and direct table DENIAL, not unrestricted
 * remote RLS policy correctness. SQL RLS is separately covered by PostgreSQL CI.
 */
export async function verifySyntheticCrossTenantRls(env, request = fetch) {
  if (!validateRlsStagingEnvironment(env, {live:true}).ok) {
    block("STAGING_RLS_CONFIG_REJECTED");
  }
  const base=envValue(env,"STAGING_URL");
  const key=envValue(env,"STAGING_PUBLISHABLE_KEY");
  const tokenA=envValue(env,"STAGING_USER_A_JWT");
  const tokenB=envValue(env,"STAGING_USER_B_JWT");
  const episodeA=envValue(env,"STAGING_EPISODE_A_ID");
  const episodeB=envValue(env,"STAGING_EPISODE_B_ID");
  const orgA=envValue(env,"STAGING_ORGANIZATION_A_ID");
  const orgB=envValue(env,"STAGING_ORGANIZATION_B_ID");

  await checkIdentity(request,base,key,tokenA,envValue(env,"STAGING_USER_A_ID"));
  await checkIdentity(request,base,key,tokenB,envValue(env,"STAGING_USER_B_ID"));

  const ownA=await rowsFor(request,base,key,tokenA,episodeA);
  if (ownA.length!==1 || ownA[0].id!==episodeA || ownA[0].organization_id!==orgA) {
    block("STAGING_SCOPE_OWN_A_NOT_VISIBLE_OR_WRONG_ORGANIZATION");
  }
  const crossA=await rowsFor(request,base,key,tokenA,episodeB);
  if (crossA.length!==0) block("STAGING_SCOPE_CROSS_A_TO_B_LEAK");

  const ownB=await rowsFor(request,base,key,tokenB,episodeB);
  if (ownB.length!==1 || ownB[0].id!==episodeB || ownB[0].organization_id!==orgB) {
    block("STAGING_SCOPE_OWN_B_NOT_VISIBLE_OR_WRONG_ORGANIZATION");
  }
  const crossB=await rowsFor(request,base,key,tokenB,episodeA);
  if (crossB.length!==0) block("STAGING_SCOPE_CROSS_B_TO_A_LEAK");

  // No JWT must be denied by the Edge before the known episode can be read.
  const anon = await safeFetch(request,base+"/functions/v1/visits",
    requestOptions(key,null,JSON.stringify({action:SCOPE_ACTION,episodeId:episodeA})));
  if (![401,403].includes(anon.status)) block("STAGING_SCOPE_ANONYMOUS_NOT_DENIED");

  const expired = await safeFetch(request,base+"/auth/v1/user",
    requestOptions(key,envValue(env,"STAGING_EXPIRED_USER_JWT")));
  if (![401,403].includes(expired.status)) block("STAGING_EXPIRED_JWT_STILL_ACCEPTED");

  // Crucially, successful Edge reads CANNOT be used to infer direct table
  // grants were revoked. Probe every public table separately with LIMIT ZERO:
  // 200 is a FAILURE even if its JSON array would have been empty.
  for (const table of DIRECT_READ_TABLES) {
    const url=base+"/rest/v1/"+table+"?select=*&limit=0";
    const response=await safeFetch(request,url,requestOptions(key,tokenA));
    if (![401,403].includes(response.status)) {
      block("STAGING_DIRECT_TABLE_JWT_ACCESS_NOT_DENIED");
    }
  }
  return {
    authenticated:"TWO_IDENTITIES_VERIFIED",
    ownRows:"TWO_NONEMPTY_EDGE_ROWS_VERIFIED",
    crossTenant:"BOTH_DIRECTIONS_DENIED_BY_SQL_SCOPE",
    anonymous:"EDGE_REJECTED",
    expiredToken:"DENIED_BY_AUTH",
    directTables:"FOURTEEN_DENIED_FOR_JWT_ROLE",
  };
}
