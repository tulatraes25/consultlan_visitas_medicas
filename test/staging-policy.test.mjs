import test from "node:test";
import assert from "node:assert/strict";
import {
  checkStagingSource, validateStagingEnvironment,
  negativeStagingProbe, REQUIRED_MIGRATIONS,
} from "../src/operations/staging-policy.mjs";

const STAGING_REF = "a".repeat(20);
const FORBIDDEN_REF = "b".repeat(20);
const base = () => ({
  STAGING_ENVIRONMENT: "staging",
  STAGING_OPERATOR_APPROVED: "YES",
  STAGING_NO_REAL_PATIENTS: "YES",
  STAGING_ALLOW_NETWORK: "YES",
  STAGING_PROJECT_REF: STAGING_REF,
  STAGING_URL: `https://${STAGING_REF}.supabase.co`,
  STAGING_FORBIDDEN_PROJECT_REFS: FORBIDDEN_REF,
  STAGING_PUBLISHABLE_KEY: "sb_publishable_" + "x".repeat(30),
});

const denied = (env, live = true) =>
  assert.equal(validateStagingEnvironment(env, { live }).ok, false);

test("STAGING-01A defaults to rejecting absent, production or unverifiable configuration", () => {
  denied({});
  denied({ ...base(), STAGING_ENVIRONMENT: "production" });
  denied({ ...base(), STAGING_OPERATOR_APPROVED: "NO" });
  denied({ ...base(), STAGING_NO_REAL_PATIENTS: "NO" });
  denied({ ...base(), STAGING_ALLOW_NETWORK: "NO" });
  denied({ ...base(), STAGING_FORBIDDEN_PROJECT_REFS: "" });
  denied({ ...base(), STAGING_PROJECT_REF: FORBIDDEN_REF, STAGING_URL: `https://${FORBIDDEN_REF}.supabase.co` });
});

test("STAGING-01A rejects redirects, hostile domains, localhost, paths, ports and wrong refs", () => {
  for (const url of [
    "http://" + STAGING_REF + ".supabase.co",
    "https://" + STAGING_REF + ".supabase.co.evil.example",
    "https://localhost:54321",
    "https://" + STAGING_REF + ".supabase.co/",
    "https://" + STAGING_REF + ".supabase.co:8443",
    "https://" + STAGING_REF + ".supabase.co/auth/v1/user",
    "https://" + STAGING_REF + ".supabase.co?token=unsafe",
    "https://someone@" + STAGING_REF + ".supabase.co",
  ]) {
    denied({ ...base(), STAGING_URL: url });
  }
  denied({ ...base(), STAGING_PROJECT_REF: "not-an-actual-ref" });
});

test("STAGING-01A rejects secret keys, JWTs and insufficient key material", () => {
  denied({ ...base(), STAGING_PUBLISHABLE_KEY: "sb_secret_" + "x".repeat(30) });
  denied({ ...base(), STAGING_PUBLISHABLE_KEY: "eyJ.abc.def" });
  denied({ ...base(), STAGING_PUBLISHABLE_KEY: "service_role" });
  denied({ ...base(), STAGING_PUBLISHABLE_KEY: "sb_publishable_short" });
  assert.equal(validateStagingEnvironment(base(), { live: true }).ok, true);
  assert.equal(validateStagingEnvironment({
    ...base(), STAGING_ALLOW_NETWORK: "NO",
  }, { live: false }).ok, true);
});

test("STAGING-01A blocks network entirely if opt-in is missing", async () => {
  let calls = 0;
  await assert.rejects(
    negativeStagingProbe({ ...base(), STAGING_ALLOW_NETWORK: "" },
      async () => { calls++; throw Error("must not run"); }),
    { code: "STAGING_CONFIG_REJECTED" },
  );
  assert.equal(calls, 0);
});

test("STAGING-01A anonymous read and Edge without a JWT are strictly read-only/denied", async () => {
  const requests = [];
  const mock = async (url, options) => {
    requests.push({ url, options });
    if (requests.length === 1) return { status: 200, json: async () => [] };
    return { status: 401 };
  };
  const result = await negativeStagingProbe(base(), mock);
  assert.equal(result.edge, "UNAUTHENTICATED_REJECTED");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.method, "GET");
  assert.equal(requests[1].options.method, "POST");
  assert.equal(requests[1].options.body, '{"action":"__negative_staging_auth_probe__"}');
  for (const { url, options } of requests) {
    assert.ok(url.startsWith(base().STAGING_URL + "/"));
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.ok(!("authorization" in options.headers));
    assert.ok(!("Authorization" in options.headers));
    assert.ok(!url.includes("patient"));
    assert.ok(!url.includes("token"));
  }
});

test("STAGING-01A rejects any sample row or permissive/missing Edge", async () => {
  await assert.rejects(
    negativeStagingProbe(base(), async () =>
      ({ status: 200, json: async () => [{ id: "synthetic-visible-record" }] })),
    { code: "STAGING_ANONYMOUS_DATA_EXPOSED_OR_UNVERIFIED" },
  );
  for (const status of [200, 404, 422, 500]) {
    let calls = 0;
    await assert.rejects(
      negativeStagingProbe(base(), async () =>
        ++calls === 1 ? { status: 403 } : { status }),
      { code: "STAGING_EDGE_WITHOUT_USER_JWT_NOT_DENIED" },
    );
    assert.equal(calls, 2);
  }
  await assert.rejects(
    negativeStagingProbe(base(), async () => ({ status: 200, json: async () => ({error:"incorrect"}) })),
    { code: "STAGING_ANONYMOUS_DATA_EXPOSED_OR_UNVERIFIED" },
  );
});

test("STAGING-01A repository inspection enforces local ID, JWT, pending route and retired SQL RPCs", () => {
  const revokeMigration = [
    "api_schedule_visit", "api_begin_visit", "api_add_clinical_note",
    "api_submit_visit_review", "api_cancel_visit",
  ].map(name => "revoke execute on function public." + name + "(").join("\n");
  const good = {
    config: 'project_id = "consultlan-visitas-medicas-local"\n[functions.visits]\nverify_jwt = true\n',
    edgeHandler: "const COMMANDS: Record<string, unknown> = { requestHomecarePlanReview: { rpc: 'pending' } };\nconst UUID = /x/;",
    revokeMigration,
  };
  assert.equal(checkStagingSource(good).ok, true);
  assert.equal(checkStagingSource({
    ...good, edgeHandler: good.edgeHandler.replace("requestHomecarePlanReview:", "scheduleVisit:"),
  }).ok, false);
  assert.equal(checkStagingSource({ ...good, config: good.config.replace("true", "false") }).ok, false);
  assert.equal(checkStagingSource({ ...good, revokeMigration: "" }).ok, false);
  assert.equal(REQUIRED_MIGRATIONS.length, 8);
});
