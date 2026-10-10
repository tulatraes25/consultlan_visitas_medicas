/**
 * STAGING-01B: two-organization, nonempty read-only RLS verification.
 * This module cannot create accounts, approve plans, sign, deploy or write data.
 */
import {
  validateStagingEnvironment, StagingGateError,
} from "./staging-policy.mjs";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const USER_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function envValue(env, name) {
  return typeof env[name] === "string" ? env[name].trim() : "";
}
function block(code) { throw new StagingGateError(code); }

// The exp claim is only a local shape/age guard. Signature and rejection
// must still be checked against Supabase Auth; this does not validate a session.
function hasPastExpClaim(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return Number.isSafeInteger(payload?.exp) &&
      payload.exp > 0 && payload.exp < Math.floor(Date.now() / 1000) - 120;
  } catch { return false; }
}

export function validateRlsStagingEnvironment(env, { live = false } = {}) {
  if (!env || typeof env !== "object") return { ok: false, issues: ["STAGING_RLS_CONFIG_MISSING"] };
  const target = validateStagingEnvironment(env, { live });
  const issues = [...target.issues];
  if (envValue(env, "STAGING_RLS_E2E") !== "YES") issues.push("RLS_E2E_EXPLICIT_OPT_IN_REQUIRED");
  if (envValue(env, "STAGING_SYNTHETIC_FIXTURES") !== "YES") issues.push("SYNTHETIC_FIXTURES_REQUIRED");

  const uuids = [
    "STAGING_USER_A_ID", "STAGING_USER_B_ID",
    "STAGING_ORGANIZATION_A_ID", "STAGING_ORGANIZATION_B_ID",
    "STAGING_EPISODE_A_ID", "STAGING_EPISODE_B_ID",
  ];
  for (const field of uuids) if (!UUID.test(envValue(env, field))) issues.push("SYNTHETIC_UUID_INVALID");
  const idA = envValue(env, "STAGING_USER_A_ID");
  const idB = envValue(env, "STAGING_USER_B_ID");
  const orgA = envValue(env, "STAGING_ORGANIZATION_A_ID");
  const orgB = envValue(env, "STAGING_ORGANIZATION_B_ID");
  const epiA = envValue(env, "STAGING_EPISODE_A_ID");
  const epiB = envValue(env, "STAGING_EPISODE_B_ID");
  if (idA === idB || orgA === orgB || epiA === epiB) issues.push("CROSS_TENANT_FIXTURES_NOT_DISTINCT");

  const tokens = [
    envValue(env, "STAGING_USER_A_JWT"),
    envValue(env, "STAGING_USER_B_JWT"),
    envValue(env, "STAGING_EXPIRED_USER_JWT"),
  ];
  if (tokens.some(t => !USER_JWT.test(t)) || new Set(tokens).size !== 3) {
    issues.push("DISTINCT_SYNTHETIC_JWTS_REQUIRED");
  }
  if (!hasPastExpClaim(envValue(env, "STAGING_EXPIRED_USER_JWT"))) {
    issues.push("EXPIRED_JWT_EXP_CLAIM_REQUIRED");
  }
  return { ok: issues.length === 0, issues };
}

function requestOptions(key, token) {
  const headers = { apikey: key, accept: "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  return { method: "GET", headers, redirect: "error",
    cache: "no-store", signal: AbortSignal.timeout(8000) };
}

async function safeFetch(request, url, opts) {
  try { return await request(url, opts); }
  catch { block("STAGING_RLS_TRANSPORT_FAILED"); }
}

async function checkIdentity(request, base, key, token, expectedId) {
  const result = await safeFetch(request, base + "/auth/v1/user", requestOptions(key, token));
  if (result.status !== 200) block("STAGING_AUTH_USER_NOT_VERIFIED");
  let user;
  try { user = await result.json(); } catch { block("STAGING_AUTH_RESPONSE_INVALID"); }
  if (!user || typeof user !== "object" || Array.isArray(user) ||
      user.id !== expectedId || user.is_anonymous === true) {
    block("STAGING_AUTH_USER_ID_MISMATCH");
  }
}

