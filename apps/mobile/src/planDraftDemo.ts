import type { DemoPatient } from "./adminDemoData";

/**
 * MOB-HC-PLAN-01: fictional STRUCTURAL metadata, not a prescription or
 * care-plan authorization. Never connect this fixture to Supabase.
 * A review request is not an approval; even review status is not inferred here.
 */
export type DemoPlanDraft = Readonly<{
  id: string;
  patientRef: string;
  episodeRef: string;
  versionNumber: number;
  planState: "DRAFT";
}>;

export const DEMO_PLAN_DRAFTS: readonly DemoPlanDraft[] = Object.freeze([
  Object.freeze({
    id: "DEMO-PLAN-A-1", patientRef: "DEMO-PAT-A",
    episodeRef: "DEMO-EPI-A", versionNumber: 1, planState: "DRAFT" as const,
  }),
  Object.freeze({
    id: "DEMO-PLAN-B-1", patientRef: "DEMO-PAT-B",
    episodeRef: "DEMO-EPI-B", versionNumber: 1, planState: "DRAFT" as const,
  }),
  Object.freeze({
    id: "DEMO-PLAN-B-2", patientRef: "DEMO-PAT-B",
    episodeRef: "DEMO-EPI-B", versionNumber: 2, planState: "DRAFT" as const,
  }),
]);

export type DemoPlanDraftSummary = Readonly<{
  latestVersion: number;
  draftVersions: number;
  status: "BORRADOR · SIN APROBACIÓN";
}>;

/**
 * Fail closed on malformed or duplicate metadata. Return only the version
 * numbers from the exact selected synthetic patient+episode. No diagnosis,
 * medication, approved-by, reviewer identity, narratives or free text.
 */
export function demoPlanDraftSummary(
  patient: DemoPatient | undefined,
  plans: readonly DemoPlanDraft[] = DEMO_PLAN_DRAFTS,
): DemoPlanDraftSummary | null {
  if (!patient || !/^DEMO-PAT-[A-Z0-9]{1,4}$/.test(patient.id) ||
    !/^DEMO-EPI-[A-Z0-9]{1,4}$/.test(patient.episodeRef)) return null;
  const suffix = patient.id.slice("DEMO-PAT-".length);
  const expectedEpisode = "DEMO-EPI-" + suffix;
  if (patient.episodeRef !== expectedEpisode) return null;

  const versions = new Set<number>();
  for (const plan of plans) {
    if (plan.patientRef !== patient.id || plan.episodeRef !== patient.episodeRef) continue;
    if (Object.keys(plan).sort().join(",") !==
        "episodeRef,id,patientRef,planState,versionNumber" ||
      plan.planState !== "DRAFT" ||
      !Number.isSafeInteger(plan.versionNumber) ||
      plan.versionNumber < 1 || plan.versionNumber > 999 ||
      plan.id !== "DEMO-PLAN-" + suffix + "-" + plan.versionNumber ||
      versions.has(plan.versionNumber)) return null;
    versions.add(plan.versionNumber);
  }
  if (versions.size === 0) return null;
  return Object.freeze({
    latestVersion: Math.max(...versions),
    draftVersions: versions.size,
    status: "BORRADOR · SIN APROBACIÓN" as const,
  });
}
