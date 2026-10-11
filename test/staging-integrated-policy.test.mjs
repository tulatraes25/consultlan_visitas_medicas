import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  STAGING_01F_EXPECTED_REQUESTS, STAGING_01F_PHASES,
  validateIntegratedStagingEnvironment, verifyIntegratedStagingBoundaries,
} from "../src/operations/staging-integrated-policy.mjs";
import { DIRECT_READ_TABLES } from "../src/operations/staging-rls-policy.mjs";

const ref="a".repeat(20), forbidden="b".repeat(20);
const userA="11111111-1111-4111-8111-111111111111";
const userB="22222222-2222-4222-8222-222222222222";
const orgA="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const orgB="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const epiA="e1000000-0000-4000-8000-000000000001";
const epiB="e3000000-0000-4000-8000-000000000003";
const sidLive="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sidRevoke="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sidExpired="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const now=()=>Math.floor(Date.now()/1000);
const jwt=(user,sid,exp)=>[
  Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url"),
  Buffer.from(JSON.stringify({
    sub:user,session_id:sid,role:"authenticated",exp,
  })).toString("base64url"),
  "synthetic_signature",
].join(".");

function environment(){
  const active=jwt(userA,sidLive,now()+3600);
  const expired=jwt(userA,sidExpired,1);
  return {
    STAGING_ENVIRONMENT:"staging",
    STAGING_OPERATOR_APPROVED:"YES",
    STAGING_NO_REAL_PATIENTS:"YES",
    STAGING_ALLOW_NETWORK:"YES",
    STAGING_PROJECT_REF:ref, STAGING_URL:`https://${ref}.supabase.co`,
    STAGING_FORBIDDEN_PROJECT_REFS:forbidden,
    STAGING_PUBLISHABLE_KEY:"sb_publishable_"+"x".repeat(30),
    STAGING_OPERATOR_PROJECT_IDENTITY_VERIFIED:"YES",
    STAGING_RLS_E2E:"YES",
    STAGING_SYNTHETIC_FIXTURES:"YES",
    STAGING_USER_A_ID:userA, STAGING_USER_B_ID:userB,
    STAGING_ORGANIZATION_A_ID:orgA, STAGING_ORGANIZATION_B_ID:orgB,
    STAGING_EPISODE_A_ID:epiA, STAGING_EPISODE_B_ID:epiB,
    STAGING_USER_A_JWT:active,
    STAGING_USER_B_JWT:jwt(userB,sidLive,now()+3600),
    STAGING_EXPIRED_USER_JWT:expired,
    STAGING_SESSION_E2E:"YES",
    STAGING_SESSION_REVOCATION_CONFIRMED:"YES",
    STAGING_SESSION_USER_ID:userA,
    STAGING_SESSION_ACTIVE_JWT:active,
    STAGING_SESSION_REVOKED_JWT:jwt(userA,sidRevoke,now()+3600),
    STAGING_SESSION_EXPIRED_JWT:expired,
  };
}
const reply=(status,body)=>({status,body});
function responses(){
  return [
    // 01A: anonymous lookup and unknown action denied.
    reply(403,null), reply(401,null),
    // 01B: 2 Auth, 4 allowed read-only Edge scoped replies.
    reply(200,{id:userA,is_anonymous:false}),
    reply(200,{id:userB,is_anonymous:false}),
    reply(200,{ok:true,result:[{id:epiA,organization_id:orgA}]}),
    reply(200,{ok:true,result:[]}),
    reply(200,{ok:true,result:[{id:epiB,organization_id:orgB}]}),
    reply(200,{ok:true,result:[]}),
    reply(401,null), reply(401,null),
    ...DIRECT_READ_TABLES.map(()=>reply(403,null)),
    // 01C: Auth allows signed-but-revoked JWT; Edge checks live session.
    reply(200,{id:userA,is_anonymous:false}),
    reply(200,{id:userA,is_anonymous:false}),
    reply(422,{error:"INVALID_OPERATION_OR_FIELDS"}),
    reply(401,null), reply(401,null), reply(401,null),
  ];
}
function fakeFetch(replies,calls,sideEffect=()=>{}){
  return async (url,options)=>{
    calls.push({url,options});
    sideEffect(calls.length);
    const next=replies[calls.length-1];
    if(!next)throw Error("Synthetic test should never add transport calls");
    return {status:next.status,json:async()=>next.body};
  };
}

