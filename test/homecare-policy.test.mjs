import test from "node:test";
import assert from "node:assert/strict";
import {
  HOMECARE_EPISODE_STATES, HOMECARE_SERVICE_TYPES, assessHomecareOperation,
} from "../src/domain/homecare-policy.mjs";

const episode = Object.freeze({
  id: "synthetic-episode-A",
  organizationId: "synthetic-organization-A",
  patientId: "synthetic-homecare-patient-A",
  state: HOMECARE_EPISODE_STATES.ACTIVE,
  careTeamUserIds: ["synthetic-nurse-A", "synthetic-doctor-A"],
});
const approvedPlan = Object.freeze({
  episodeId: episode.id,
  status: "APPROVED",
  approvedByUserId: "synthetic-doctor-A",
  version: 3,
});
const service = Object.freeze({
  episodeId: episode.id,
  patientId: episode.patientId,
  organizationId: episode.organizationId,
  serviceType: HOMECARE_SERVICE_TYPES.CARE_SHIFT,
  carePlanVersion: 3,
  professionalId: "synthetic-nurse-A",
  recordKind: "CLINICAL_EVOLUTION",
});
const nurse = Object.freeze({
  id: "synthetic-nurse-A", tenantId: episode.organizationId, active: true,
  roles: ["PROFESSIONAL"], permissions: ["homecare:record"],
});
const coordinator = Object.freeze({
  id: "synthetic-coordinator-A", tenantId: episode.organizationId, active: true,
  roles: ["COORDINATOR"], permissions: ["homecare:schedule"],
});
const args = (overrides = {}) =>
  ({ actor: nurse, episode, service, plan: approvedPlan, action: "RECORD_SERVICE", ...overrides });

test("episode-centered care shift is valid for assigned authorized team member with approved plan", () => {
  assert.deepEqual(assessHomecareOperation(args()), { allowed: true, code: "ALLOWED" });
  assert.deepEqual(assessHomecareOperation(args({
    service: { ...service, serviceType: HOMECARE_SERVICE_TYPES.VISIT },
  })), { allowed: true, code: "ALLOWED" });
});

test("cannot associate clinical service with other patient, other episode or different organization", () => {
  for (const field of ["episodeId", "patientId", "organizationId"]) {
    const result = assessHomecareOperation(args({ service: { ...service, [field]: "synthetic-other" } }));
    assert.deepEqual(result, { allowed: false, code: "SERVICE_EPISODE_PATIENT_MISMATCH" }, field);
  }
  assert.equal(assessHomecareOperation(args({
    actor: { ...nurse, tenantId: "synthetic-other-organization" },
  })).code, "ORGANIZATION_MISMATCH");
});

test("clinic patient identifiers are disallowed even when source IDs look valid", () => {
  const source = assessHomecareOperation(args({
    service: { ...service, clinicPatientId: "synthetic-clinic-patient" },
  }));
  assert.equal(source.code, "EXTERNAL_CLINIC_PATIENT_REFERENCE_FORBIDDEN");
  const legacy = assessHomecareOperation(args({
    episode: { ...episode, clinicPatientId: "synthetic-clinic-patient" },
  }));
  assert.equal(legacy.code, "EXTERNAL_CLINIC_PATIENT_REFERENCE_FORBIDDEN");
});

test("no care service may be recorded during draft, suspended or discharged episode", () => {
  for (const state of ["DRAFT", "SUSPENDED", "DISCHARGED"]) {
    assert.equal(assessHomecareOperation(args({
      episode: { ...episode, state },
    })).code, "EPISODE_NOT_ACTIVE", state);
  }
});

test("cannot record under a missing, draft, foreign or outdated care plan", () => {
  assert.equal(assessHomecareOperation(args({ plan: null })).code, "APPROVED_PLAN_REQUIRED");
  for (const plan of [
    { ...approvedPlan, status: "DRAFT" },
    { ...approvedPlan, episodeId: "synthetic-other-episode" },
    { ...approvedPlan, version: 2 },
    { ...approvedPlan, approvedByUserId: null },
  ]) {
    assert.equal(assessHomecareOperation(args({ plan })).code, "APPROVED_PLAN_REQUIRED");
  }
});

test("coordination schedules coverage but cannot chart, and professional cannot schedule arbitrarily", () => {
  assert.equal(assessHomecareOperation(args({ actor: coordinator, action: "PLAN_SERVICE" })).allowed, true);
  assert.equal(assessHomecareOperation(args({ actor: coordinator })).code, "ASSIGNED_ACTIVE_CARE_TEAM_REQUIRED");
  assert.equal(assessHomecareOperation(args({ action: "PLAN_SERVICE" })).code, "COORDINATION_PERMISSION_REQUIRED");
});

test("professional assignment and episode team membership are both required", () => {
  const other = { ...nurse, id: "synthetic-other-professional" };
  assert.equal(assessHomecareOperation(args({ actor: other })).code, "ASSIGNED_ACTIVE_CARE_TEAM_REQUIRED");
  const notInTeam = { ...episode, careTeamUserIds: ["synthetic-doctor-A"] };
  assert.equal(assessHomecareOperation(args({ episode: notInTeam })).code, "ASSIGNED_ACTIVE_CARE_TEAM_REQUIRED");
  assert.equal(assessHomecareOperation(args({
    actor: { ...nurse, permissions: [] },
  })).code, "CLINICAL_RECORD_PERMISSION_REQUIRED");
  assert.equal(assessHomecareOperation(args({
    actor: { ...nurse, active: false },
  })).code, "ACTOR_NOT_AUTHENTICATED");
});

test("physical Kardex/vital signs/procedures/crisis sheet are references, not automatic digital records", () => {
  for (const kind of ["KARDEX", "VITAL_SIGNS", "PROCEDURE_SHEET", "CRISIS_SHEET"]) {
    const enriched = { ...service, recordKind: kind };
    assert.equal(assessHomecareOperation(args({
      service: enriched,
    })).code, "BEDSIDE_PAPER_RECORD_NOT_REPLACED");
    assert.equal(assessHomecareOperation(args({
      action: "REFERENCE_PAPER_RECORD", service: enriched,
    })).allowed, true);
  }
  assert.equal(assessHomecareOperation(args({
    action: "REFERENCE_PAPER_RECORD",
  })).code, "PAPER_REFERENCE_TYPE_INVALID");
});

test("system cannot claim human clinical authorization, signed closure or emergency acknowledgement", () => {
  for (const action of [
    "APPROVE_MEDICAL_ORDER", "DISCHARGE_EPISODE",
    "ACKNOWLEDGE_EMERGENCY", "SIGNED_CLINICAL_CLOSURE",
  ]) {
    assert.equal(assessHomecareOperation(args({ action })).code, "HUMAN_CLINICAL_APPROVAL_REQUIRED");
  }
  assert.equal(assessHomecareOperation(args({ action: "TRIAGE_AUTOMATIC" })).code, "UNKNOWN_OPERATION");
});

test("unknown service type or missing patient-bound context fail closed", () => {
  assert.equal(assessHomecareOperation(args({
    service: { ...service, serviceType: "AMBULATORY_APPOINTMENT" },
  })).code, "SERVICE_TYPE_INVALID");
  assert.equal(assessHomecareOperation(args({ episode: null })).code, "EPISODE_INVALID");
  assert.equal(assessHomecareOperation(args({
    service: { ...service, patientId: null },
  })).code, "SERVICE_INVALID");
});