async function rowsFor(request, base, key, token, episode) {
  const url = base + "/rest/v1/homecare_episodes?select=id,organization_id&id=eq." + episode;
  const result = await safeFetch(request, url, requestOptions(key, token));
  if (result.status !== 200) block("STAGING_RLS_REST_REQUEST_DENIED_OR_UNAVAILABLE");
  let data;
  try { data = await result.json(); } catch { block("STAGING_RLS_INVALID_RESPONSE"); }
  if (!Array.isArray(data) || data.length > 1 ||
      data.some(row => !row || typeof row !== "object" || Array.isArray(row) ||
        Object.keys(row).sort().join(",") !== "id,organization_id")) {
    block("STAGING_RLS_UNEXPECTED_DATA_SHAPE");
  }
  return data;
}

/**
 * Exactly eight GETs; all fixture IDs and JWTs remain in memory.
 * Own episode must be nonempty; cross-tenant must be empty; expired token denied.
 */
export async function verifySyntheticCrossTenantRls(env, request = fetch) {
  if (!validateRlsStagingEnvironment(env, { live: true }).ok) block("STAGING_RLS_CONFIG_REJECTED");

  const base = envValue(env, "STAGING_URL");
  const key = envValue(env, "STAGING_PUBLISHABLE_KEY");
  const actorA = envValue(env, "STAGING_USER_A_JWT");
  const actorB = envValue(env, "STAGING_USER_B_JWT");
  const idA = envValue(env, "STAGING_USER_A_ID");
  const idB = envValue(env, "STAGING_USER_B_ID");
  const orgA = envValue(env, "STAGING_ORGANIZATION_A_ID");
  const orgB = envValue(env, "STAGING_ORGANIZATION_B_ID");
  const epiA = envValue(env, "STAGING_EPISODE_A_ID");
  const epiB = envValue(env, "STAGING_EPISODE_B_ID");

  await checkIdentity(request, base, key, actorA, idA);
  await checkIdentity(request, base, key, actorB, idB);

  const ownA = await rowsFor(request, base, key, actorA, epiA);
  if (ownA.length !== 1 || ownA[0].id !== epiA || ownA[0].organization_id !== orgA) {
    block("STAGING_RLS_OWN_A_NOT_VISIBLE_OR_WRONG_ORGANIZATION");
  }
  const crossA = await rowsFor(request, base, key, actorA, epiB);
  if (crossA.length !== 0) block("STAGING_RLS_CROSS_A_TO_B_LEAK");

  const ownB = await rowsFor(request, base, key, actorB, epiB);
  if (ownB.length !== 1 || ownB[0].id !== epiB || ownB[0].organization_id !== orgB) {
    block("STAGING_RLS_OWN_B_NOT_VISIBLE_OR_WRONG_ORGANIZATION");
  }
  const crossB = await rowsFor(request, base, key, actorB, epiA);
  if (crossB.length !== 0) block("STAGING_RLS_CROSS_B_TO_A_LEAK");

  // The row is known to exist because ownA was strictly nonempty.
  const anonymous = await safeFetch(
    request, base + "/rest/v1/homecare_episodes?select=id,organization_id&id=eq." + epiA,
    requestOptions(key, null),
  );
  if (anonymous.status === 200) {
    let data;
    try { data = await anonymous.json(); } catch { block("STAGING_RLS_ANON_INVALID_RESPONSE"); }
    if (!Array.isArray(data) || data.length !== 0) block("STAGING_RLS_ANONYMOUS_EPISODE_VISIBLE");
  } else if (anonymous.status !== 401 && anonymous.status !== 403) {
    block("STAGING_RLS_ANONYMOUS_UNEXPECTED_STATUS");
  }

  const expired = await safeFetch(
    request, base + "/auth/v1/user",
    requestOptions(key, envValue(env, "STAGING_EXPIRED_USER_JWT")),
  );
  if (expired.status !== 401 && expired.status !== 403) block("STAGING_EXPIRED_JWT_STILL_ACCEPTED");

  return { authenticated: "TWO_IDENTITIES_VERIFIED",
    ownRows: "TWO_NONEMPTY_ROWS_VERIFIED",
    crossTenant: "BOTH_DIRECTIONS_DENIED",
    anonymous: "KNOWN_ROW_NOT_VISIBLE",
    expiredToken: "DENIED" };
}
