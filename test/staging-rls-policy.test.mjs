import test from "node:test";
import assert from "node:assert/strict";
import {
  DIRECT_READ_TABLES, validateRlsStagingEnvironment,
  verifySyntheticCrossTenantRls,
} from "../src/operations/staging-rls-policy.mjs";

const STAGING="a".repeat(20);
const EXCLUDED="b".repeat(20);
const USER_A="11111111-1111-4111-8111-111111111111";
const USER_B="22222222-2222-4222-8222-222222222222";
const ORG_A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EPISODE_A="e1000000-0000-4000-8000-000000000001";
const EPISODE_B="e3000000-0000-4000-8000-000000000003";
const JWT_A="testA.userA.signatureA";
const JWT_B="testB.userB.signatureB";
const JWT_EXPIRED="testExpired."+
  Buffer.from(JSON.stringify({exp:1})).toString("base64url")+
  ".syntheticSignature";

function good() {
  return {
    STAGING_ENVIRONMENT:"staging",
    STAGING_OPERATOR_APPROVED:"YES",
    STAGING_NO_REAL_PATIENTS:"YES",
    STAGING_ALLOW_NETWORK:"YES",
    STAGING_PROJECT_REF:STAGING,
    STAGING_URL:`https://${STAGING}.supabase.co`,
    STAGING_FORBIDDEN_PROJECT_REFS:EXCLUDED,
    STAGING_PUBLISHABLE_KEY:"sb_publishable_"+"x".repeat(30),
    STAGING_RLS_E2E:"YES",STAGING_SYNTHETIC_FIXTURES:"YES",
    STAGING_USER_A_ID:USER_A,STAGING_USER_B_ID:USER_B,
    STAGING_ORGANIZATION_A_ID:ORG_A,STAGING_ORGANIZATION_B_ID:ORG_B,
    STAGING_EPISODE_A_ID:EPISODE_A,STAGING_EPISODE_B_ID:EPISODE_B,
    STAGING_USER_A_JWT:JWT_A,STAGING_USER_B_JWT:JWT_B,
    STAGING_EXPIRED_USER_JWT:JWT_EXPIRED,
  };
}
function reply(status,body) {return {status,body};}
function permittedResponses() {
  return [
    reply(200,{id:USER_A,is_anonymous:false}),
    reply(200,{id:USER_B,is_anonymous:false}),
    reply(200,{ok:true,result:[{id:EPISODE_A,organization_id:ORG_A}]}),
    reply(200,{ok:true,result:[]}),
    reply(200,{ok:true,result:[{id:EPISODE_B,organization_id:ORG_B}]}),
    reply(200,{ok:true,result:[]}),
    reply(401,null), // Anonymous Edge POST must fail.
    reply(401,null), // Expired JWT must be rejected by Supabase Auth.
    ...DIRECT_READ_TABLES.map(() => reply(403,null)),
  ];
}
function mockFetch(responses,calls) {
  return async (url,options) => {
    calls.push({url,options});
    const response=responses[calls.length-1];
    if(!response)throw Error("unexpected additional network call");
    return {status:response.status,json:async()=>response.body};
  };
}

