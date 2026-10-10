import test from "node:test";
import assert from "node:assert/strict";
import { VISIT_STATES, authorizeVisitAction, evaluateVisitTransition } from "../src/domain/visit-policy.mjs";

const DIGEST = "a".repeat(64);
const ARTIFACT = "b".repeat(64);
const pro = { id: "practitioner-example", tenantId: "org-example", active: true, roles: ["professional"], permissions: [] };
const otherPro = { ...pro, id: "another-practitioner" };
const coord = { id: "coordinator-example", tenantId: "org-example", active: true, roles: ["coordinator"], permissions: ["visit:manage"] };
const admin = { id: "administrator-example", tenantId: "org-example", active: true, roles: ["admin"], permissions: [] };
const backend = { id: "verified-signing-service", tenantId: "org-example", active: true, roles: ["trusted_server_service"], permissions: [] };
const visit = (state = VISIT_STATES.ASSIGNED) => ({
  id: "synthetic-visit-001", tenantId: "org-example", assignedProfessionalId: pro.id, state,
});
const caregiver = {
  outcome: "SIGNED", signerRole: "PARENT", attestationDocumentSha256: DIGEST,
  identityVerified: true, signatureArtifactSha256: ARTIFACT,
};
const finalEvidence = () => ({
  trustedBackend: true,
  documentSha256: DIGEST,
  professionalSignature: {
    kind: "CERTIFIED_DIGITAL", verifiedByTrustService: true,
    visitId: "synthetic-visit-001", documentSha256: DIGEST,
  },
  caregiverEvidence: caregiver,
});
const decide = (actor, currentState, targetState, evidence = {}) =>
  evaluateVisitTransition({ actor, visit: visit(currentState), targetState, evidence });

