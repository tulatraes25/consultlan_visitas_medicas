/**
 * STAGING-01A: no-PHI, no-write policy for an independent Supabase staging target.
 * Never accept a service_role key or a user JWT. No patient fixtures or credentials.
 */
export const REQUIRED_MIGRATIONS = Object.freeze([
  "20261010000000_standalone_foundation.sql",
  "20261010010000_operational_commands.sql",
  "20261010020000_homecare_episodes.sql",
  "20261010030000_homecare_coverage.sql",
  "20261010040000_homecare_controlled_commands.sql",
  "20261010050000_homecare_review_requests.sql",
  "20261010060000_revoke_legacy_clinical_rpc.sql",
  "20261010070000_live_auth_session_gate.sql",
  "20261010080000_homecare_roster_edge_read.sql",
  "20261010090000_close_direct_sensitive_reads.sql",
  "20261010100000_episode_scope_edge_read.sql",
  "20261011100000_homecare_roster_keyset_read.sql",
  "20261011110000_homecare_attendance_template_preview.sql",
]);

export const RETIRED_CLINICAL_COMMANDS = Object.freeze([
  "scheduleVisit", "beginVisit", "addClinicalNote",
  "submitVisitReview", "cancelVisit",
]);

const RETIRED_RPC_NAMES = Object.freeze([
  "api_schedule_visit", "api_begin_visit", "api_add_clinical_note",
  "api_submit_visit_review", "api_cancel_visit",
]);

const PROJECT_REF = /^[a-z0-9]{20}$/;
const PUBLIC_KEY = /^sb_publishable_[A-Za-z0-9_-]{16,}$/;

export class StagingGateError extends Error {
  constructor(code) {
    super(code);
    this.name = "StagingGateError";
    this.code = code;
  }
}

function value(env, name) {
  return typeof env[name] === "string" ? env[name].trim() : "";
}

/** Never returns environment values, refs, keys, tokens or URLs. */
export function validateStagingEnvironment(env, { live = false } = {}) {
  const issues = [];
  if (!env || typeof env !== "object") return { ok: false, issues: ["STAGING_CONFIG_MISSING"] };
  const expected = {
    STAGING_ENVIRONMENT: "staging",
    STAGING_OPERATOR_APPROVED: "YES",
    STAGING_NO_REAL_PATIENTS: "YES",
  };
  if (live) expected.STAGING_ALLOW_NETWORK = "YES";
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (value(env, field) !== expectedValue) issues.push(field + "_REQUIRED");
  }

  const ref = value(env, "STAGING_PROJECT_REF");
  if (!PROJECT_REF.test(ref)) issues.push("STAGING_PROJECT_REF_INVALID");

  // Reject noncanonical URLs (custom domain, prod, localhost, userinfo, path,
  // port, query, fragment, scheme downgrade); never follow redirects.
  const url = value(env, "STAGING_URL");
  if (!PROJECT_REF.test(ref) || url !== `https://${ref}.supabase.co`) {
    issues.push("STAGING_URL_NOT_EXACT_PROJECT_ORIGIN");
  }

  const excludedInput = value(env, "STAGING_FORBIDDEN_PROJECT_REFS");
  const excluded = excludedInput.split(",").map(s => s.trim()).filter(Boolean);
  if (!excluded.length || excluded.some(item => !PROJECT_REF.test(item))) {
    issues.push("STAGING_FORBIDDEN_REFS_REQUIRED");
  }
  if (excluded.includes(ref)) issues.push("STAGING_REF_IS_FORBIDDEN");

  const key = value(env, "STAGING_PUBLISHABLE_KEY");
  if (!PUBLIC_KEY.test(key)) issues.push("PUBLISHABLE_ONLY_KEY_REQUIRED");
  return { ok: issues.length === 0, issues };
}

/**
 * Deterministic source inspection. Caller checks file presence separately.
 * No network access or secrets are necessary for these tests.
 */
