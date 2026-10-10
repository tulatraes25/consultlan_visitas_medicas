import type { DemoVisit } from './demoData';

/**
 * MOB-ROSTER-02: local civil-minute model for a SYNTHETIC UI demo.
 * Real coverage uses server-side timestamptz + PostgreSQL exclusion constraints.
 * Never treat these civil-minute calculations as a clinical booking authority:
 * daylight-saving/ambiguous local instants require an explicit IANA timezone later.
 */
export type DemoCoverageKind = 'VISIT' | 'SHIFT';

export type DemoTimeWindow = Readonly<{
  startMinute: number; // Synthetic civil minutes since Unix epoch
  endMinute: number; // End-exclusive interval
  durationMinutes: number;
  overnight: boolean;
}>;

function parseClock(value: string): number | null {
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function civilDay(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  if (year < 2000 || year > 2099) return null;
  const ms = Date.UTC(year, month - 1, day);
  const parsed = new Date(ms);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day) return null;
  return ms / 60000;
}

export function resolveDemoWindow(
  date: string, startTime: string, endTime: string,
): DemoTimeWindow | null {
  const origin = civilDay(date);
  const from = parseClock(startTime);
  const to = parseClock(endTime);
  if (origin === null || from === null || to === null) return null;
  const overnight = to <= from;
  const startMinute = origin + from;
  const endMinute = origin + to + (overnight ? 1440 : 0);
  const durationMinutes = endMinute - startMinute;
  if (durationMinutes < 1 || durationMinutes > 1440) return null;
  return { startMinute, endMinute, durationMinutes, overnight };
}

export function formatDemoTimeRange(startTime: string, endTime: string): string {
  return `${startTime} – ${endTime}${endTime <= startTime ? ' (+1 día)' : ''}`;
}

export function coverageKindLabel(kind: DemoCoverageKind): string {
  return kind === 'SHIFT' ? 'Guardia prolongada' : 'Visita puntual';
}

export function coverageDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  if (hours === 0) return `${remain} min`;
  if (remain === 0) return `${hours} h`;
  return `${hours} h ${remain} min`;
}

export function demoWindowsOverlap(a: DemoTimeWindow, b: DemoTimeWindow): boolean {
  // Adjacent [start,end) windows are legal and useful for shift transitions.
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

export function hasDemoProfessionalCollision(
  existing: readonly DemoVisit[],
  professionalRef: string,
  candidate: DemoTimeWindow,
): boolean {
  return existing.some(visit => {
    if (!professionalRef || visit.professionalRef !== professionalRef) return false;
    const window = resolveDemoWindow(visit.date, visit.startTime, visit.endTime);
    // Fail closed if a malformed legacy synthetic row claims this professional.
    return !window || demoWindowsOverlap(window, candidate);
  });
}

export type DemoContinuityHint = Readonly<{ outgoingId: string; incomingId: string }>;

/**
 * Candidate shift continuity only. NOT an acknowledged/reconciled handover:
 * a shared synthetic homecare episode, different clinicians, and adjacency
 * are necessary but not sufficient for a clinical handover.
 */
export function findDemoContinuityHints(visits: readonly DemoVisit[]): DemoContinuityHint[] {
  const shifts = visits.filter(v =>
    v.serviceKind === 'SHIFT' && Boolean(v.episodeRef && v.professionalRef));
  const result: DemoContinuityHint[] = [];
  for (const outgoing of shifts) {
    const current = resolveDemoWindow(outgoing.date, outgoing.startTime, outgoing.endTime);
    if (!current) continue;
    for (const incoming of shifts) {
      if (outgoing.id === incoming.id
        || outgoing.episodeRef !== incoming.episodeRef
        || outgoing.professionalRef === incoming.professionalRef) continue;
      const next = resolveDemoWindow(incoming.date, incoming.startTime, incoming.endTime);
      if (next && current.endMinute === next.startMinute) {
        result.push({ outgoingId: outgoing.id, incomingId: incoming.id });
      }
    }
  }
  return result;
}
