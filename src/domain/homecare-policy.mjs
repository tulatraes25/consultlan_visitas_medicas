/**
 * HC-00 domain design guardrails for pediatric home-based inpatient care.
 * PURE SPECIFICATION POLICY. NOT JWT authentication, DB RLS, clinician approval
 * or treatment decision-making. Objects MUST originate from a trusted backend.
 * No patient, diagnosis, medication, or family identifiers belong in fixtures.
 */
export const HOMECARE_EPISODE_STATES = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DISCHARGED: "DISCHARGED",
});

export const HOMECARE_SERVICE_TYPES = Object.freeze({
  VISIT: "VISIT",
  CARE_SHIFT: "CARE_SHIFT",
});

const ALLOWED_SERVICE_TYPES = new Set(Object.values(HOMECARE_SERVICE_TYPES));
const PAPER_ONLY = new Set(["KARDEX", "VITAL_SIGNS", "PROCEDURE_SHEET", "CRISIS_SHEET"]);
const HUMAN_ONLY_ACTIONS = new Set([
  "APPROVE_MEDICAL_ORDER",
  "DISCHARGE_EPISODE",
  "ACKNOWLEDGE_EMERGENCY",
  "SIGNED_CLINICAL_CLOSURE",
]);

function denied(code) { return { allowed: false, code }; }
function allowed() { return { allowed: true, code: "ALLOWED" }; }
function validId(value) { return typeof value === "string" && value.length > 0; }
function role(actor, name) {
  return Array.isArray(actor.roles) && actor.roles.includes(name);
}
function permission(actor, name) {
  return Array.isArray(actor.permissions) && actor.permissions.includes(name);
}
function eligiblePlan(plan, episode, service) {
  return !!plan && plan.status === "APPROVED" &&
    Number.isSafeInteger(plan.version) && plan.version > 0 &&
    validId(plan.approvedByUserId) &&
    plan.episodeId === episode.id &&
    service.carePlanVersion === plan.version;
}

/**
 * Before a homecare service is treated as authorized, it must belong to the
 * exact patient's own homecare episode, the exact organization and the current
 * approved plan. This is a protective policy contract, not a live API.
 */
export function assessHomecareOperation({ actor, episode, service, plan, action }) {
  if (!actor || actor.active !== true || !validId(actor.id) ||
      !validId(actor.tenantId)) return denied("ACTOR_NOT_AUTHENTICATED");
  if (!episode || !validId(episode.id) ||
      !validId(episode.organizationId) || !validId(episode.patientId)) {
    return denied("EPISODE_INVALID");
  }
  if (episode.organizationId !== actor.tenantId) return denied("ORGANIZATION_MISMATCH");
  if (HUMAN_ONLY_ACTIONS.has(action)) return denied("HUMAN_CLINICAL_APPROVAL_REQUIRED");
  if (!service || !validId(service.episodeId) ||
      !validId(service.patientId) || !validId(service.organizationId)) {
    return denied("SERVICE_INVALID");
  }
  if (service.episodeId !== episode.id ||
      service.patientId !== episode.patientId ||
      service.organizationId !== episode.organizationId) {
    return denied("SERVICE_EPISODE_PATIENT_MISMATCH");
  }
  // A reference to clinic/ambulatory patients is never a valid foreign key here.
  if (Object.hasOwn(service, "clinicPatientId") ||
      Object.hasOwn(episode, "clinicPatientId") ||
      Object.hasOwn(service, "consultlanPatientId")) {
    return denied("EXTERNAL_CLINIC_PATIENT_REFERENCE_FORBIDDEN");
  }
  if (!ALLOWED_SERVICE_TYPES.has(service.serviceType)) {
    return denied("SERVICE_TYPE_INVALID");
  }
  if (episode.state !== HOMECARE_EPISODE_STATES.ACTIVE) {
    return denied("EPISODE_NOT_ACTIVE");
  }
  if (!eligiblePlan(plan, episode, service)) {
    return denied("APPROVED_PLAN_REQUIRED");
  }
  if (action === "PLAN_SERVICE") {
    return (role(actor, "COORDINATOR") || role(actor, "ADMIN")) &&
      permission(actor, "homecare:schedule")
      ? allowed() : denied("COORDINATION_PERMISSION_REQUIRED");
  }
  if (action === "RECORD_SERVICE" || action === "REFERENCE_PAPER_RECORD") {
    if (!role(actor, "PROFESSIONAL") ||
        service.professionalId !== actor.id ||
        !Array.isArray(episode.careTeamUserIds) ||
        !episode.careTeamUserIds.includes(actor.id)) {
      return denied("ASSIGNED_ACTIVE_CARE_TEAM_REQUIRED");
    }
    if (!permission(actor, "homecare:record")) return denied("CLINICAL_RECORD_PERMISSION_REQUIRED");
    if (action === "RECORD_SERVICE" && PAPER_ONLY.has(service.recordKind)) {
      return denied("BEDSIDE_PAPER_RECORD_NOT_REPLACED");
    }
    if (action === "REFERENCE_PAPER_RECORD" && !PAPER_ONLY.has(service.recordKind)) {
      return denied("PAPER_REFERENCE_TYPE_INVALID");
    }
    return allowed();
  }
  return denied("UNKNOWN_OPERATION");
}
