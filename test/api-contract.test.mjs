import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VISIT_STATES } from "../src/domain/visit-policy.mjs";

const spec = JSON.parse(readFileSync(new URL("../contracts/openapi.visits.json", import.meta.url), "utf8"));
const ops = Object.entries(spec.paths).flatMap(([path,verbs]) =>
  Object.entries(verbs).filter(([verb]) => ["get","post","put","patch","delete"].includes(verb))
    .map(([verb,operation]) => ({path,verb,operation})));

test("OpenAPI contract is a parseable 3.1 draft with auth", () => {
  assert.equal(spec.openapi,"3.1.0");
  assert.equal(spec.info.version,"0.1.0-draft");
  assert.deepEqual(spec.security,[{bearerAuth:[]}]);
  assert.equal(spec.components.securitySchemes.bearerAuth.type,"http");
});
test("all operation identifiers are unique and operations are explicitly authenticated", () => {
  const ids=ops.map(({operation})=>operation.operationId);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(ids.length,7);
  for (const {operation} of ops) {
    assert.deepEqual(operation.security ?? spec.security,[{bearerAuth:[]}]);
  }
});
test("every public mutation requires idempotency key and optimistic concurrency", () => {
  const writes=ops.filter(({verb})=>verb!=="get");
  assert.ok(writes.length>=5);
  for (const {path,operation} of writes) {
    assert.ok(operation.parameters?.some(p=>p.$ref==="#/components/parameters/IdempotencyKey"),path);
    assert.ok(operation.parameters?.some(p=>p.$ref==="#/components/parameters/IfMatch"),path);
    assert.equal(operation.requestBody?.required,true);
    for (const status of ["401","403","409","422"]) assert.ok(operation.responses[status],`${path} missing ${status}`);
  }
});
test("no direct mobile endpoint claims to close or validate signatures", () => {
  assert.equal(ops.some(({path})=>path.includes("/close")||path.includes("/validate-digital-signature")),false);
  const req=spec.paths["/v1/visits/{visitId}/professional-signature-requests"].post;
  assert.equal(req.responses["202"].content["application/json"].schema.$ref,"#/components/schemas/ProfessionalSignatureChallenge");
  assert.equal(spec.components.schemas.ProfessionalSignatureChallenge.properties.status.const,"PENDING_PROVIDER_VERIFICATION");
});
test("form captures electronic attendance, not a claimed certified digital signature", () => {
  const schema=spec.components.schemas.AttendanceAttestationRequest;
  assert.equal(schema.oneOf.length,2);
  const accepted=schema.oneOf.find(x=>x.properties.outcome.const==="SIGNED");
  assert.equal(accepted.additionalProperties,false);
  assert.ok(accepted.required.includes("captureSessionId"));
  assert.equal(Object.hasOwn(accepted.properties,"signatureVerified"),false);
  const rejected=schema.oneOf.find(x=>x.properties.outcome.enum?.includes("REFUSED"));
  assert.ok(rejected.required.includes("reason"));
  assert.equal(rejected.additionalProperties,false);
});
test("visit states exactly match shared deny-by-default policy", () => {
  const schema=spec.components.schemas.VisitState.enum;
  assert.deepEqual([...schema].sort(),Object.values(VISIT_STATES).sort());
  for (const bogus of ["SIGNATURE_REFUSED","SYNC_PENDING","REOPEN_REQUESTED"]) assert.equal(schema.includes(bogus),false);
});
test("all local schema references resolve", () => {
  const refs=new Set();
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value!=="object") return;
    if (typeof value.$ref==="string")refs.add(value.$ref);
    Object.values(value).forEach(visit);
  }
  visit(spec);
  for (const ref of refs) {
    assert.ok(ref.startsWith("#/"),ref);
    let node=spec;
    for (const raw of ref.slice(2).split("/")) {
      const key=raw.replaceAll("~1","/").replaceAll("~0","~");
      node=node?.[key];
    }
    assert.notEqual(node,undefined,ref);
  }
});
