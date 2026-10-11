import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSessionStagingEnvironment, verifySyntheticSessionRevocation,
} from "../src/operations/staging-session-policy.mjs";

const REF = "a".repeat(20);
const FORBIDDEN_REF = "b".repeat(20);
const USER = "11111111-1111-4111-8111-111111111111";
const SESSION_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION_OLD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const now = () => Math.floor(Date.now() / 1000);

function fakeJwt(sub, session, exp) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub, session_id: session, exp, role: "authenticated",
  })).toString("base64url");
  return header + "." + payload + ".synthetic_signature";
}

function good() {
  return {
    STAGING_ENVIRONMENT: "staging",
    STAGING_OPERATOR_APPROVED: "YES",
    STAGING_NO_REAL_PATIENTS: "YES",
    STAGING_ALLOW_NETWORK: "YES",
    STAGING_PROJECT_REF: REF,
    STAGING_URL: `https://${REF}.supabase.co`,
    STAGING_FORBIDDEN_PROJECT_REFS: FORBIDDEN_REF,
    STAGING_PUBLISHABLE_KEY: "sb_publishable_" + "x".repeat(32),
    STAGING_SYNTHETIC_FIXTURES: "YES",
    STAGING_SESSION_E2E: "YES",
    STAGING_SESSION_REVOCATION_CONFIRMED: "YES",
    STAGING_SESSION_USER_ID: USER,
    STAGING_SESSION_ACTIVE_JWT: fakeJwt(USER, SESSION_A, now() + 3600),
    STAGING_SESSION_REVOKED_JWT: fakeJwt(USER, SESSION_B, now() + 3600),
    STAGING_SESSION_EXPIRED_JWT: fakeJwt(USER, SESSION_OLD, 1),
  };
}

function responses() {
  return [
    { status: 200, payload: { id: USER, is_anonymous: false } },
    { status: 200, payload: { id: USER, is_anonymous: false } },
    { status: 422, payload: { error: "INVALID_OPERATION_OR_FIELDS" } },
    { status: 401 },
    { status: 401 },
    { status: 401 },
  ];
}
function fakeFetch(sequence, calls) {
  return async (url, options) => {
    calls.push({ url, options });
    const result = sequence[calls.length - 1];
    if (!result) throw new Error("Unexpected extra transport call");
    return { status: result.status, json: async () => result.payload };
  };
}

test("STAGING-01C accepts only full UUIDs, standalone project and explicit session revocation declarations", () => {
  assert.equal(validateSessionStagingEnvironment(good(), { live: true }).ok, true);
  for (const env of [
    { ...good(), STAGING_SESSION_E2E: "NO" },
    { ...good(), STAGING_SYNTHETIC_FIXTURES: "NO" },
    { ...good(), STAGING_SESSION_REVOCATION_CONFIRMED: "NO" },
    { ...good(), STAGING_ALLOW_NETWORK: "" },
    { ...good(), STAGING_ENVIRONMENT: "production" },
    { ...good(), STAGING_URL: "https://" + REF + ".supabase.co/" },
    { ...good(), STAGING_PROJECT_REF: FORBIDDEN_REF, STAGING_URL: "https://" + FORBIDDEN_REF + ".supabase.co" },
    { ...good(), STAGING_PUBLISHABLE_KEY: "sb_secret_" + "x".repeat(32) },
    { ...good(), STAGING_SESSION_USER_ID: "11111111-1111-4111-8111-11111111111" },
    { ...good(), STAGING_SESSION_ACTIVE_JWT: fakeJwt("22222222-2222-4222-8222-222222222222", SESSION_A, now() + 3600) },
    { ...good(), STAGING_SESSION_ACTIVE_JWT: fakeJwt(USER, SESSION_A, now() - 10) },
    { ...good(), STAGING_SESSION_REVOKED_JWT: fakeJwt(USER, SESSION_B, now() - 10) },
    { ...good(), STAGING_SESSION_REVOKED_JWT: fakeJwt(USER, SESSION_A, now() + 3600) },
    { ...good(), STAGING_SESSION_EXPIRED_JWT: fakeJwt(USER, SESSION_OLD, now() + 3600) },
    { ...good(), STAGING_SESSION_ACTIVE_JWT: "sb_secret_untrusted" },
    { ...good(), STAGING_SESSION_EXPIRED_JWT: "abc.not_json.signature" },
  ]) {
    assert.equal(validateSessionStagingEnvironment(env, { live: true }).ok, false);
  }
});