test("SEC-READ-02B requires isolated project, distinct users/orgs/episodes and opt-in",()=>{
  assert.equal(DIRECT_READ_TABLES.length,14);
  assert.equal(new Set(DIRECT_READ_TABLES).size,14);
  assert.equal(DIRECT_READ_TABLES.includes("homecare_episodes"),true);
  assert.equal(validateRlsStagingEnvironment(good(),{live:true}).ok,true);
  for (const env of [
    {...good(),STAGING_RLS_E2E:"NO"},
    {...good(),STAGING_SYNTHETIC_FIXTURES:"NO"},
    {...good(),STAGING_ALLOW_NETWORK:""},
    {...good(),STAGING_ENVIRONMENT:"production"},
    {...good(),STAGING_PROJECT_REF:EXCLUDED,STAGING_URL:`https://${EXCLUDED}.supabase.co`},
    {...good(),STAGING_USER_B_ID:USER_A},
    {...good(),STAGING_ORGANIZATION_B_ID:ORG_A},
    {...good(),STAGING_EPISODE_B_ID:EPISODE_A},
    {...good(),STAGING_USER_B_JWT:JWT_A},
    {...good(),STAGING_EXPIRED_USER_JWT:JWT_B},
    {...good(),STAGING_USER_A_JWT:"sb_secret_wrong"},
    {...good(),STAGING_EXPIRED_USER_JWT:"random.header.signature"},
    {...good(),STAGING_USER_A_ID:"not-a-uuid"},
  ]) {
    assert.equal(validateRlsStagingEnvironment(env,{live:true}).ok,false);
  }
});
test("No opt-in means zero requests",async()=>{
  let calls=0;
  await assert.rejects(verifySyntheticCrossTenantRls(
    {...good(),STAGING_RLS_E2E:""},async()=>{calls++;throw Error("must not call");}
  ),{code:"STAGING_RLS_CONFIG_REJECTED"});
  assert.equal(calls,0);
});
test("Exactly 22 fixed, non-mutating requests prove tenant scope and direct table denial",async()=>{
  const calls=[];
  const result=await verifySyntheticCrossTenantRls(good(),
    mockFetch(permittedResponses(),calls));
  assert.equal(result.ownRows,"TWO_NONEMPTY_EDGE_ROWS_VERIFIED");
  assert.equal(result.crossTenant,"BOTH_DIRECTIONS_DENIED_BY_SQL_SCOPE");
  assert.equal(result.directTables,"FOURTEEN_DENIED_FOR_JWT_ROLE");
  assert.equal(calls.length,22);
  for (const {url,options} of calls) {
    assert.ok(url.startsWith(good().STAGING_URL+"/"));
    assert.equal(options.cache,"no-store");
    assert.equal(options.redirect,"error");
    assert.equal(options.headers.apikey,good().STAGING_PUBLISHABLE_KEY);
    assert.ok(!("service_role" in options.headers));
    assert.ok(!url.includes("access_token"));
    assert.ok(!url.includes("Bearer"));
    if (url.includes("/functions/v1/visits")) {
      assert.equal(options.method,"POST");
      const action=JSON.parse(options.body);
      assert.deepEqual(Object.keys(action).sort(),["action","episodeId"]);
      assert.equal(action.action,"inspectMyHomecareEpisodeScope");
      assert.ok([EPISODE_A,EPISODE_B].includes(action.episodeId));
    } else {
      assert.equal(options.method,"GET");
      assert.equal(options.body,undefined);
    }
  }
  assert.equal(calls[0].url,good().STAGING_URL+"/auth/v1/user");
  assert.equal(calls[1].url,good().STAGING_URL+"/auth/v1/user");
  assert.equal(calls[6].options.headers.authorization,undefined);
  assert.equal(calls[7].options.headers.authorization,"Bearer "+JWT_EXPIRED);
  for (const [i,table] of DIRECT_READ_TABLES.entries()) {
    const call=calls[i+8];
    assert.equal(call.url,`${good().STAGING_URL}/rest/v1/${table}?select=*&limit=0`);
    assert.equal(call.options.headers.authorization,"Bearer "+JWT_A);
    assert.equal(call.options.method,"GET");
  }
});

test("Both directions reject cross-organization episode visibility",async()=>{
  const first=permittedResponses();
  first[3]=reply(200,{ok:true,result:[{id:EPISODE_B,organization_id:ORG_B}]});
  await assert.rejects(verifySyntheticCrossTenantRls(good(),mockFetch(first,[])),
    {code:"STAGING_SCOPE_CROSS_A_TO_B_LEAK"});
  const reverse=permittedResponses();
  reverse[5]=reply(200,{ok:true,result:[{id:EPISODE_A,organization_id:ORG_A}]});
  await assert.rejects(verifySyntheticCrossTenantRls(good(),mockFetch(reverse,[])),
    {code:"STAGING_SCOPE_CROSS_B_TO_A_LEAK"});
});