test("authorized assigned professional reads own visit and clinical data", () => {
  assert.equal(authorizeVisitAction({ actor: pro, visit: visit(), action: "READ_VISIT" }).allowed, true);
  assert.equal(authorizeVisitAction({ actor: pro, visit: visit(), action: "READ_CLINICAL" }).allowed, true);
});
test("professional cannot read another professional's assignment", () => {
  assert.equal(authorizeVisitAction({ actor: otherPro, visit: visit(), action: "READ_VISIT" }).allowed, false);
  assert.equal(authorizeVisitAction({ actor: otherPro, visit: visit(), action: "READ_CLINICAL" }).allowed, false);
});
test("cross-tenant access is denied even for coordinators", () => {
  const hostile = { ...coord, tenantId: "org-other" };
  assert.equal(authorizeVisitAction({ actor: hostile, visit: visit(), action: "READ_VISIT" }).code, "TENANT_MISMATCH");
  assert.equal(decide(hostile, VISIT_STATES.PLANNED, VISIT_STATES.ASSIGNED, {assignedProfessionalId: pro.id}).allowed, false);
});
test("administrators cannot see clinical data by role alone", () => {
  assert.equal(authorizeVisitAction({ actor: admin, visit: visit(), action: "READ_CLINICAL" }).code, "CLINICAL_SCOPE_DENIED");
});
test("coordination can read operational detail but not clinical notes", () => {
  assert.equal(authorizeVisitAction({ actor: coord, visit: visit(), action: "READ_VISIT" }).allowed, true);
  assert.equal(authorizeVisitAction({ actor: coord, visit: visit(), action: "READ_CLINICAL" }).allowed, false);
});
test("a coordinator role without explicit visit permission is denied", () => {
  assert.equal(authorizeVisitAction({ actor: { ...coord, permissions: [] }, visit: visit(), action: "READ_VISIT" }).allowed, false);
});
test("revoked actors are denied", () => {
  assert.equal(authorizeVisitAction({ actor: { ...pro, active: false }, visit: visit(), action: "READ_VISIT" }).code, "UNAUTHENTICATED");
});
test("unknown operations fail closed", () => {
  assert.equal(authorizeVisitAction({ actor: pro, visit: visit(), action: "ADMIN_EXPORT_ALL" }).code, "UNKNOWN_ACTION");
});
test("coordination alone assigns visits with real professional references", () => {
  assert.equal(decide(coord, VISIT_STATES.PLANNED, VISIT_STATES.ASSIGNED, { assignedProfessionalId: pro.id }).allowed, true);
  assert.equal(decide(pro, VISIT_STATES.PLANNED, VISIT_STATES.ASSIGNED, { assignedProfessionalId: pro.id }).allowed, false);
  assert.equal(decide(coord, VISIT_STATES.PLANNED, VISIT_STATES.ASSIGNED, {}).allowed, false);
});
test("only assigned professional starts and records a visit", () => {
  assert.equal(decide(pro, VISIT_STATES.ASSIGNED, VISIT_STATES.IN_PROGRESS).allowed, true);
  assert.equal(decide(otherPro, VISIT_STATES.ASSIGNED, VISIT_STATES.IN_PROGRESS).allowed, false);
  assert.equal(authorizeVisitAction({actor: pro,visit:visit(VISIT_STATES.IN_PROGRESS),action:"WRITE_CLINICAL"}).allowed, true);
  assert.equal(authorizeVisitAction({actor: pro,visit:visit(VISIT_STATES.CLOSED_VERIFIED),action:"WRITE_CLINICAL"}).allowed, false);
});
test("no state skipping, no closed visit mutation", () => {
  assert.equal(decide(pro, VISIT_STATES.ASSIGNED, VISIT_STATES.CLOSED_VERIFIED).code, "INVALID_TRANSITION");
  assert.equal(decide(pro, VISIT_STATES.CLOSED_VERIFIED, VISIT_STATES.IN_PROGRESS).code, "INVALID_TRANSITION");
});
test("clinical review and immutable version are prerequisites", () => {
  assert.equal(decide(pro, VISIT_STATES.IN_PROGRESS, VISIT_STATES.PENDING_REVIEW).code, "CLINICAL_RECORD_REQUIRED");
  assert.equal(decide(pro, VISIT_STATES.IN_PROGRESS, VISIT_STATES.PENDING_REVIEW, {clinicalRecordRecorded:true}).allowed,true);
  assert.equal(decide(pro, VISIT_STATES.PENDING_REVIEW, VISIT_STATES.PENDING_SIGNATURE, {reviewConfirmed:true}).code, "DOCUMENT_REVIEW_REQUIRED");
  assert.equal(decide(pro, VISIT_STATES.PENDING_REVIEW, VISIT_STATES.PENDING_SIGNATURE, {reviewConfirmed:true, documentSha256:DIGEST}).allowed,true);
});
test("cancellation needs coordination and a reason", () => {
  assert.equal(decide(coord, VISIT_STATES.ASSIGNED, VISIT_STATES.CANCELLED, {}).code, "REASON_REQUIRED");
  assert.equal(decide(coord, VISIT_STATES.ASSIGNED, VISIT_STATES.CANCELLED, {reason:"Inasistencia justificada"}).allowed,true);
  assert.equal(decide(pro, VISIT_STATES.ASSIGNED, VISIT_STATES.CANCELLED, {reason:"Inasistencia justificada"}).allowed,false);
});
test("mobile impersonation of backend is unable to close a visit", () => {
  const payload = finalEvidence();
  assert.equal(decide(pro, VISIT_STATES.PENDING_SIGNATURE, VISIT_STATES.CLOSED_VERIFIED, payload).code,"TRUSTED_SERVER_REQUIRED");
  assert.equal(decide(backend, VISIT_STATES.PENDING_SIGNATURE, VISIT_STATES.CLOSED_VERIFIED, {...payload,trustedBackend:false}).allowed,false);
});
test("drawing or saved image cannot masquerade as certified digital signature", () => {
  const payload = finalEvidence();
  payload.professionalSignature = {...payload.professionalSignature, kind:"DRAWN_PNG"};
  assert.equal(decide(backend, VISIT_STATES.PENDING_SIGNATURE, VISIT_STATES.CLOSED_VERIFIED, payload).code, "PROFESSIONAL_DIGITAL_SIGNATURE_UNVERIFIED");
});
test("cross-document signature reuse is rejected", () => {
  const payload = finalEvidence();
  payload.professionalSignature = {...payload.professionalSignature, documentSha256:"c".repeat(64)};
  assert.equal(decide(backend,VISIT_STATES.PENDING_SIGNATURE,VISIT_STATES.CLOSED_VERIFIED,payload).allowed,false);
  const payload2=finalEvidence();
  payload2.caregiverEvidence={...caregiver,attestationDocumentSha256:"c".repeat(64)};
  assert.equal(decide(backend,VISIT_STATES.PENDING_SIGNATURE,VISIT_STATES.CLOSED_VERIFIED,payload2).allowed,false);
});
test("signed conformity needs signer identity and captured evidence", () => {
  const payload=finalEvidence();
  payload.caregiverEvidence={...caregiver,identityVerified:false};
  assert.equal(decide(backend,VISIT_STATES.PENDING_SIGNATURE,VISIT_STATES.CLOSED_VERIFIED,payload).code,"CAREGIVER_EVIDENCE_UNVERIFIED");
});
test("a caregiver without verified authorization cannot sign on behalf of family", () => {
  const payload=finalEvidence();
  payload.caregiverEvidence={...caregiver,signerRole:"AUTHORIZED_CAREGIVER"};
  assert.equal(decide(backend,VISIT_STATES.PENDING_SIGNATURE,VISIT_STATES.CLOSED_VERIFIED,payload).code,"CAREGIVER_AUTHORIZATION_UNVERIFIED");
});
test("trusted service can close with correctly scoped verified signatures", () => {
  assert.deepEqual(decide(backend,VISIT_STATES.PENDING_SIGNATURE,VISIT_STATES.CLOSED_VERIFIED,finalEvidence()), {allowed:true,code:"ALLOWED"});
});
test("refusal never becomes presumed consent: signed exception is explicit", () => {
  const payload=finalEvidence();
  payload.caregiverEvidence={ outcome:"REFUSED", attestationDocumentSha256:DIGEST, reason:"El tutor rehúsa firmar" };
  assert.equal(decide(backend,VISIT_STATES.PENDING_SIGNATURE,VISIT_STATES.CLOSED_VERIFIED,payload).code,"CLOSED_WITH_CAREGIVER_EXCEPTION");
  payload.caregiverEvidence={ outcome:"REFUSED", attestationDocumentSha256:DIGEST };
  assert.equal(decide(backend,VISIT_STATES.PENDING_SIGNATURE,VISIT_STATES.CLOSED_VERIFIED,payload).allowed,false);
});
test("signer unavailable permits exception-only closure with audit reason", () => {
  const payload=finalEvidence();
  payload.caregiverEvidence={outcome:"UNAVAILABLE",attestationDocumentSha256:DIGEST,reason:"Familiar no estaba presente"};
  assert.equal(decide(backend,VISIT_STATES.PENDING_SIGNATURE,VISIT_STATES.CLOSED_VERIFIED,payload).code,"CLOSED_WITH_CAREGIVER_EXCEPTION");
});
