import {
  DEMO_PLAN_DRAFTS, demoPlanDraftSummary, type DemoPlanDraft,
} from "./planDraftDemo";

/**
 * Only invented pending REQUEST records; no one has reviewed or approved
 * these plans. A request must refer to a separately existing DRAFT version.
 */
export type DemoPendingReview = Readonly<{
  id: string;
  patientRef: string;
  episodeRef: string;
  planVersion: number;
  requestState: "PENDING";
}>;

export const DEMO_PENDING_REVIEWS: readonly DemoPendingReview[] = Object.freeze([
  Object.freeze({
    id: "REV-DEMO-A-1", patientRef: "DEMO-PAT-A",
    episodeRef: "DEMO-EPI-A", planVersion: 1, requestState: "PENDING" as const,
  }),
  Object.freeze({
    id: "REV-DEMO-B-2", patientRef: "DEMO-PAT-B",
    episodeRef: "DEMO-EPI-B", planVersion: 2, requestState: "PENDING" as const,
  }),
]);

export type DemoPendingReviewView = Readonly<{
  id: string;
  episodeRef: string;
  version: number;
  state: "PENDIENTE";
}>;

/**
 * Fail-closed queue projection. Reject EVERY item when any request is
 * malformed, duplicate, approved, unrelated to a patient/episode or missing
 * the corresponding source DRAFT plan. No names or clinical fields escape.
 */
export function projectDemoPendingReviews(
  requests: readonly DemoPendingReview[] = DEMO_PENDING_REVIEWS,
  drafts: readonly DemoPlanDraft[] = DEMO_PLAN_DRAFTS,
): readonly DemoPendingReviewView[] {
  const result: DemoPendingReviewView[] = [];
  const seen = new Set<string>();

  for (const request of requests) {
    if (!request || typeof request !== "object" ||
      Object.keys(request).sort().join(",") !==
        "episodeRef,id,patientRef,planVersion,requestState" ||
      typeof request.patientRef !== "string" ||
      !/^DEMO-PAT-[A-Z0-9]{1,4}$/.test(request.patientRef) ||
      !Number.isSafeInteger(request.planVersion) ||
      request.planVersion < 1 || request.planVersion > 999 ||
      request.requestState !== "PENDING") return [];
    const suffix = request.patientRef.slice("DEMO-PAT-".length);
    if (request.episodeRef !== "DEMO-EPI-" + suffix ||
      request.id !== "REV-DEMO-" + suffix + "-" + request.planVersion ||
      seen.has(request.id)) return [];
    const patient = { id: request.patientRef, episodeRef: request.episodeRef,
      label: "Paciente ficticio" };
    if (!demoPlanDraftSummary(patient, drafts)) return [];
    const matching = drafts.filter(draft =>
      draft.patientRef === request.patientRef &&
      draft.episodeRef === request.episodeRef &&
      draft.versionNumber === request.planVersion &&
      draft.planState === "DRAFT" &&
      draft.id === "DEMO-PLAN-" + suffix + "-" + request.planVersion
    );
    if (matching.length !== 1) return [];
    seen.add(request.id);
    result.push(Object.freeze({
      id: request.id, episodeRef: request.episodeRef,
      version: request.planVersion, state: "PENDIENTE" as const,
    }));
  }
  return Object.freeze(result.sort((a,b) =>
    a.episodeRef.localeCompare(b.episodeRef) || a.version-b.version
  ));
}
