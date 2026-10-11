import { createVisitHandler, type TrustedServices } from "./handler.ts";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT = "aaaa0000-0000-4000-8000-000000000001";
const PROFESSIONAL = "1111aaaa-0000-4000-8000-000000000001";
const VISIT = "1111bbbb-0000-4000-8000-000000000001";
const REQUEST = "12340000-0000-4000-8000-000000000002";
const JWT = "synthetic.header.signature";
const TOKEN = "Bearer " + JWT;

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}
function equal(actual: unknown, expected: unknown, detail: string): void {
  if (actual !== expected) throw new Error(detail + " (actual " + String(actual) + ")");
}
const patientBody = {
  action: "createPatient",
  organizationId: ORG,
  displayName: "Paciente ficticio de CI",
  requestKey: REQUEST,
};
type Recorded = { rpc: string; args: Record<string, unknown> };
function harness(overrides: Partial<TrustedServices> = {}) {
  const calls: Recorded[] = [];
  const services: TrustedServices = {
    authenticate: async (token) => token === JWT ? ACTOR : null,
    command: async (rpc, args) => {
      calls.push({ rpc, args });
      return { ok: true, data: "synthetic-result" };
    },
    ...overrides,
  };
  return { handle: createVisitHandler(services), calls };
}
function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.invalid/functions/v1/visits", {
    method: "POST",
    headers: {
      authorization: TOKEN,
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

Deno.test("rejects missing JWT, api-key bearer and unsupported method before side effects", async () => {
  const h = harness();
  const missing = await h.handle(post(patientBody, { authorization: "" }));
  equal(missing.status, 401, "missing JWT must fail");
  const wrong = await h.handle(post(patientBody, { authorization: "Bearer sb_publishable_fake" }));
  equal(wrong.status, 401, "publishable API keys are not user JWTs");
  const get = await h.handle(new Request("https://example.invalid/functions/v1/visits"));
  equal(get.status, 405, "non-POST method forbidden");
  equal(h.calls.length, 0, "no operation can execute without accepted method/session");
});

Deno.test("verified Auth user ID is injected; client actor or role spoofing is rejected", async () => {
  const h = harness();
  const ok = await h.handle(post(patientBody));
  equal(ok.status, 200, "valid synthetic route");
  equal(h.calls.length, 1, "must call once");
  equal(h.calls[0].rpc, "api_create_patient", "exact SQL allowlisted operation");
  equal(h.calls[0].args.p_actor, ACTOR, "actor always derived from auth verifier");
  equal(h.calls[0].args.p_org, ORG, "org forwarded after UUID validation");

  const withActor = await h.handle(post({ ...patientBody, p_actor: PROFESSIONAL }));
  equal(withActor.status, 422, "caller cannot supply p_actor");
  const withRole = await h.handle(post({ ...patientBody, appRole: "ADMIN" }));
  equal(withRole.status, 422, "caller cannot supply privileged role");
  equal(h.calls.length, 1, "spoofing must not reach data layer");
});

Deno.test("does not trust any JWT that Auth did not verify", async () => {
  const h = harness({ authenticate: async () => null });
  const response = await h.handle(post(patientBody));
  equal(response.status, 401, "revoked/invalid token rejected");
  equal(h.calls.length, 0, "database not reached");
  const failedAuth = harness({ authenticate: async () => { throw Error("synthetic auth outage"); } });
  const unavailable = await failedAuth.handle(post(patientBody));
  equal(unavailable.status, 503, "authentication outage is not a bypass");
});

Deno.test("rejects extra fields, wrong types, malformed JSON and unknown operations", async () => {
  const h = harness();
  const cases: unknown[] = [
    { ...patientBody, displayName: "" },
    { ...patientBody, organizationId: "other-org" },
    { ...patientBody, requestKey: 10 },
    { ...patientBody, service_role: "stolen" },
    { ...patientBody, action: "closeVerified" },
    { ...patientBody, action: "api_delete_audit_logs" },
    [patientBody],
  ];
  for (const body of cases) {
    const response = await h.handle(post(body));
    equal(response.status, 422, "invalid operation/field rejected");
  }
  const invalidJson = await h.handle(post("{unparsable"));
  equal(invalidJson.status, 400, "invalid JSON rejected");
  const badType = await h.handle(post(patientBody, { "content-type": "text/plain" }));
  equal(badType.status, 415, "JSON content type required");
  equal(h.calls.length, 0, "invalid input cannot reach database");
});

Deno.test("large streamed payload rejected before business processing", async () => {
  const h = harness();
  const large = { ...patientBody, displayName: "X".repeat(40000) };
  const response = await h.handle(post(large));
  equal(response.status, 413, "large request must be blocked");
  equal(h.calls.length, 0, "large body cannot reach RPC");
});

Deno.test("safe administrative provisioning commands use exact SQL RPC and verified actor", async () => {
  const h = harness();
  const routes = [
    ["createPatient", { organizationId: ORG, displayName: "Paciente ficticio de CI", requestKey: REQUEST }, "api_create_patient"],
    ["registerProfessional", { organizationId: ORG, authUserId: ACTOR, specialty: "Enfermería" }, "api_register_professional"],
  ] as const;
  for (const [action, fields, rpc] of routes) {
    const response = await h.handle(post({ action, ...fields }));
    equal(response.status, 200, "synthetic administrative route");
    equal(h.calls[h.calls.length - 1].rpc, rpc, "fixed operation mapping");
    equal(h.calls[h.calls.length - 1].args.p_actor, ACTOR, "verified identity from Auth");
  }
  equal(h.calls.length, routes.length, "only expected administrative RPCs dispatched");
});

Deno.test("SQL errors map to safe HTTP outcomes without leaking clinical text", async () => {
  for (const [sqlCode, status] of [
    ["42501", 403], ["23505", 409], ["23P01", 409], ["22023", 422],
    ["99999", 502],
  ] as const) {
    const h = harness({ command: async () => ({ ok: false, code: sqlCode }) });
    const response = await h.handle(post(patientBody));
    equal(response.status, status, "expected safe SQL error mapping");
    const serialized = await response.text();
    assert(!serialized.includes(sqlCode), "raw SQLSTATE must not be disclosed");
    assert(!serialized.includes(patientBody.displayName), "patient name must not be echoed");
    equal(response.headers.get("cache-control"), "no-store", "must prohibit caching");
  }
  const h = harness({ command: async () => { throw Error("Secret backend address"); } });
  const outage = await h.handle(post(patientBody));
  equal(outage.status, 502, "backend outage must fail closed");
  assert(!(await outage.text()).includes("Secret backend address"), "no backend error leaks");
});

Deno.test("SUPA-04 blocks obsolete clinical actions at Edge even with seemingly valid arguments", async () => {
  const h = harness();
  const obsolete = [
    "scheduleVisit", "beginVisit", "addClinicalNote",
    "submitVisitReview", "cancelVisit",
    "approveHomecareCarePlan", "activateHomecareEpisode",
  ];
  for (const action of obsolete) {
    const response = await h.handle(post({
      action,
      organizationId: ORG,
      patientId: PATIENT,
      professionalId: PROFESSIONAL,
      visitId: VISIT,
      scheduledStart: "2026-10-11T10:00:00Z",
      scheduledEnd: "2026-10-11T11:00:00Z",
      narrative: "Texto de muestra",
      reasonCode: "OTHER",
      requestKey: REQUEST,
    }));
    equal(response.status, 422, action + " must be absent from Edge allowlist");
  }
  equal(h.calls.length, 0, "retired clinical actions cannot reach any RPC");
});

Deno.test("HC-02B operations preserve verified actor and dispatch only fixed RPC names", async () => {
  const e = "e1000000-0000-4000-8000-000000000001";
  const out = "d1000000-0000-4000-8000-000000000002";
  const incoming = "d1000000-0000-4000-8000-000000000003";
  const handover = "f1000000-0000-4000-8000-000000000001";
  const pairs = [
    ["createHomecareEpisodeDraft",
      { organizationId: ORG, patientId: PATIENT, requestKey: REQUEST },
      "api_hc_create_episode_draft"],
    ["assignHomecareCareTeamMember",
      { organizationId: ORG, episodeId: e, professionalId: PROFESSIONAL },
      "api_hc_assign_team_member"],
    ["createHomecarePlanDraft",
      { organizationId: ORG, episodeId: e, requestKey: REQUEST },
      "api_hc_create_plan_draft"],
    ["scheduleHomecareCoverage",
      { organizationId: ORG, episodeId: e, professionalId: PROFESSIONAL,
        carePlanVersion: 1, serviceKind: "SHIFT",
        scheduledStart: "2026-10-30T06:00:00Z",
        scheduledEnd: "2026-10-30T18:00:00Z", requestKey: REQUEST },
      "api_hc_schedule_coverage"],
    ["requestHomecareHandover",
      { organizationId: ORG, outgoingCoverageId: out, incomingCoverageId: incoming },
      "api_hc_request_handover"],
    ["acknowledgeHomecareHandover",
      { organizationId: ORG, handoverId: handover },
      "api_hc_ack_handover"],
  ] as const;
  const h = harness();
  for (const [action, params, rpc] of pairs) {
    const response = await h.handle(post({ action, ...params }));
    equal(response.status, 200, "HC command is syntactically valid");
    equal(h.calls[h.calls.length - 1].rpc, rpc, "fixed server RPC mapping");
    equal(h.calls[h.calls.length - 1].args.p_actor, ACTOR,
      "only server verified identity may be used");
  }
  const coverage = h.calls.find(call => call.rpc === "api_hc_schedule_coverage");
  equal(coverage?.args.p_plan_version, 1, "numeric plan version forwarded as integer");
  equal(coverage?.args.p_kind, "SHIFT", "approved coverage type forwarded");
  equal(h.calls.length, pairs.length, "each valid command dispatches once");
});

Deno.test("clinical approval, emergency acknowledgement and signatures remain absent", async () => {
  const h = harness();
  for (const action of [
    "approveHomecareCarePlan", "activateHomecareEpisode",
    "signMedicalOrder", "acknowledgeEmergency", "dischargeHomecareEpisode",
    "setProviderLicenseVerified",
  ]) {
    const response = await h.handle(post({
      action, organizationId: ORG, episodeId: PATIENT,
    }));
    equal(response.status, 422, "unsafe action not available in HC-02B");
  }
  equal(h.calls.length, 0, "no unapproved clinical command reaches SQL");
});

Deno.test("rejects malformed coverage kind/version and client-supplied identity or privileges", async () => {
  const valid = {
    action: "scheduleHomecareCoverage",
    organizationId: ORG,
    episodeId: "e1000000-0000-4000-8000-000000000001",
    professionalId: PROFESSIONAL,
    carePlanVersion: 1,
    serviceKind: "SHIFT",
    scheduledStart: "2026-10-30T06:00:00Z",
    scheduledEnd: "2026-10-30T18:00:00Z",
    requestKey: REQUEST,
  };
  const invalid = [
    { ...valid, carePlanVersion: "1" },
    { ...valid, carePlanVersion: 1.3 },
    { ...valid, carePlanVersion: 0 },
    { ...valid, carePlanVersion: -1 },
    { ...valid, carePlanVersion: 1000001 },
    { ...valid, serviceKind: "MEDICAL_ORDER" },
    { ...valid, serviceKind: "VISIT;DROP TABLE" },
    { ...valid, p_actor: ACTOR },
    { ...valid, app_role: "ADMIN" },
    { ...valid, service_role: "fake" },
    { ...valid, patientId: PATIENT },
    { ...valid, clinicPatientId: PATIENT },
  ];
  const h = harness();
  for (const payload of invalid) {
    const response = await h.handle(post(payload));
    equal(response.status, 422, "malformed or extra clinical field must be rejected");
  }
  equal(h.calls.length, 0, "no invalid coverages reach database");
});

Deno.test("revoked Supabase user JWT cannot dispatch any homecare operation", async () => {
  const h = harness({ authenticate: async () => null });
  const response = await h.handle(post({
    action: "createHomecareEpisodeDraft",
    organizationId: ORG, patientId: PATIENT, requestKey: REQUEST,
  }));
  equal(response.status, 401, "revoked user cannot create homecare case");
  equal(h.calls.length, 0, "no RPC call when JWT is rejected by Auth");
});


Deno.test("HC-02C1B allows only administrative PENDING review intake, never clinical approval", async () => {
  const h = harness();
  const request = {
    action: "requestHomecarePlanReview",
    organizationId: ORG,
    episodeId: "e1000000-0000-4000-8000-000000000001",
    carePlanVersion: 2,
    requestKey: REQUEST,
  };
  const ok = await h.handle(post(request));
  equal(ok.status, 200, "synthetic intake routes through protected RPC");
  equal(h.calls.length, 1, "only one request reaches the backend");
  equal(h.calls[0].rpc, "api_hc_request_plan_review", "fixed pending-only RPC");
  equal(h.calls[0].args.p_actor, ACTOR, "actor comes from verified Supabase Auth");
  equal(h.calls[0].args.p_version, 2, "version is forwarded as integer");
  for (const attempted of [
    { ...request, carePlanVersion: 0 },
    { ...request, carePlanVersion: "2" },
    { ...request, clinicalNotes: "forbidden" },
    { ...request, planDigest: "forbidden" },
    { ...request, approved: true },
    { ...request, reviewState: "APPROVED" },
    { ...request, p_actor: ACTOR },
    { ...request, service_role: "secret" },
    { ...request, clinicPatientId: PATIENT },
    { ...request, action: "approveHomecareCarePlan" },
    { ...request, action: "activateHomecareEpisode" },
  ]) {
    const result = await h.handle(post(attempted));
    equal(result.status, 422, "non-contract or clinical operation must be denied");
  }
  equal(h.calls.length, 1, "attempts to submit clinical approvals never dispatch");
});

Deno.test("HC-READ-02: exact first/next page allowlist injects verified actor",async()=>{
  const h=harness();
  const first={
    action:"listMyHomecareCoveragesPage",
    windowStart:"2026-11-02T00:00:00Z",
    windowEnd:"2026-11-05T00:00:00Z",
  };
  const result=await h.handle(post(first));
  equal(result.status,200,"first bounded window accepted");
  equal(h.calls.length,1,"exactly one command");
  equal(h.calls[0].rpc,"api_hc_list_my_coverages_page","new service-only RPC");
  equal(JSON.stringify(h.calls[0].args),JSON.stringify({
    p_window_start:first.windowStart,p_window_end:first.windowEnd,p_actor:ACTOR,
  }),"actor always server-injected");
  const next=await h.handle(post({
    action:"listMyHomecareCoveragesNextPage",
    windowStart:first.windowStart,windowEnd:first.windowEnd,
    cursorStart:"2026-11-03T00:45:00.123456Z",
    cursorId:"c0000099-0000-4000-8000-000000000099",
  }));
  equal(next.status,200,"next page accepted");
  equal(h.calls.length,2,"one RPC per explicit request");
  equal(h.calls[1].args.p_after_start,"2026-11-03T00:45:00.123456Z",
    "microseconds must remain intact");
  equal(h.calls[1].args.p_after_id,"c0000099-0000-4000-8000-000000000099",
    "cursor UUID kept only as keyset position");
});

Deno.test("HC-READ-02: invalid dates/cursors and impersonation are rejected before RPC",async()=>{
  const h=harness();
  const valid={
    action:"listMyHomecareCoveragesPage",
    windowStart:"2026-11-02T00:00:00Z",windowEnd:"2026-11-05T00:00:00Z",
  };
  const invalid=[
    {...valid,windowStart:"2026-02-30T00:00:00Z"},
    {...valid,windowStart:"2026-11-02T00:00:00-03:00"},
    {...valid,windowStart:"2026-11-02T24:00:00Z"},
    {...valid,windowStart:"2026-11-02T00:00:00.1234567Z"},
    {...valid,windowEnd:"invalid"},
    {...valid,cursorStart:"2026-11-02T00:00:00Z"},
    {...valid,actorId:ACTOR},
    {...valid,organizationId:ORG},
    {...valid,patientId:PATIENT},
    {...valid,professionalId:PROFESSIONAL},
    {...valid,service_role:"bogus"},
    {...valid,includeClinical:true},
    {...valid,windowStart:null},
    {...valid,action:"listMyHomecareCoveragesNextPage"},
    {...valid,action:"listMyHomecareCoveragesNextPage",
      cursorStart:"2026-11-02T00:00:00Z",cursorId:"wrong"},
    {...valid,action:"listMyHomecareCoveragesNextPage",
      cursorStart:"2026-11-02T00:00:00Z",
      cursorId:"c0000099-0000-4000-8000-000000000099",appRole:"ADMIN"},
  ];
  for(const payload of invalid){
    const response=await h.handle(post(payload));
    equal(response.status,422,"malformed or forged page request rejected");
  }
  equal(h.calls.length,0,"no unauthorized pagination reaches database");
});
