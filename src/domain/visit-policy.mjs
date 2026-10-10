/**
 * CONSULTLAN visitas: provisional, dependency-free authorization/state policy.
 * This is a domain contract, NOT an HTTP auth middleware or a digital-signature verifier.
 * Only a trusted backend may construct actor, tenant context and signature evidence.
 * Never accept these objects verbatim from a mobile request.
 */
export const VISIT_STATES = Object.freeze({
  PLANNED: "PLANNED",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  PENDING_REVIEW: "PENDING_REVIEW",
  PENDING_SIGNATURE: "PENDING_SIGNATURE",
  CLOSED_VERIFIED: "CLOSED_VERIFIED",
  CANCELLED: "CANCELLED",
  NOT_PERFORMED: "NOT_PERFORMED",
});

const TRANSITIONS = Object.freeze({
  PLANNED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED", "NOT_PERFORMED"],
  IN_PROGRESS: ["PENDING_REVIEW", "NOT_PERFORMED"],
  PENDING_REVIEW: ["IN_PROGRESS", "PENDING_SIGNATURE"],
  PENDING_SIGNATURE: ["PENDING_REVIEW", "CLOSED_VERIFIED"],
  CLOSED_VERIFIED: [],
  CANCELLED: [],
  NOT_PERFORMED: [],
});

const HEX256 = /^[0-9a-f]{64}$/i;
const SIGNER_ROLES = new Set(["PARENT", "LEGAL_GUARDIAN", "AUTHORIZED_CAREGIVER"]);

function allowed(code = "ALLOWED") { return { allowed: true, code }; }
function denied(code) { return { allowed: false, code }; }
function role(actor, name) { return Array.isArray(actor?.roles) && actor.roles.includes(name); }
function permission(actor, name) {
  return Array.isArray(actor?.permissions) && actor.permissions.includes(name);
}
function hasIdentity(actor) {
  return !!actor && actor.active === true &&
    typeof actor.id === "string" && actor.id.length > 0 &&
    typeof actor.tenantId === "string" && actor.tenantId.length > 0;
}
function hasVisit(visit) {
  return !!visit && typeof visit.id === "string" && visit.id.length > 0 &&
    typeof visit.tenantId === "string" && visit.tenantId.length > 0 &&
    Object.hasOwn(TRANSITIONS, visit.state);
}
function scoped(actor, visit) {
  if (!hasIdentity(actor)) return denied("UNAUTHENTICATED");
  if (!hasVisit(visit)) return denied("INVALID_VISIT");
  if (actor.tenantId !== visit.tenantId) return denied("TENANT_MISMATCH");
  return allowed();
}
function assignedProfessional(actor, visit) {
  return role(actor, "professional") && actor.id === visit.assignedProfessionalId;
}
function coordinator(actor) {
  return role(actor, "coordinator") && permission(actor, "visit:manage");
}
function validReason(value) { return typeof value === "string" && value.trim().length >= 8; }
function validSha(value) { return typeof value === "string" && HEX256.test(value); }

/**
 * Defense-in-depth authorization rules. The backend must additionally enforce
 * authenticated session, case-level grants, consistent DB transaction and auditing.
 */
export function authorizeVisitAction({ actor, visit, action }) {
  const scope = scoped(actor, visit);
  if (!scope.allowed) return scope;
  switch (action) {
    case "READ_VISIT":
      return assignedProfessional(actor, visit) || coordinator(actor) ? allowed() : denied("NOT_ASSIGNED");
    case "READ_CLINICAL":
      // Coordination/administration does not automatically expose clinical notes.
      return assignedProfessional(actor, visit) ? allowed() : denied("CLINICAL_SCOPE_DENIED");
    case "WRITE_CLINICAL":
      return assignedProfessional(actor, visit) && visit.state === VISIT_STATES.IN_PROGRESS
        ? allowed() : denied("CLINICAL_WRITE_DENIED");
    case "ASSIGN_VISIT":
      return coordinator(actor) && visit.state === VISIT_STATES.PLANNED
        ? allowed() : denied("ASSIGNMENT_DENIED");
    default:
      return denied("UNKNOWN_ACTION");
  }
}

