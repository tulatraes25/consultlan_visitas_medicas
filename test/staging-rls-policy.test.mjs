import test from "node:test";
import assert from "node:assert/strict";
import {
  validateRlsStagingEnvironment, verifySyntheticCrossTenantRls,
} from "../src/operations/staging-rls-policy.mjs";

const STAGING = "a".repeat(20);
const EXCLUDED = "b".repeat(20);
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EPISODE_A = "e1000000-0000-4000-8000-000000000001";
const EPISODE_B = "e2000000-0000-4000-8000-000000000002";
const JWT_A = "testA.userA.signatureA";
const JWT_B = "testB.userB.signatureB";
const JWT_EXPIRED = "testExpired." + Buffer.from(JSON.stringify({ exp: 1 })).toString("base64url") + ".syntheticSignature";

function good() {
  return {
    STAGING_ENVIRONMENT: "staging",
    STAGING_OPERATOR_APPROVED: "YES",
    STAGING_NO_REAL_PATIENTS: "YES",
    STAGING_ALLOW_NETWORK: "YES",
    STAGING_PROJECT_REF: STAGING,
    STAGING_URL: `https://${STAGING}.supabase.co`,
    STAGING_FORBIDDEN_PROJECT_REFS: EXCLUDED,
    STAGING_PUBLISHABLE_KEY: "sb_publishable_" + "x".repeat(30),
    STAGING_RLS_E2E: "YES",
    STAGING_SYNTHETIC_FIXTURES: "YES",
    STAGING_USER_A_ID: USER_A,
    STAGING_USER_B_ID: USER_B,
    STAGING_ORGANIZATION_A_ID: ORG_A,
    STAGING_ORGANIZATION_B_ID: ORG_B,
    STAGING_EPISODE_A_ID: EPISODE_A,
    STAGING_EPISODE_B_ID: EPISODE_B,
    STAGING_USER_A_JWT: JWT_A,
    STAGING_USER_B_JWT: JWT_B,
    STAGING_EXPIRED_USER_JWT: JWT_EXPIRED,
  };
}

function permittedResponses() {
  return [
    { status: 200, body: { id: USER_A, is_anonymous: false } },
    { status: 200, body: { id: USER_B, is_anonymous: false } },
    { status: 200, body: [{ id: EPISODE_A, organization_id: ORG_A }] },
    { status: 200, body: [] },
    { status: 200, body: [{ id: EPISODE_B, organization_id: ORG_B }] },
    { status: 200, body: [] },
    { status: 200, body: [] },
    { status: 401 },
  ];
}

function mockFetch(responses, calls) {
  return async (url, options) => {
    calls.push({ url, options });
    const response = responses[calls.length - 1];
    if (!response) throw Error("unexpected additional request");
    return { status: response.status, json: async () => response.body };
  };
}

test("STAGING-01B requires independent refs, two distinct synthetic users and explicit opt-in", () => {
  assert.equal(validateRlsStagingEnvironment(good(), {live: true}).ok, true);
  for (const env of [
    { ...good(), STAGING_RLS_E2E: "NO" },
    { ...good(), STAGING_SYNTHETIC_FIXTURES: "NO" },
    { ...good(), STAGING_ALLOW_NETWORK: "" },
    { ...good(), STAGING_PROJECT_REF: EXCLUDED, STAGING_URL: `https://${EXCLUDED}.supabase.co` },
    { ...good(), STAGING_USER_B_ID: USER_A },
    { ...good(), STAGING_ORGANIZATION_B_ID: ORG_A },
    { ...good(), STAGING_EPISODE_B_ID: EPISODE_A },
    { ...good(), STAGING_USER_B_JWT: JWT_A },
    { ...good(), STAGING_EXPIRED_USER_JWT: JWT_B },
    { ...good(), STAGING_USER_A_JWT: "sb_secret_wrong" },
    { ...good(), STAGING_EXPIRED_USER_JWT: "random.header.signature" },
    { ...good(), STAGING_USER_A_ID: "not-a-uuid" },
  ]) {
    assert.equal(validateRlsStagingEnvironment(env,{live:true}).ok,false);
  }
});

test("STAGING-01B denies all network traffic until all opt-ins and fixtures exist", async () => {
  let calls=0;
  await assert.rejects(
    verifySyntheticCrossTenantRls({ ...good(), STAGING_RLS_E2E: "" },
      async () => { calls++; throw Error("must not call"); }),
    { code:"STAGING_RLS_CONFIG_REJECTED" },
  );
  assert.equal(calls,0);
});

