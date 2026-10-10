import test from "node:test";
import assert from "node:assert/strict";
import { assessClinicalAuthorization } from "../src/domain/clinical-authorization-policy.mjs";

const digest = "a".repeat(64);
const valid = () => ({
  action: "PLAN_REVIEW",
  actor: { id: "clinician-synthetic", active: true, organizationId: "org-synthetic", roles: ["PROFESSIONAL", "CLINICAL_APPROVER"] },
  episode: { id: "episode-synthetic", organizationId: "org-synthetic" },
  plan: { episodeId: "episode-synthetic", organizationId: "org-synthetic", version: 1, status: "DRAFT", digest },
  credential: { subjectId: "clinician-synthetic", organizationId: "org-synthetic", verified: true, revoked: false, validUntil: "2099-01-01" },
  review: { actorId: "clinician-synthetic", episodeId: "episode-synthetic", version: 1, digest, humanValidated: true, protocolApproved: true }
});
const rejected = (data, code) => assert.deepEqual(assessClinicalAuthorization(data), {allowed:false, code});

test("HC-02C1 fail closed: structurally complete synthetic submission cannot approve a plan", () => {
  rejected(valid(), "LIVE_CLINICAL_AUTHORIZATION_NOT_IMPLEMENTED");
  rejected({...valid(), action:"EPISODE_ACTIVATION"}, "LIVE_CLINICAL_AUTHORIZATION_NOT_IMPLEMENTED");
});
test("HC-02C1 denies unauthorized roles and cross-organizational actors", () => {
  const x=valid(); x.actor.roles=["ADMIN", "COORDINATOR"]; rejected(x,"CLINICAL_ROLE_REQUIRED");
  const y=valid(); y.actor.organizationId="other-org"; rejected(y,"UNVERIFIED_ACTOR_OR_ORGANIZATION");
});
test("HC-02C1 denies unsigned, obsolete or tampered plan metadata", () => {
  const a=valid(); a.plan.digest="wrong"; rejected(a,"PLAN_VERSION_INVALID");
  const b=valid(); b.review.version=2; rejected(b,"HUMAN_REVIEW_REQUIRED");
  const c=valid(); c.review.humanValidated=false; rejected(c,"HUMAN_REVIEW_REQUIRED");
});
test("HC-02C1 denies revoked or unverified professional identity evidence", () => {
  const a=valid(); a.credential.revoked=true; rejected(a,"CREDENTIAL_NOT_VERIFIED");
  const b=valid(); b.credential.verified=false; rejected(b,"CREDENTIAL_NOT_VERIFIED");
});
test("HC-02C1 rejects invalid, unknown and missing requests", () => {
  rejected(null,"INVALID_REQUEST");
  rejected({action:"SIGN_CLINICAL_DOCUMENT"},"UNSUPPORTED_ACTION");
  rejected({action:"PLAN_REVIEW"},"MISSING_EVIDENCE");
});
