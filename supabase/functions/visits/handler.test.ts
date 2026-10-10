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

Deno.test("all operational actions route to exact RPC with checked arguments", async () => {
  const pairs = [
    ["registerProfessional", { organizationId: ORG, authUserId: ACTOR, specialty: "Enfermería" }, "api_register_professional"],
    ["scheduleVisit", {
      organizationId: ORG, patientId: PATIENT, professionalId: PROFESSIONAL,
      scheduledStart: "2026-10-11T10:00:00Z", scheduledEnd: "2026-10-11T11:00:00Z",
      requestKey: REQUEST,
    }, "api_schedule_visit"],
    ["beginVisit", { organizationId: ORG, visitId: VISIT }, "api_begin_visit"],
    ["addClinicalNote", {
      organizationId: ORG, visitId: VISIT, narrative: "Texto sintético de revisión",
      requestKey: REQUEST,
    }, "api_add_clinical_note"],
    ["submitVisitReview", { organizationId: ORG, visitId: VISIT }, "api_submit_visit_review"],
    ["cancelVisit", {
      organizationId: ORG, visitId: VISIT, reasonCode: "PATIENT_UNAVAILABLE",
    }, "api_cancel_visit"],
  ] as const;
  const h = harness();
  for (const [action, fields, rpc] of pairs) {
    const response = await h.handle(post({ action, ...fields }));
    equal(response.status, 200, action + " response");
    equal(h.calls[h.calls.length - 1].rpc, rpc, action + " mapping");
    equal(h.calls[h.calls.length - 1].args.p_actor, ACTOR, "identity not client-defined");
  }
  equal(h.calls.length, pairs.length, "must send exactly one RPC per request");
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

Deno.test("requires exact cancellation reason and sane timestamps", async () => {
  const h = harness();
  const badCancel = await h.handle(post({
    action: "cancelVisit", organizationId: ORG, visitId: VISIT,
    reasonCode: "patient did not answer at home",
  }));
  equal(badCancel.status, 422, "unstructured cancellation rejected");
  const badDates = await h.handle(post({
    action: "scheduleVisit", organizationId: ORG, patientId: PATIENT,
    professionalId: PROFESSIONAL, scheduledStart: "tomorrow",
    scheduledEnd: "2026-10-11T12:00:00Z", requestKey: REQUEST,
  }));
  equal(badDates.status, 422, "free-text dates rejected");
  equal(h.calls.length, 0, "invalid schedule must not reach SQL");
});
