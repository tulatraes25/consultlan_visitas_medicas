/**
 * HC-02C1: pure synthetic authorization policy.
 * NO live approval, medical order, credential validation or clinical activation.
 * All input is treated as untrusted; default DENY.
 */
const deny = (code) => Object.freeze({ allowed: false, code });
const ALLOWED_CONTEXT = new Set(["PLAN_REVIEW", "EPISODE_ACTIVATION"]);

export function assessClinicalAuthorization(context) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return deny("INVALID_REQUEST");
  if (!ALLOWED_CONTEXT.has(context.action)) return deny("UNSUPPORTED_ACTION");
  const { actor, episode, plan, credential, review } = context;
  if (!actor || !episode || !plan || !credential || !review) return deny("MISSING_EVIDENCE");
  if (typeof actor.id !== "string" || !actor.id || actor.active !== true ||
      typeof actor.organizationId !== "string" || !actor.organizationId ||
      actor.organizationId !== episode.organizationId) return deny("UNVERIFIED_ACTOR_OR_ORGANIZATION");
  if (!Array.isArray(actor.roles) || !actor.roles.includes("CLINICAL_APPROVER") ||
      !actor.roles.includes("PROFESSIONAL")) return deny("CLINICAL_ROLE_REQUIRED");
  if (credential.subjectId !== actor.id || credential.organizationId !== episode.organizationId ||
      credential.verified !== true || credential.revoked !== false ||
      typeof credential.validUntil !== "string") return deny("CREDENTIAL_NOT_VERIFIED");
  if (plan.episodeId !== episode.id || plan.organizationId !== episode.organizationId ||
      !Number.isSafeInteger(plan.version) || plan.version < 1 ||
      plan.status !== "DRAFT" || typeof plan.digest !== "string" ||
      !/^[0-9a-f]{64}$/.test(plan.digest)) return deny("PLAN_VERSION_INVALID");
  if (review.actorId !== actor.id || review.episodeId !== episode.id ||
      review.version !== plan.version || review.digest !== plan.digest ||
      review.humanValidated !== true || review.protocolApproved !== true) return deny("HUMAN_REVIEW_REQUIRED");
  // The real clinical authority and institutional approval protocol do not exist.
  // This pure contract can never activate or approve anything.
  return deny("LIVE_CLINICAL_AUTHORIZATION_NOT_IMPLEMENTED");
}