test("Own synthetic episodes must exist and carry the expected organization",async()=>{
  for(const [position,bad] of [
    [2,reply(200,{ok:true,result:[]})],
    [4,reply(200,{ok:true,result:[{id:EPISODE_B,organization_id:ORG_A}]})],
  ]) {
    const responses=permittedResponses();
    responses[position]=bad;
    const code=position===2
      ?"STAGING_SCOPE_OWN_A_NOT_VISIBLE_OR_WRONG_ORGANIZATION"
      :"STAGING_SCOPE_OWN_B_NOT_VISIBLE_OR_WRONG_ORGANIZATION";
    await assert.rejects(verifySyntheticCrossTenantRls(good(),mockFetch(responses,[])),{code});
  }
});

test("Reject forged Auth identity, excessive Edge keys and untrusted response envelopes",async()=>{
  const badIdentity=permittedResponses();
  badIdentity[0]=reply(200,{id:USER_B,is_anonymous:false});
  await assert.rejects(verifySyntheticCrossTenantRls(good(),mockFetch(badIdentity,[])),
    {code:"STAGING_AUTH_USER_ID_MISMATCH"});
  for(const bad of [
    [{id:EPISODE_A,organization_id:ORG_A}], // No authenticated Edge envelope.
    {ok:true,result:[{id:EPISODE_A,organization_id:ORG_A,patient_id:"forbidden"}]},
    {ok:true,result:[{id:EPISODE_A,organization_id:ORG_A}],secret:"leak"},
    {ok:false,result:[{id:EPISODE_A,organization_id:ORG_A}]},
    {ok:true,result:{id:EPISODE_A,organization_id:ORG_A}},
    {ok:true,result:[{id:EPISODE_A,organization_id:ORG_A},{id:EPISODE_A,organization_id:ORG_A}]},
  ]) {
    const responses=permittedResponses();
    responses[2]=reply(200,bad);
    await assert.rejects(verifySyntheticCrossTenantRls(good(),mockFetch(responses,[])),
      {code:"STAGING_SCOPE_UNEXPECTED_DATA_SHAPE"});
  }
});

test("Anonymous Edge, expired Auth, and non-200 successful-looking cases are blocked",async()=>{
  const anon=permittedResponses();
  anon[6]=reply(200,{ok:true,result:[]});
  await assert.rejects(verifySyntheticCrossTenantRls(good(),mockFetch(anon,[])),
    {code:"STAGING_SCOPE_ANONYMOUS_NOT_DENIED"});
  const expired=permittedResponses();
  expired[7]=reply(200,{id:USER_A});
  await assert.rejects(verifySyntheticCrossTenantRls(good(),mockFetch(expired,[])),
    {code:"STAGING_EXPIRED_JWT_STILL_ACCEPTED"});
  const deniedOwn=permittedResponses();
  deniedOwn[2]=reply(401,{error:"not authorized"});
  await assert.rejects(verifySyntheticCrossTenantRls(good(),mockFetch(deniedOwn,[])),
    {code:"STAGING_SCOPE_EDGE_DENIED_OR_UNAVAILABLE"});
});

test("Even empty or zero-row direct PostgREST 200 MUST fail, for every table",async()=>{
  for(let i=0;i<DIRECT_READ_TABLES.length;i++) {
    const responses=permittedResponses();
    responses[8+i]=reply(200,[]);
    await assert.rejects(verifySyntheticCrossTenantRls(good(),mockFetch(responses,[])),
      {code:"STAGING_DIRECT_TABLE_JWT_ACCESS_NOT_DENIED"});
  }
});

test("Network errors and missing HTTP response do not leak upstream details",async()=>{
  await assert.rejects(verifySyntheticCrossTenantRls(good(),async()=>{
    throw Error("upstream raw server secret should never be printed");
  }),{code:"STAGING_RLS_TRANSPORT_FAILED"});
});