export function checkStagingSource({ config, edgeHandler, revokeMigration }) {
  const issues = [];
  if (!/^project_id\s*=\s*"consultlan-visitas-medicas-local"\s*$/m.test(config)) {
    issues.push("SUPABASE_LOCAL_PROJECT_ID_MISSING");
  }
  if (!/\[functions\.visits\]\s*\r?\nverify_jwt\s*=\s*true\b/m.test(config)) {
    issues.push("EDGE_JWT_GATE_NOT_REQUIRED");
  }
  const commandBlock = edgeHandler.split("const COMMANDS:")[1]?.split("const UUID =")[0] ?? "";
  if (!commandBlock.includes("requestHomecarePlanReview:")) {
    issues.push("PENDING_REVIEW_EDGE_ROUTE_MISSING");
  }
  // A LIMIT 100 without window/cursor can hide future visits. No legacy
  // unbounded action may be exposed even if its server-only SQL still exists.
  if (/\blistMyHomecareCoverages\s*:\s*\{/.test(commandBlock)) {
    issues.push("LEGACY_UNWINDOWED_ROSTER_EXPOSED");
  }
  for (const name of RETIRED_CLINICAL_COMMANDS) {
    if (new RegExp(`(?:^|\\n)\\s*${name}:\\s*\\{`).test(commandBlock)) {
      issues.push("LEGACY_EDGE_COMMAND_EXPOSED");
      break;
    }
  }
  for (const name of RETIRED_RPC_NAMES) {
    if (!revokeMigration.includes("revoke execute on function public." + name + "(")) {
      issues.push("LEGACY_RPC_REVOKE_MISSING");
      break;
    }
  }
  return { ok: issues.length === 0, issues };
}

function blocked(code) { throw new StagingGateError(code); }

/**
 * Deliberately limited negative tests only. No user JWT, Authorization header,
 * private key, real record creation, admin request, or persistence.
 * An empty anonymous result is not proof of full RLS coverage.
 */
export async function negativeStagingProbe(env, request = fetch) {
  const validation = validateStagingEnvironment(env, { live: true });
  if (!validation.ok) blocked("STAGING_CONFIG_REJECTED");

  const origin = value(env, "STAGING_URL");
  const publicKey = value(env, "STAGING_PUBLISHABLE_KEY");
  const common = {
    apikey: publicKey,
    accept: "application/json",
  };

  // Request at most one ID, never any patient or clinical columns.
  let response;
  try {
    response = await request(
      origin + "/rest/v1/homecare_episodes?select=id&limit=1",
      { method: "GET", headers: common, redirect: "error",
        cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
  } catch {
    blocked("STAGING_ANON_PROBE_TRANSPORT_FAILED");
  }
  if (response.status === 200) {
    let sample;
    try { sample = await response.json(); } catch { blocked("STAGING_ANON_INVALID_RESPONSE"); }
    if (!Array.isArray(sample) || sample.length > 0) {
      blocked("STAGING_ANONYMOUS_DATA_EXPOSED_OR_UNVERIFIED");
    }
  } else if (response.status !== 401 && response.status !== 403) {
    blocked("STAGING_ANON_READ_UNEXPECTED_STATUS");
  }

  // Intentionally unknown action: even a wrongly configured auth gateway
  // must not dispatch any permitted clinical or administrative command.
  let edge;
  try {
    edge = await request(
      origin + "/functions/v1/visits",
      { method: "POST", headers: { ...common, "content-type": "application/json" },
        body: '{"action":"__negative_staging_auth_probe__"}',
        redirect: "error", cache: "no-store",
        signal: AbortSignal.timeout(8000) },
    );
  } catch {
    blocked("STAGING_EDGE_PROBE_TRANSPORT_FAILED");
  }
  if (edge.status !== 401 && edge.status !== 403) {
    blocked("STAGING_EDGE_WITHOUT_USER_JWT_NOT_DENIED");
  }
  return { anonymousRead: "NO_VISIBLE_RECORDS_IN_SAMPLE", edge: "UNAUTHENTICATED_REJECTED" };
}
