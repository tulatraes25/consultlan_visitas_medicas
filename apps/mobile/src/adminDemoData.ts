import type { DemoVisit, Specialty } from './demoData';
import {
  coverageKindLabel, hasDemoProfessionalCollision, resolveDemoWindow,
  type DemoCoverageKind,
} from './coverageDemo';

export type DemoPatient = Readonly<{ id: string; label: string; episodeRef: string }>;
export type DemoProfessional = Readonly<{
  id: string;
  label: string;
  specialty: Specialty;
}>;

export const SPECIALTIES: readonly Specialty[] = [
  'Medicina', 'Enfermería', 'Kinesiología', 'Fonoaudiología',
  'Terapia ocupacional', 'Nutrición',
] as const;

export function createDemoPatients(): DemoPatient[] {
  // One isolated synthetic episode per demo patient. Not a clinical admission.
  return 'ABCDEF'.split('').map(code => ({
    id: 'DEMO-PAT-' + code,
    label: 'Paciente ficticio ' + code,
    episodeRef: 'DEMO-EPI-' + code,
  }));
}
export function createDemoProfessionals(): DemoProfessional[] {
  return SPECIALTIES.map((specialty, index) => ({
    id: 'DEMO-PRO-' + String(index + 1),
    label: 'Profesional ficticio ' + String(index + 1),
    specialty,
  }));
}

const CODE_PATTERN = /^[A-Z0-9]{1,4}$/;
/**
 * Prevent actual names, DNI, date of birth or contact data
 * from entering an intentionally insecure ephemeral demonstration.
 */
export function normalizeDemoCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}
export function createPatientEntry(
  code: string, existing: readonly DemoPatient[],
): DemoPatient | null {
  const normalized = normalizeDemoCode(code);
  if (!normalized) return null;
  const candidate = {
    id: 'DEMO-PAT-' + normalized,
    label: 'Paciente ficticio ' + normalized,
    episodeRef: 'DEMO-EPI-' + normalized,
  };
  return existing.some(p => p.id === candidate.id) ? null : candidate;
}
export function createProfessionalEntry(
  code: string, specialty: Specialty,
  existing: readonly DemoProfessional[],
): DemoProfessional | null {
  const normalized = normalizeDemoCode(code);
  if (!normalized || !SPECIALTIES.includes(specialty)) return null;
  const candidate = {
    id: 'DEMO-PRO-CODE-' + normalized,
    label: 'Profesional ficticio ' + normalized,
    specialty,
  };
  return existing.some(p => p.id === candidate.id) ? null : candidate;
}
export function nextDemoDay(now = new Date()): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  date.setDate(date.getDate() + 1);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}

/**
 * All dates and identifiers are synthetic and local to this process.
 * There is no patient admission, care-plan approval or actual staffing.
 */
export function createDemoAssignment(args: {
  patient: DemoPatient;
  professional: DemoProfessional;
  current: readonly DemoVisit[];
  day: string;
  kind: DemoCoverageKind;
  startTime: string;
  endTime: string;
}): DemoVisit | null {
  const { patient, professional, current, day, kind, startTime, endTime } = args;
  if ((kind !== 'VISIT' && kind !== 'SHIFT') ||
      !patient.id.startsWith('DEMO-PAT-') || !patient.episodeRef.startsWith('DEMO-EPI-') ||
      !professional.id.startsWith('DEMO-PRO-')) return null;
  const candidate = resolveDemoWindow(day, startTime, endTime);
  if (!candidate || hasDemoProfessionalCollision(current, professional.id, candidate)) {
    return null;
  }
  const nextId = 'DEMO-M-' + String(current.length + 1).padStart(3, '0');
  return {
    id: nextId,
    reference: (kind === 'SHIFT' ? 'GUA-' : 'VIS-') + nextId,
    patientRef: patient.id,
    episodeRef: patient.episodeRef,
    patientLabel: patient.label,
    specialty: professional.specialty,
    professionalRef: professional.id,
    serviceKind: kind,
    date: day,
    startTime,
    endTime,
    status: 'ASSIGNED',
    neighborhood: 'Domicilio ficticio · sin dirección real',
    detail: coverageKindLabel(kind) +
      ' de muestra, sin plan médico ni registro clínico operativo.',
  };
}