test("STAGING-01F binds both suites to exact same active user A and expired token",()=>{
  const env=environment();
  assert.equal(validateIntegratedStagingEnvironment(env,{live:true}).ok,true);
  assert.equal(STAGING_01F_EXPECTED_REQUESTS,30);
  assert.equal(STAGING_01F_PHASES.length,3);
  const mutations=[
    {STAGING_ALLOW_NETWORK:"NO"},
    {STAGING_OPERATOR_PROJECT_IDENTITY_VERIFIED:"NO"},
    {STAGING_PROJECT_REF:forbidden,STAGING_URL:`https://${forbidden}.supabase.co`},
    {STAGING_PUBLISHABLE_KEY:"sb_secret_"+"x".repeat(30)},
    {STAGING_RLS_E2E:"NO"},
    {STAGING_SESSION_E2E:"NO"},
    {STAGING_SESSION_REVOCATION_CONFIRMED:"NO"},
    {STAGING_NO_REAL_PATIENTS:"NO"},
    {STAGING_USER_B_ID:userA},
    {STAGING_SESSION_USER_ID:userB},
    {STAGING_SESSION_ACTIVE_JWT:jwt(userA,sidLive,now()+3660)},
    {STAGING_SESSION_EXPIRED_JWT:jwt(userA,sidExpired,2)},
  ];
  for(const change of mutations){
    assert.equal(validateIntegratedStagingEnvironment(
      {...env,...change},{live:true}).ok,false);
  }
  for(const issue of validateIntegratedStagingEnvironment(
    {...env,STAGING_SESSION_USER_ID:userB},{live:true}).issues){
    assert.doesNotMatch(issue,/sb_publishable|eyJ|supabase\.co|11111111/);
  }
});

test("STAGING-01F performs exactly 30 minimal requests, to ONE staging origin",async()=>{
  const env=environment();
  const calls=[];
  const result=await verifyIntegratedStagingBoundaries(env,
    fakeFetch(responses(),calls));
  assert.equal(calls.length,30);
  assert.equal(result.result,"STAGING_01F_NETWORK_BOUNDARIES_PASS_NOT_CERTIFICATION");
  assert.deepEqual(result.steps,STAGING_01F_PHASES);
  assert.equal(result.expectedRequestCount,30);
  for(const property of [
    "remoteSqlCatalogVerified",
    "remoteMigrationHistoryVerified",
    "institutionalProjectOwnershipVerified",
    "clinicallyReady",
  ]) assert.equal(result[property],false);
  assert.doesNotMatch(JSON.stringify(result),/supabase\.co|sb_publishable|eyJ|11111111/);
  for(const {url,options} of calls){
    assert.ok(url.startsWith(env.STAGING_URL+"/"));
    assert.equal(options.redirect,"error");
    assert.equal(options.cache,"no-store");
    assert.equal(options.headers.apikey,env.STAGING_PUBLISHABLE_KEY);
    assert.ok(["GET","POST"].includes(options.method));
    assert.ok(!url.includes("access_token") && !url.includes("password"));
    assert.ok(!url.includes("/storage/"));
    if(url.includes("/rest/v1/patients")) {
      assert.equal(url,env.STAGING_URL+"/rest/v1/patients?select=*&limit=0");
      assert.equal(options.method,"GET");
    }
    if(options.method==="POST"){
      assert.ok(url.endsWith("/functions/v1/visits"));
      const body=JSON.parse(options.body);
      assert.ok([
        "__negative_staging_auth_probe__",
        "__staging_session_negative_only__",
        "inspectMyHomecareEpisodeScope",
      ].includes(body.action));
      assert.ok(Object.keys(body).every(k=>["action","episodeId"].includes(k)));
    }
  }
  for(const i of [0,1,8,29])assert.equal(
    calls[i].options.headers.authorization,undefined);
  assert.equal(calls[2].options.headers.authorization,"Bearer "+env.STAGING_USER_A_JWT);
  assert.equal(calls[24].options.headers.authorization,"Bearer "+env.STAGING_SESSION_ACTIVE_JWT);
  assert.equal(calls[25].options.headers.authorization,"Bearer "+env.STAGING_SESSION_REVOKED_JWT);
});

