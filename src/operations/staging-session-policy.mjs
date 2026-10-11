/**
 * STAGING-01C — read-only evidence about live vs terminated Supabase Auth sessions.
 * No provisioning, refresh, sign-out or clinical actions. Network only with --probe
 * and operator attestation for a completely separate, synthetic staging project.
 */
import { validateStagingEnvironment, StagingGateError } from "./staging-policy.mjs";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const UNKNOWN_ACTION = '{"action":"__staging_session_negative_only__"}';

function value(env, name) {
  return typeof env?.[name] === "string" ? env[name].trim() : "";
}
function blocked(code) { throw new StagingGateError(code); }

/**
 * Parse claims exclusively for negative, local *shape* validation.
 * Never treat decoded, unsigned claims as proof of identity or session status.
 * Only the independent Supabase Auth endpoint can verify their authenticity.
 */
function localClaims(token) {
  if (token.length > 8192 || !JWT.test(token)) return null;
  try {
    const segment = token.split(".")[1];
    const raw = Buffer.from(segment, "base64url");
    if (raw.length === 0 || raw.length > 4096) return null;
    const claims = JSON.parse(raw.toString("utf8"));
    if (!claims || typeof claims !== "object" || Array.isArray(claims) ||
      !UUID.test(claims.sub) || !UUID.test(claims.session_id) ||
      claims.role !== "authenticated" ||
      !Number.isSafeInteger(claims.exp) || claims.exp <= 0) return null;
    return { sub: claims.sub.toLowerCase(), session: claims.session_id.toLowerCase(), exp: claims.exp };
  } catch { return null; }
}

/** Safe for reporting: issues are fixed codes and never contain IDs, URLs or JWTs. */
export function validateSessionStagingEnvironment(env, { live = false, nowSeconds = Math.floor(Date.now() / 1000) } = {}) {
  const issues = [...validateStagingEnvironment(env, { live }).issues];
  for (const [field, expected] of Object.entries({
    STAGING_SYNTHETIC_FIXTURES: "YES",
    STAGING_SESSION_E2E: "YES",
    STAGING_SESSION_REVOCATION_CONFIRMED: "YES",
  })) {
    if (value(env, field) !== expected) issues.push(field + "_REQUIRED");
  }

  const userId = value(env, "STAGING_SESSION_USER_ID").toLowerCase();
  if (!UUID.test(userId)) issues.push("SESSION_SYNTHETIC_USER_INVALID");

  const tokens = [
    value(env, "STAGING_SESSION_ACTIVE_JWT"),
    value(env, "STAGING_SESSION_REVOKED_JWT"),
    value(env, "STAGING_SESSION_EXPIRED_JWT"),
  ];
  if (new Set(tokens).size !== 3) issues.push("SESSION_DISTINCT_TOKENS_REQUIRED");

  const [active, revoked, expired] = tokens.map(localClaims);
  if (!active || !revoked || !expired ||
      [active, revoked, expired].some(c => c && c.sub !== userId)) {
    issues.push("SESSION_TOKEN_CLAIMS_INVALID");
  } else {
    // A terminated session must have a still-unexpired access JWT. Otherwise
    // rejection would only prove expiration, not revocation.
    if (active.exp <= nowSeconds + 120 || revoked.exp <= nowSeconds + 120) {
      issues.push("SESSION_ACTIVE_AND_REVOKED_JWTS_MUST_BE_UNEXPIRED");
    }
    if (expired.exp >= nowSeconds - 120) {
      issues.push("SESSION_EXPIRED_JWT_NOT_OLD_ENOUGH");
    }
    if (active.session === revoked.session) {
      issues.push("SESSION_IDS_MUST_DIFFER");
    }
  }
  return { ok: issues.length === 0, issues };
}

async function fetchOnly(request, url, options) {
  try { return await request(url, options); }
  catch { blocked("STAGING_SESSION_TRANSPORT_FAILED"); }
}
function options(key, token, method = "GET") {
  const headers = { apikey: key, accept: "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  if (method === "POST") headers["content-type"] = "application/json";
  return {
    method, headers, redirect: "error", cache: "no-store",
    signal: AbortSignal.timeout(8000),
    ...(method === "POST" ? { body: UNKNOWN_ACTION } : {}),
  };
}

async function authIdentity(request, base, key, token, expected, label) {
  const response = await fetchOnly(
    request, base + "/auth/v1/user", options(key, token),
  );
  if (response.status !== 200) blocked(label + "_NOT_ACCEPTED_BY_AUTH");
  let user;
  try { user = await response.json(); }
  catch { blocked("STAGING_SESSION_AUTH_RESPONSE_INVALID"); }
  if (!user || typeof user !== "object" || Array.isArray(user) ||
      user.id?.toLowerCase?.() !== expected || user.is_anonymous === true) {
    blocked("STAGING_SESSION_AUTH_IDENTITY_MISMATCH");
  }
}

/**
 * Exactly six fixed requests, none capable of invoking an allowlisted command:
 * - authenticated GET for live/revoked JWT identities;
 * - Edge POST with an UNKNOWN action (never creates/modifies a record);
 * - negative checks for revoked, expired and missing JWT.
 */
export async function verifySyntheticSessionRevocation(env, request = fetch) {
  if (!validateSessionStagingEnvironment(env, { live: true }).ok) {
    blocked("STAGING_SESSION_CONFIG_REJECTED");
  }
  const base = value(env, "STAGING_URL");
  const key = value(env, "STAGING_PUBLISHABLE_KEY");
  const userId = value(env, "STAGING_SESSION_USER_ID").toLowerCase();
  const active = value(env, "STAGING_SESSION_ACTIVE_JWT");
  const revoked = value(env, "STAGING_SESSION_REVOKED_JWT");
  const expired = value(env, "STAGING_SESSION_EXPIRED_JWT");

  await authIdentity(request, base, key, active, userId, "ACTIVE_JWT");
  // Auth must still accept the signed-out, unexpired access JWT; otherwise
  // denial cannot be attributed to the extra session boundary.
  await authIdentity(request, base, key, revoked, userId, "REVOKED_JWT");

  const endpoint = base + "/functions/v1/visits";
  const accepted = await fetchOnly(request, endpoint, options(key, active, "POST"));
  if (accepted.status !== 422) blocked("STAGING_SESSION_LIVE_EDGE_NOT_REACHABLE");
  let outcome;
  try { outcome = await accepted.json(); }
  catch { blocked("STAGING_SESSION_LIVE_EDGE_RESPONSE_INVALID"); }
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome) ||
      Object.keys(outcome).length !== 1 ||
      outcome.error !== "INVALID_OPERATION_OR_FIELDS") {
    blocked("STAGING_SESSION_LIVE_EDGE_NOT_AUTHORIZED_FOR_VALIDATION");
  }

  for (const [token, denial] of [
    [revoked, "STAGING_SESSION_REVOKED_JWT_NOT_DENIED"],
    [expired, "STAGING_SESSION_EXPIRED_JWT_NOT_DENIED"],
    [null, "STAGING_SESSION_MISSING_JWT_NOT_DENIED"],
  ]) {
    const response = await fetchOnly(request, endpoint, options(key, token, "POST"));
    if (response.status !== 401 && response.status !== 403) blocked(denial);
  }
  return {
    activeSession: "EDGE_REACHED_UNKNOWN_ACTION_REJECTED",
    signedOutSession: "UNEXPIRED_JWT_AUTH_ACCEPTED_BUT_EDGE_DENIED",
    expiredJwt: "DENIED",
    missingJwt: "DENIED",
    writes: 0,
  };
}