function validCaregiverEvidence(evidence, documentSha256) {
  if (!evidence || evidence.attestationDocumentSha256 !== documentSha256) {
    return denied("CAREGIVER_DOCUMENT_MISMATCH");
  }
  if (evidence.outcome === "SIGNED") {
    if (!SIGNER_ROLES.has(evidence.signerRole)) return denied("SIGNER_ROLE_INVALID");
    if (evidence.signerRole === "AUTHORIZED_CAREGIVER" && evidence.authorizationVerified !== true) {
      return denied("CAREGIVER_AUTHORIZATION_UNVERIFIED");
    }
    if (evidence.identityVerified !== true || !validSha(evidence.signatureArtifactSha256)) {
      return denied("CAREGIVER_EVIDENCE_UNVERIFIED");
    }
    return allowed();
  }
  if (evidence.outcome === "REFUSED" || evidence.outcome === "UNAVAILABLE") {
    return validReason(evidence.reason)
      ? allowed("CAREGIVER_EXCEPTION_RECORDED") : denied("CAREGIVER_EXCEPTION_REASON_REQUIRED");
  }
  return denied("CAREGIVER_OUTCOME_INVALID");
}

/**
 * Evaluate an attempted transition without mutating visit data.
 * A verified signature object MUST be assembled by the trusted backend after
 * actual cryptographic validation. Boolean flags in a mobile payload are not proof.
 */
export function evaluateVisitTransition({ actor, visit, targetState, evidence = {} }) {
  const scope = scoped(actor, visit);
  if (!scope.allowed) return scope;
  if (!Object.hasOwn(TRANSITIONS, targetState)) return denied("UNKNOWN_STATE");
  if (!TRANSITIONS[visit.state].includes(targetState)) return denied("INVALID_TRANSITION");

  if (targetState === VISIT_STATES.ASSIGNED) {
    if (!coordinator(actor)) return denied("COORDINATOR_REQUIRED");
    if (typeof evidence.assignedProfessionalId !== "string" ||
        evidence.assignedProfessionalId.length === 0) return denied("PROFESSIONAL_REQUIRED");
    return allowed();
  }

  if (targetState === VISIT_STATES.CANCELLED || targetState === VISIT_STATES.NOT_PERFORMED) {
    if (!coordinator(actor)) return denied("COORDINATOR_REQUIRED");
    return validReason(evidence.reason) ? allowed() : denied("REASON_REQUIRED");
  }

  if (targetState === VISIT_STATES.CLOSED_VERIFIED) {
    if (!role(actor, "trusted_server_service") || evidence.trustedBackend !== true) {
      return denied("TRUSTED_SERVER_REQUIRED");
    }
    if (!validSha(evidence.documentSha256)) return denied("DOCUMENT_DIGEST_INVALID");
    const professional = evidence.professionalSignature;
    if (!professional || professional.kind !== "CERTIFIED_DIGITAL" ||
        professional.verifiedByTrustService !== true ||
        professional.visitId !== visit.id ||
        professional.documentSha256 !== evidence.documentSha256) {
      return denied("PROFESSIONAL_DIGITAL_SIGNATURE_UNVERIFIED");
    }
    const caregiver = validCaregiverEvidence(evidence.caregiverEvidence, evidence.documentSha256);
    if (!caregiver.allowed) return caregiver;
    return caregiver.code === "CAREGIVER_EXCEPTION_RECORDED"
      ? allowed("CLOSED_WITH_CAREGIVER_EXCEPTION") : allowed();
  }

  if (!assignedProfessional(actor, visit)) return denied("ASSIGNED_PROFESSIONAL_REQUIRED");

  if (targetState === VISIT_STATES.PENDING_REVIEW && visit.state === VISIT_STATES.IN_PROGRESS) {
    return evidence.clinicalRecordRecorded === true
      ? allowed() : denied("CLINICAL_RECORD_REQUIRED");
  }
  if (targetState === VISIT_STATES.PENDING_SIGNATURE) {
    return evidence.reviewConfirmed === true && validSha(evidence.documentSha256)
      ? allowed() : denied("DOCUMENT_REVIEW_REQUIRED");
  }
  // Returning to review invalidates any previous attestations; the backend must
  // issue a new document version/digest before requesting more signatures.
  return allowed();
}