test("STAGING-01F rejects absent opt-in before ANY transport call",async()=>{
  let calls=0;
  await assert.rejects(verifyIntegratedStagingBoundaries(
    {...environment(),STAGING_OPERATOR_PROJECT_IDENTITY_VERIFIED:""},
    async()=>{calls++;throw Error("must not call network");}
  ),{code:"STAGING_01F_CONFIG_REJECTED"});
  assert.equal(calls,0);
});

test("STAGING-01F fails early on a cross-organization leak",async()=>{
  const replies=responses();
  // 2 initial anonymous + 2 Auth + own A = index 6: cross A->B.
  replies[5]=reply(200,{ok:true,result:[{id:epiB,organization_id:orgB}]});
  const calls=[];
  await assert.rejects(verifyIntegratedStagingBoundaries(
    environment(),fakeFetch(replies,calls)),{code:"STAGING_SCOPE_CROSS_A_TO_B_LEAK"});
  assert.equal(calls.length,6);
});

test("STAGING-01F cannot pass when revoked token still reaches Edge",async()=>{
  const replies=responses();
  replies[27]=reply(422,{error:"INVALID_OPERATION_OR_FIELDS"});
  const calls=[];
  await assert.rejects(verifyIntegratedStagingBoundaries(
    environment(),fakeFetch(replies,calls)),{code:"STAGING_SESSION_REVOKED_JWT_NOT_DENIED"});
  assert.equal(calls.length,28);
});

test("STAGING-01F freezes input target and tokens for all phases",async()=>{
  const env=environment();
  const original=environment();
  const calls=[];
  await verifyIntegratedStagingBoundaries(env,fakeFetch(
    responses(),calls,number=>{
      if(number===1){
        env.STAGING_URL="https://production.example.com";
        env.STAGING_PROJECT_REF="not-staging";
        env.STAGING_USER_A_JWT="changed";
      }
    }
  ));
  assert.equal(calls.length,30);
  assert.ok(calls.every(call=>call.url.startsWith(original.STAGING_URL+"/")));
  assert.equal(calls[2].options.headers.authorization,
    "Bearer "+original.STAGING_USER_A_JWT);
});

test("STAGING-01F CLI defaults offline and never logs missing secrets",()=>{
  const run=(args,env={})=>spawnSync(process.execPath,
    ["scripts/staging-integrated-verify.mjs",...args],{
      encoding:"utf8",timeout:7000,
      env:{PATH:process.env.PATH,HOME:process.env.HOME,...env},
    });
  const ci=run(["--ci"]);
  assert.equal(ci.status,0,ci.stderr);
  assert.equal(ci.stdout.trim(),"STAGING01F_OFFLINE_CONTRACT_PASS_REMOTE_UNVERIFIED");
  for(const args of [
    ["--check-env"],["--probe"],["--probe","secret"],["--ci","extra"],
  ]){
    const result=run(args,{STAGING_URL:"do-not-print-me",
      STAGING_PUBLISHABLE_KEY:"sb_secret_DO_NOT_ECHO"});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/STAGING01F_BLOCKED:/);
    assert.doesNotMatch(result.stderr,/do-not-print-me|DO_NOT_ECHO|supabase\.co/);
  }
});