test("STAGING-01B proves two nonempty own rows and two-way cross-tenant denial", async () => {
  const calls=[];
  const result=await verifySyntheticCrossTenantRls(good(),mockFetch(permittedResponses(),calls));
  assert.equal(result.ownRows,"TWO_NONEMPTY_ROWS_VERIFIED");
  assert.equal(result.crossTenant,"BOTH_DIRECTIONS_DENIED");
  assert.equal(result.expiredToken,"DENIED");
  assert.equal(calls.length,8);
  for(const {url,options} of calls) {
    assert.ok(url.startsWith(good().STAGING_URL+"/"));
    assert.equal(options.method,"GET");
    assert.equal(options.cache,"no-store");
    assert.equal(options.redirect,"error");
    assert.equal(options.body,undefined);
    assert.ok(!url.includes("patient"));
    assert.ok(!url.includes("token"));
    assert.ok(!("service_role" in options.headers));
  }
  assert.equal(calls[6].options.headers.authorization,undefined);
  assert.equal(calls[7].options.headers.authorization,"Bearer "+JWT_EXPIRED);
  assert.ok(calls[2].url.includes("select=id,organization_id"));
});

test("STAGING-01B rejects nonempty cross-org visibility", async () => {
  const responses=permittedResponses();
  responses[3]={status:200,body:[{id:EPISODE_B,organization_id:ORG_B}]};
  await assert.rejects(
    verifySyntheticCrossTenantRls(good(),mockFetch(responses,[])),
    {code:"STAGING_RLS_CROSS_A_TO_B_LEAK"},
  );
  const reverse=permittedResponses();
  reverse[5]={status:200,body:[{id:EPISODE_A,organization_id:ORG_A}]};
  await assert.rejects(
    verifySyntheticCrossTenantRls(good(),mockFetch(reverse,[])),
    {code:"STAGING_RLS_CROSS_B_TO_A_LEAK"},
  );
});

test("STAGING-01B does not accept empty or wrong-organization own rows", async () => {
  const responses=permittedResponses();
  responses[2]={status:200,body:[]};
  await assert.rejects(
    verifySyntheticCrossTenantRls(good(),mockFetch(responses,[])),
    {code:"STAGING_RLS_OWN_A_NOT_VISIBLE_OR_WRONG_ORGANIZATION"},
  );
  const wrong=permittedResponses();
  wrong[4]={status:200,body:[{id:EPISODE_B,organization_id:ORG_A}]};
  await assert.rejects(
    verifySyntheticCrossTenantRls(good(),mockFetch(wrong,[])),
    {code:"STAGING_RLS_OWN_B_NOT_VISIBLE_OR_WRONG_ORGANIZATION"},
  );
});

test("STAGING-01B blocks auth mismatch, extra clinical fields and anonymous data exposure", async () => {
  const wrongAuth=permittedResponses();
  wrongAuth[0]={status:200,body:{id:USER_B,is_anonymous:false}};
  await assert.rejects(
    verifySyntheticCrossTenantRls(good(),mockFetch(wrongAuth,[])),
    {code:"STAGING_AUTH_USER_ID_MISMATCH"},
  );
  const leaked=permittedResponses();
  leaked[2]={status:200,body:[{id:EPISODE_A,organization_id:ORG_A,patient_id:"forbidden"}]};
  await assert.rejects(
    verifySyntheticCrossTenantRls(good(),mockFetch(leaked,[])),
    {code:"STAGING_RLS_UNEXPECTED_DATA_SHAPE"},
  );
  const anon=permittedResponses();
  anon[6]={status:200,body:[{id:EPISODE_A,organization_id:ORG_A}]};
  await assert.rejects(
    verifySyntheticCrossTenantRls(good(),mockFetch(anon,[])),
    {code:"STAGING_RLS_ANONYMOUS_EPISODE_VISIBLE"},
  );
});

test("STAGING-01B does not treat expired access JWT or unauthenticated own rows as success", async () => {
  const expired=permittedResponses();
  expired[7]={status:200,body:{id:USER_A}};
  await assert.rejects(
    verifySyntheticCrossTenantRls(good(),mockFetch(expired,[])),
    {code:"STAGING_EXPIRED_JWT_STILL_ACCEPTED"},
  );
  const failedOwn=permittedResponses();
  failedOwn[2]={status:401};
  await assert.rejects(
    verifySyntheticCrossTenantRls(good(),mockFetch(failedOwn,[])),
    {code:"STAGING_RLS_REST_REQUEST_DENIED_OR_UNAVAILABLE"},
  );
});