test("STAGING-01C blocks all transport without complete opt-in and synthetic tokens", async () => {
  let network = 0;
  await assert.rejects(
    verifySyntheticSessionRevocation({ ...good(), STAGING_ALLOW_NETWORK: "" }, async () => {
      network++; throw Error("must not request");
    }),
    { code: "STAGING_SESSION_CONFIG_REJECTED" },
  );
  assert.equal(network, 0);
});

test("STAGING-01C probes six fixed URLs with only intentionally invalid Edge action", async () => {
  const calls = [];
  const result = await verifySyntheticSessionRevocation(good(), fakeFetch(responses(), calls));
  assert.equal(result.signedOutSession, "UNEXPIRED_JWT_AUTH_ACCEPTED_BUT_EDGE_DENIED");
  assert.equal(result.activeSession, "EDGE_REACHED_UNKNOWN_ACTION_REJECTED");
  assert.equal(result.expiredJwt, "DENIED");
  assert.equal(calls.length, 6);
  for (const { url, options } of calls) {
    assert.ok(url.startsWith(good().STAGING_URL + "/"));
    assert.ok(url === good().STAGING_URL + "/auth/v1/user" ||
              url === good().STAGING_URL + "/functions/v1/visits");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.ok(!url.includes("?"));
    assert.ok(!url.includes("patient"));
    assert.ok(!url.includes("token"));
    assert.ok(!("service_role" in options.headers));
    if (options.method === "POST") {
      assert.equal(options.body, '{"action":"__staging_session_negative_only__"}');
    } else {
      assert.equal(options.method, "GET");
      assert.equal(options.body, undefined);
    }
  }
  assert.equal(calls[2].options.headers.authorization, "Bearer " + good().STAGING_SESSION_ACTIVE_JWT);
  assert.equal(calls[3].options.headers.authorization, "Bearer " + good().STAGING_SESSION_REVOKED_JWT);
  assert.equal(calls[4].options.headers.authorization, "Bearer " + good().STAGING_SESSION_EXPIRED_JWT);
  assert.equal(calls[5].options.headers.authorization, undefined);
});

test("STAGING-01C rejects when signed-out unexpired token is not separately verifiable by Auth", async () => {
  const failed = responses();
  failed[1] = { status: 401 };
  await assert.rejects(verifySyntheticSessionRevocation(good(), fakeFetch(failed, [])),
    { code: "REVOKED_JWT_NOT_ACCEPTED_BY_AUTH" });
});

test("STAGING-01C rejects an active token that cannot traverse the Edge authentication barrier", async () => {
  const failed = responses();
  failed[2] = { status: 401 };
  await assert.rejects(verifySyntheticSessionRevocation(good(), fakeFetch(failed, [])),
    { code: "STAGING_SESSION_LIVE_EDGE_NOT_REACHABLE" });
  const incorrect = responses();
  incorrect[2] = { status: 422, payload: { error: "OTHER_ERROR" } };
  await assert.rejects(verifySyntheticSessionRevocation(good(), fakeFetch(incorrect, [])),
    { code: "STAGING_SESSION_LIVE_EDGE_NOT_AUTHORIZED_FOR_VALIDATION" });
});

test("STAGING-01C rejects a revoked, expired or missing JWT reaching the command validator", async () => {
  for (const [position, error] of [
    [3, "STAGING_SESSION_REVOKED_JWT_NOT_DENIED"],
    [4, "STAGING_SESSION_EXPIRED_JWT_NOT_DENIED"],
    [5, "STAGING_SESSION_MISSING_JWT_NOT_DENIED"],
  ]) {
    const failed = responses();
    failed[position] = { status: 422, payload: { error: "INVALID_OPERATION_OR_FIELDS" } };
    await assert.rejects(verifySyntheticSessionRevocation(good(), fakeFetch(failed, [])),
      { code: error });
  }
});

test("STAGING-01C requires exact same synthetic user for both verified sessions", async () => {
  const wrong = responses();
  wrong[1] = { status: 200, payload: { id: "22222222-2222-4222-8222-222222222222" } };
  await assert.rejects(verifySyntheticSessionRevocation(good(), fakeFetch(wrong, [])),
    { code: "STAGING_SESSION_AUTH_IDENTITY_MISMATCH" });
  const outage = async () => { throw Error("credential should never be printed"); };
  await assert.rejects(verifySyntheticSessionRevocation(good(), outage),
    { code: "STAGING_SESSION_TRANSPORT_FAILED" });
});
