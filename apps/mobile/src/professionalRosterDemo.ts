import type { DemoProfessional } from "./adminDemoData";
import { SPECIALTIES } from "./adminDemoData";
import type { DemoVisit, VisitStatus } from "./demoData";
import { resolveDemoWindow, type DemoCoverageKind } from "./coverageDemo";

const PRO_CODE = /^DEMO-PRO-(?:[0-9]+|CODE-[A-Z0-9]{1,4})$/;
const PAT_CODE = /^DEMO-PAT-([A-Z0-9]{1,4})$/;
const ITEM_CODE = /^DEMO-[A-Z0-9-]{1,32}$/;
const VISIT_STATES: readonly VisitStatus[] = ["ASSIGNED", "IN_PROGRESS", "CLOSED_VERIFIED"];

export type DemoOwnRosterItem = Readonly<{
  id: string;
  code: string;
  episodeRef: string;
  patientDisplay: string;
  specialty: DemoProfessional["specialty"];
  modality: DemoCoverageKind;
  date: string;
  startTime: string;
  endTime: string;
  status: VisitStatus;
  civilStartMinute: number;
}>;

export function isDemoProfessional(professional: DemoProfessional | undefined): boolean {
  return Boolean(professional && PRO_CODE.test(professional.id) &&
    SPECIALTIES.includes(professional.specialty));
}

/** An ID-derived synthetic label; never echo user-supplied names. */
export function demoOwnProfessionalLabel(professional: DemoProfessional): string {
  return PRO_CODE.test(professional.id)
    ? "Profesional ficticio " + professional.id.slice("DEMO-PRO-".length).replace(/^CODE-/, "")
    : "Profesional ficticio no identificado";
}

/**
 * Offline preview only. Does not establish authorizations or authentication:
 * in real Supabase, own-coverage scope must come from verified server identity,
 * live Auth session, team/organization membership and service-only RPC.
 */
export function projectDemoOwnRoster(
  professional: DemoProfessional | undefined,
  visits: readonly DemoVisit[],
): readonly DemoOwnRosterItem[] {
  if (!professional || !isDemoProfessional(professional)) return [];
  const seen = new Set<string>();
  const result: DemoOwnRosterItem[] = [];
  for (const visit of visits) {
    if (visit.professionalRef !== professional.id) continue;
    const patientSuffix = PAT_CODE.exec(visit.patientRef ?? "")?.[1];
    const interval = resolveDemoWindow(visit.date,visit.startTime,visit.endTime);
    if (!patientSuffix ||
      visit.episodeRef !== "DEMO-EPI-" + patientSuffix ||
      !ITEM_CODE.test(visit.id) ||
      !interval || seen.has(visit.id) ||
      visit.specialty !== professional.specialty ||
      (visit.serviceKind !== "VISIT" && visit.serviceKind !== "SHIFT") ||
      !VISIT_STATES.includes(visit.status)) {
      return []; // Inconsistent own roster: fail closed rather than mixing cases.
    }
    seen.add(visit.id);
    result.push(Object.freeze({
      id: visit.id,
      code: (visit.serviceKind === "SHIFT" ? "GUA-" : "VIS-") + visit.id,
      episodeRef: visit.episodeRef,
      patientDisplay: "Paciente ficticio " + patientSuffix,
      specialty: professional.specialty,
      modality: visit.serviceKind,
      date: visit.date,
      startTime: visit.startTime,
      endTime: visit.endTime,
      status: visit.status,
      civilStartMinute: interval.startMinute,
    }));
  }
  return Object.freeze(result.sort((a,b) =>
    a.civilStartMinute-b.civilStartMinute || a.id.localeCompare(b.id)
  ));
}
